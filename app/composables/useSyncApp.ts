import { computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  Session,
  SupabaseClient
} from '@supabase/supabase-js'
import type {
  LegacySubject,
  LegacyTask,
  OutboxEntry,
  ProfileEntry,
  ProfileId,
  SyncMode,
  SyncStatus,
  SyncedSubject,
  SyncedTask,
  TaskType
} from '~/types/sync'
import { defaultSubjectTemplates, taskTypes } from '~/types/sync'
import {
  clearProfileData,
  deleteOutboxEntry,
  getActiveProfileId,
  getGlobalMetaValue,
  getProfile,
  loadOutbox,
  loadSubjects,
  loadTasks,
  migrateLegacyFlatState,
  putOutboxEntry,
  putProfile,
  putSubjects,
  putTasks,
  setActiveProfileId,
  setGlobalMetaValue
} from '~/utils/sync-db'

const GUEST_PROFILE_ID = 'guest' as const
const GUEST_USER_ID = 'guest'
const LEGACY_SUBJECTS_STORAGE_KEY = 'task-manager-subjects'
const LEGACY_TASKS_STORAGE_KEY = 'task-manager-tasks'

let supabaseClient: SupabaseClient | null | undefined
let authSubscription: { unsubscribe: () => void } | null = null
let realtimeChannel: RealtimeChannel | null = null
let initPromise: Promise<void> | null = null
let syncPromise: Promise<void> | null = null
let onlineListenersBound = false
let realtimePullTimer: ReturnType<typeof setTimeout> | null = null

function isoNow() {
  return new Date().toISOString()
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createAccountProfileId(userId: string) {
  return `account:${userId}` as ProfileId
}

function createDefaultSubjectId(profileId: ProfileId, slug: string) {
  return `subject:${profileId}:${slug}`
}

function compareTasks(a: SyncedTask, b: SyncedTask) {
  return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
}

function compareSubjects(a: SyncedSubject, b: SyncedSubject) {
  return a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name, 'ja')
}

function mergeRows<T extends { id: string }>(current: T[], incoming: T[]) {
  const next = new Map<string, T>()
  for (const row of current) {
    next.set(row.id, row)
  }
  for (const row of incoming) {
    next.set(row.id, row)
  }
  return Array.from(next.values())
}

function getProfileOwner(profileId: ProfileId, userId: string | null) {
  return userId ?? (profileId === GUEST_PROFILE_ID ? GUEST_USER_ID : '')
}

function parseLegacySubjects(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized: LegacySubject[] = []
    const seenIds = new Set<string>()
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const subject = item as Partial<LegacySubject>
      const id = typeof subject.id === 'string' ? subject.id.trim() : ''
      const name = typeof subject.name === 'string' ? subject.name.trim() : ''
      const emoji = typeof subject.emoji === 'string' ? subject.emoji.trim() : ''
      if (!id || !name || !emoji || seenIds.has(id)) continue
      seenIds.add(id)
      normalized.push({ id, name, emoji })
    }
    return normalized
  } catch {
    return []
  }
}

function parseLegacyTasks(raw: string | null, subjects: LegacySubject[]) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const allowedTypes = new Set<string>(taskTypes)
    const subjectIdByName = new Map(subjects.map((subject) => [subject.name, subject.id]))
    const normalized: LegacyTask[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const task = item as Partial<LegacyTask> & { subject?: string; memo?: string }
      if (
        typeof task.id !== 'string' ||
        typeof task.date !== 'string' ||
        typeof task.type !== 'string' ||
        !allowedTypes.has(task.type)
      ) {
        continue
      }
      let subjectId = typeof task.subjectId === 'string' ? task.subjectId.trim() : ''
      if (!subjectId && typeof task.subject === 'string') {
        subjectId = subjectIdByName.get(task.subject.trim()) ?? ''
      }
      if (!subjectId) continue
      normalized.push({
        id: task.id,
        date: task.date,
        subjectId,
        type: task.type as TaskType,
        memo: typeof task.memo === 'string' && task.memo.trim() ? task.memo.trim() : undefined
      })
    }
    return normalized
  } catch {
    return []
  }
}

function convertLegacyData(profileId: ProfileId, userId: string, deviceId: string) {
  const rawSubjects = localStorage.getItem(LEGACY_SUBJECTS_STORAGE_KEY)
  const rawTasks = localStorage.getItem(LEGACY_TASKS_STORAGE_KEY)
  if (!rawSubjects && !rawTasks) return null

  const fallbackSubjects = defaultSubjectTemplates.map((subject) => ({
    id: createDefaultSubjectId(profileId, subject.slug),
    name: subject.name,
    emoji: subject.emoji
  }))

  const subjects = parseLegacySubjects(rawSubjects) ?? fallbackSubjects
  const normalizedSubjects = subjects.length > 0 ? subjects : fallbackSubjects
  const tasks = parseLegacyTasks(rawTasks, normalizedSubjects)

  if (!rawSubjects && tasks.length === 0) {
    return null
  }

  const createdAt = isoNow()
  return {
    subjects: normalizedSubjects.map<SyncedSubject>((subject) => ({
      id: subject.id,
      user_id: userId,
      device_id: deviceId,
      name: subject.name,
      emoji: subject.emoji,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null
    })),
    tasks: tasks.map<SyncedTask>((task) => ({
      id: task.id,
      user_id: userId,
      device_id: deviceId,
      subject_id: task.subjectId,
      date: task.date,
      type: task.type,
      memo: task.memo ?? null,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null
    }))
  }
}

function cloneSubjectForAccount(
  subject: SyncedSubject,
  userId: string,
  deviceId: string
): SyncedSubject {
  return {
    ...subject,
    user_id: userId,
    device_id: deviceId
  }
}

function cloneTaskForAccount(task: SyncedTask, userId: string, deviceId: string): SyncedTask {
  return {
    ...task,
    user_id: userId,
    device_id: deviceId
  }
}

export function useSyncApp() {
  const config = useRuntimeConfig()
  const session = useState<Session | null>('sync:session', () => null)
  const authReady = useState<boolean>('sync:auth-ready', () => false)
  const initialized = useState<boolean>('sync:initialized', () => false)
  const temporaryLocalMode = useState<boolean>('sync:temporary-local-mode', () => false)
  const syncStatus = useState<SyncStatus>('sync:status', () => 'local-only')
  const syncError = useState<string | null>('sync:error', () => null)
  const linkNotice = useState<string | null>('sync:link-notice', () => null)
  const authPending = useState<boolean>('sync:auth-pending', () => false)
  const subjectRows = useState<SyncedSubject[]>('sync:subject-rows', () => [])
  const taskRows = useState<SyncedTask[]>('sync:task-rows', () => [])
  const pendingMutations = useState<number>('sync:pending-mutations', () => 0)
  const lastSyncedAt = useState<string | null>('sync:last-synced-at', () => null)
  const deviceId = useState<string>('sync:device-id', () => '')
  const online = useState<boolean>('sync:online', () => (import.meta.client ? navigator.onLine : true))
  const activeProfileId = useState<ProfileId>('sync:active-profile-id', () => GUEST_PROFILE_ID)
  const activeProfile = useState<ProfileEntry | null>('sync:active-profile', () => null)

  const isConfigured = computed(
    () => Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)
  )
  const canUseSyncFeatures = computed(() => isConfigured.value && !temporaryLocalMode.value)
  const syncMode = computed<SyncMode>(() => {
    if (session.value && isConfigured.value) return 'synced'
    if (activeProfile.value?.user_id) return 'local-account'
    return 'guest'
  })
  const userEmail = computed(() => session.value?.user.email ?? '')
  const canSyncNow = computed(() => Boolean(session.value && canUseSyncFeatures.value))
  const activeSubjects = computed(() =>
    [...subjectRows.value].filter((subject) => !subject.deleted_at).sort(compareSubjects)
  )
  const activeTasks = computed(() =>
    [...taskRows.value].filter((task) => !task.deleted_at).sort(compareTasks)
  )
  const syncStatusLabel = computed(() => {
    switch (syncStatus.value) {
      case 'syncing':
        return '同期中'
      case 'offline':
        return 'オフライン'
      case 'error':
        return '同期エラー'
      case 'local-only':
        return pendingMutations.value > 0 ? `ローカル保存 ${pendingMutations.value} 件` : 'ローカルモード'
      default:
        return pendingMutations.value > 0 ? `未送信 ${pendingMutations.value} 件` : '同期済み'
    }
  })

  function getSupabaseClient() {
    if (import.meta.server) return null
    if (!canUseSyncFeatures.value) return null
    if (!supabaseClient) {
      supabaseClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          persistSession: true
        }
      })
    }
    return supabaseClient
  }

  function createDefaultSubjectRows(profileId: ProfileId, userId: string | null, now = isoNow()) {
    const owner = getProfileOwner(profileId, userId)
    return defaultSubjectTemplates.map<SyncedSubject>((subject) => ({
      id: createDefaultSubjectId(profileId, subject.slug),
      user_id: owner,
      device_id: deviceId.value,
      name: subject.name,
      emoji: subject.emoji,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }))
  }

  function activateTemporaryLocalMode(message: string) {
    const now = isoNow()
    if (!deviceId.value) {
      deviceId.value = createId()
    }
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
    if (realtimeChannel) {
      void realtimeChannel.unsubscribe()
      realtimeChannel = null
    }
    if (realtimePullTimer) {
      clearTimeout(realtimePullTimer)
      realtimePullTimer = null
    }
    temporaryLocalMode.value = true
    session.value = null
    authPending.value = false
    linkNotice.value = null
    syncError.value = message
    syncStatus.value = online.value ? 'error' : 'offline'
    activeProfileId.value = GUEST_PROFILE_ID
    activeProfile.value = {
      id: GUEST_PROFILE_ID,
      user_id: null,
      guest_linked_user_id: null,
      last_synced_at: null,
      legacy_imported_at: now,
      created_at: now,
      updated_at: now
    }
    subjectRows.value = createDefaultSubjectRows(GUEST_PROFILE_ID, null, now)
    taskRows.value = []
    lastSyncedAt.value = null
    pendingMutations.value = 0
  }

  async function ensureDeviceId() {
    if (deviceId.value) return deviceId.value
    const stored = await getGlobalMetaValue('deviceId')
    if (stored) {
      deviceId.value = stored
      return stored
    }
    const generated = createId()
    await setGlobalMetaValue('deviceId', generated)
    deviceId.value = generated
    return generated
  }

  async function ensureProfileRecord(profileId: ProfileId, userId: string | null) {
    const existing = await getProfile(profileId)
    if (existing) {
      if (existing.user_id === userId) return existing
      const updated: ProfileEntry = {
        ...existing,
        user_id: userId,
        updated_at: isoNow()
      }
      await putProfile(updated)
      return updated
    }

    const timestamp = isoNow()
    const created: ProfileEntry = {
      id: profileId,
      user_id: userId,
      guest_linked_user_id: null,
      last_synced_at: null,
      legacy_imported_at: null,
      created_at: timestamp,
      updated_at: timestamp
    }
    await putProfile(created)
    return created
  }

  async function saveProfile(profile: ProfileEntry) {
    await putProfile({
      ...profile,
      updated_at: isoNow()
    })
  }

  async function switchToProfile(profileId: ProfileId, userId: string | null) {
    const profile = await ensureProfileRecord(profileId, userId)
    activeProfile.value = profile
    activeProfileId.value = profile.id
    await setActiveProfileId(profile.id)
    subjectRows.value = (await loadSubjects(profile.id)).sort(compareSubjects)
    taskRows.value = (await loadTasks(profile.id)).sort(compareTasks)
    lastSyncedAt.value = profile.last_synced_at
    pendingMutations.value = (await loadOutbox(profile.id)).length
  }

  async function setProfileLastSyncedAt(profileId: ProfileId, value: string | null) {
    const profile = await ensureProfileRecord(
      profileId,
      profileId === GUEST_PROFILE_ID ? null : activeProfile.value?.user_id ?? null
    )
    const nextProfile: ProfileEntry = {
      ...profile,
      last_synced_at: value,
      updated_at: isoNow()
    }
    await putProfile(nextProfile)
    if (activeProfileId.value === profileId) {
      activeProfile.value = nextProfile
      lastSyncedAt.value = value
    }
  }

  async function refreshPendingMutations(profileId: ProfileId = activeProfileId.value) {
    if (temporaryLocalMode.value) {
      if (activeProfileId.value === profileId) {
        pendingMutations.value = 0
      }
      return 0
    }
    const count = (await loadOutbox(profileId)).length
    if (activeProfileId.value === profileId) {
      pendingMutations.value = count
    }
    return count
  }

  async function upsertSubjectRows(profileId: ProfileId, rows: SyncedSubject[]) {
    if (rows.length === 0) return
    if (temporaryLocalMode.value) {
      if (activeProfileId.value === profileId) {
        subjectRows.value = mergeRows(subjectRows.value, rows).sort(compareSubjects)
      }
      return
    }
    await putSubjects(profileId, rows)
    if (activeProfileId.value === profileId) {
      subjectRows.value = mergeRows(subjectRows.value, rows).sort(compareSubjects)
    }
  }

  async function upsertTaskRows(profileId: ProfileId, rows: SyncedTask[]) {
    if (rows.length === 0) return
    if (temporaryLocalMode.value) {
      if (activeProfileId.value === profileId) {
        taskRows.value = mergeRows(taskRows.value, rows).sort(compareTasks)
      }
      return
    }
    await putTasks(profileId, rows)
    if (activeProfileId.value === profileId) {
      taskRows.value = mergeRows(taskRows.value, rows).sort(compareTasks)
    }
  }

  async function enqueueMutation(
    profileId: ProfileId,
    table: 'subjects',
    row: SyncedSubject
  ): Promise<void>
  async function enqueueMutation(
    profileId: ProfileId,
    table: 'tasks',
    row: SyncedTask
  ): Promise<void>
  async function enqueueMutation(
    profileId: ProfileId,
    table: 'subjects' | 'tasks',
    row: SyncedSubject | SyncedTask
  ) {
    if (temporaryLocalMode.value) return
    const entry: OutboxEntry = {
      id: `${table}:${row.id}:${row.updated_at}`,
      table,
      row,
      queued_at: isoNow()
    }
    await putOutboxEntry(profileId, entry)
    await refreshPendingMutations(profileId)
  }

  function getSubjectName(subjectId: string) {
    const subject = subjectRows.value.find((item) => item.id === subjectId)
    return !subject || subject.deleted_at ? '（削除済み）' : subject.name
  }

  async function maybeImportGuestLegacyData() {
    if (!activeProfile.value || activeProfile.value.id !== GUEST_PROFILE_ID) return false
    if (activeProfile.value.legacy_imported_at) return false
    if (subjectRows.value.length > 0 || taskRows.value.length > 0) {
      const nextProfile: ProfileEntry = {
        ...activeProfile.value,
        legacy_imported_at: isoNow(),
        updated_at: isoNow()
      }
      await putProfile(nextProfile)
      activeProfile.value = nextProfile
      return false
    }

    const importedAt = isoNow()
    const legacy = convertLegacyData(GUEST_PROFILE_ID, GUEST_USER_ID, deviceId.value)
    const nextProfile: ProfileEntry = {
      ...activeProfile.value,
      legacy_imported_at: importedAt,
      updated_at: importedAt
    }
    await putProfile(nextProfile)
    activeProfile.value = nextProfile
    if (!legacy) return false

    await upsertSubjectRows(GUEST_PROFILE_ID, legacy.subjects)
    await upsertTaskRows(GUEST_PROFILE_ID, legacy.tasks)
    return true
  }

  async function ensureDefaultSubjects(profileId: ProfileId, userId: string | null) {
    if (subjectRows.value.length > 0) return
    const rows = createDefaultSubjectRows(profileId, userId)
    await upsertSubjectRows(profileId, rows)
    if (userId) {
      for (const row of rows) {
        await enqueueMutation(profileId, 'subjects', row)
      }
    }
  }

  async function profileHasAnyData(profileId: ProfileId) {
    const [subjects, tasks, outbox] = await Promise.all([
      loadSubjects(profileId),
      loadTasks(profileId),
      loadOutbox(profileId)
    ])
    return subjects.length > 0 || tasks.length > 0 || outbox.length > 0
  }

  async function mergeGuestProfileIntoAccount(userId: string, accountProfileId: ProfileId) {
    const guestProfile = await ensureProfileRecord(GUEST_PROFILE_ID, null)
    if (guestProfile.guest_linked_user_id) return false
    if (await profileHasAnyData(accountProfileId)) return false

    const [guestSubjects, guestTasks] = await Promise.all([
      loadSubjects(GUEST_PROFILE_ID),
      loadTasks(GUEST_PROFILE_ID)
    ])

    if (guestSubjects.length === 0 && guestTasks.length === 0) return false

    const clonedSubjects = guestSubjects.map((subject) =>
      cloneSubjectForAccount(subject, userId, deviceId.value)
    )
    const clonedTasks = guestTasks.map((task) => cloneTaskForAccount(task, userId, deviceId.value))

    await upsertSubjectRows(accountProfileId, clonedSubjects)
    await upsertTaskRows(accountProfileId, clonedTasks)

    for (const subject of clonedSubjects) {
      await enqueueMutation(accountProfileId, 'subjects', subject)
    }
    for (const task of clonedTasks) {
      await enqueueMutation(accountProfileId, 'tasks', task)
    }

    await clearProfileData(GUEST_PROFILE_ID)
    const updatedGuestProfile: ProfileEntry = {
      ...guestProfile,
      guest_linked_user_id: userId,
      updated_at: isoNow()
    }
    await putProfile(updatedGuestProfile)

    if (activeProfileId.value === GUEST_PROFILE_ID) {
      subjectRows.value = []
      taskRows.value = []
      pendingMutations.value = 0
      activeProfile.value = updatedGuestProfile
    }

    return true
  }

  async function pullServerChanges(currentUserId: string) {
    const client = getSupabaseClient()
    if (!client) return

    const cursor = lastSyncedAt.value
    let subjectQuery = client
      .from('subjects')
      .select('*')
      .eq('user_id', currentUserId)
      .order('updated_at', { ascending: true })
    let taskQuery = client
      .from('tasks')
      .select('*')
      .eq('user_id', currentUserId)
      .order('updated_at', { ascending: true })

    if (cursor) {
      subjectQuery = subjectQuery.gt('updated_at', cursor)
      taskQuery = taskQuery.gt('updated_at', cursor)
    }

    const [{ data: subjectData, error: subjectError }, { data: taskData, error: taskError }] =
      await Promise.all([subjectQuery, taskQuery])

    if (subjectError) throw subjectError
    if (taskError) throw taskError

    const nextSubjects = (subjectData ?? []) as SyncedSubject[]
    const nextTasks = (taskData ?? []) as SyncedTask[]

    await upsertSubjectRows(activeProfileId.value, nextSubjects)
    await upsertTaskRows(activeProfileId.value, nextTasks)

    const updatedCandidates = [...nextSubjects, ...nextTasks]
      .map((item) => item.updated_at)
      .filter(Boolean)
    const nextCursor =
      updatedCandidates.length > 0
        ? updatedCandidates.sort().at(-1) ?? cursor ?? isoNow()
        : cursor ?? isoNow()

    await setProfileLastSyncedAt(activeProfileId.value, nextCursor)
  }

  async function flushOutbox(currentUserId: string) {
    const client = getSupabaseClient()
    if (!client || !online.value) return

    const profileId = createAccountProfileId(currentUserId)
    const queue = await loadOutbox(profileId)
    if (queue.length === 0) {
      if (activeProfileId.value === profileId) {
        pendingMutations.value = 0
      }
      return
    }

    for (const entry of queue) {
      const { error } = await client.from(entry.table).upsert(entry.row)
      if (error) throw error
      await deleteOutboxEntry(profileId, entry.id)
    }

    await refreshPendingMutations(profileId)
  }

  function scheduleRealtimePull() {
    if (realtimePullTimer) {
      clearTimeout(realtimePullTimer)
    }
    realtimePullTimer = setTimeout(() => {
      void syncNow()
    }, 250)
  }

  function handleRealtimePayload(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const row =
      payload.eventType === 'DELETE'
        ? (payload.old as { device_id?: string } | null)
        : (payload.new as { device_id?: string } | null)
    if (row?.device_id && row.device_id === deviceId.value) {
      return
    }
    scheduleRealtimePull()
  }

  async function subscribeRealtime(currentUserId: string) {
    const client = getSupabaseClient()
    if (!client) return
    if (realtimeChannel) {
      await realtimeChannel.unsubscribe()
      realtimeChannel = null
    }
    realtimeChannel = client
      .channel(`sync:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subjects', filter: `user_id=eq.${currentUserId}` },
        handleRealtimePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${currentUserId}` },
        handleRealtimePayload
      )
      .subscribe()
  }

  function updatePassiveStatus() {
    if (temporaryLocalMode.value) {
      syncStatus.value = online.value ? 'error' : 'offline'
      return
    }
    if (session.value && isConfigured.value) {
      syncStatus.value = online.value ? 'idle' : 'offline'
      return
    }
    syncStatus.value = online.value ? 'local-only' : 'offline'
  }

  async function handleSignedOut() {
    if (realtimeChannel) {
      await realtimeChannel.unsubscribe()
      realtimeChannel = null
    }
    session.value = null
    linkNotice.value = null
    updatePassiveStatus()
  }

  async function handleSignedIn(nextSession: Session) {
    session.value = nextSession
    syncError.value = null
    linkNotice.value = null

    const accountProfileId = createAccountProfileId(nextSession.user.id)
    await ensureProfileRecord(accountProfileId, nextSession.user.id)
    await mergeGuestProfileIntoAccount(nextSession.user.id, accountProfileId)
    await switchToProfile(accountProfileId, nextSession.user.id)
    await subscribeRealtime(nextSession.user.id)
    await syncNow()
  }

  async function onSessionChanged(nextSession: Session | null) {
    if (!nextSession) {
      await handleSignedOut()
      return
    }
    await handleSignedIn(nextSession)
  }

  async function syncNow() {
    if (syncPromise) return syncPromise
    syncPromise = (async () => {
      if (!session.value || !canUseSyncFeatures.value) {
        updatePassiveStatus()
        return
      }
      if (!online.value) {
        syncStatus.value = 'offline'
        return
      }

      const currentUserId = session.value.user.id
      const expectedProfileId = createAccountProfileId(currentUserId)
      if (activeProfileId.value !== expectedProfileId) {
        await switchToProfile(expectedProfileId, currentUserId)
      }

      syncStatus.value = 'syncing'
      syncError.value = null
      try {
        await pullServerChanges(currentUserId)
        if (subjectRows.value.length === 0) {
          await ensureDefaultSubjects(expectedProfileId, currentUserId)
        }
        await flushOutbox(currentUserId)
        await pullServerChanges(currentUserId)
        syncStatus.value = 'idle'
      } catch (error) {
        syncStatus.value = 'error'
        syncError.value = error instanceof Error ? error.message : '同期に失敗しました。'
      }
    })().finally(() => {
      syncPromise = null
    })
    return syncPromise
  }

  async function initialize() {
    if (import.meta.server) return
    if (initialized.value) return
    if (initPromise) return initPromise
    initPromise = (async () => {
      online.value = navigator.onLine
      try {
        temporaryLocalMode.value = false
        await ensureDeviceId()
        await migrateLegacyFlatState()

        const storedProfileId = (await getActiveProfileId()) ?? GUEST_PROFILE_ID
        const profileId = (await getProfile(storedProfileId)) ? storedProfileId : GUEST_PROFILE_ID
        await switchToProfile(
          profileId,
          profileId === GUEST_PROFILE_ID ? null : profileId.replace(/^account:/, '')
        )

        if (activeProfileId.value === GUEST_PROFILE_ID) {
          await maybeImportGuestLegacyData()
          if (subjectRows.value.length === 0) {
            await ensureDefaultSubjects(GUEST_PROFILE_ID, null)
          }
        }

        if (!onlineListenersBound) {
          window.addEventListener('online', () => {
            online.value = true
            if (session.value) {
              void syncNow()
            } else {
              updatePassiveStatus()
            }
          })
          window.addEventListener('offline', () => {
            online.value = false
            syncStatus.value = 'offline'
          })
          onlineListenersBound = true
        }

        const client = getSupabaseClient()
        if (client && !authSubscription) {
          const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
            void onSessionChanged(nextSession)
          })
          authSubscription = data.subscription
        }

        if (client) {
          const { data, error } = await client.auth.getSession()
          if (error) {
            syncError.value = error.message
            updatePassiveStatus()
          } else {
            await onSessionChanged(data.session)
          }
        } else {
          updatePassiveStatus()
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : '不明なエラー'
        activateTemporaryLocalMode(`ローカルデータの初期化に失敗したため、一時ローカルモードで継続します。(${reason})`)
      } finally {
        authReady.value = true
        initialized.value = true
      }
    })().finally(() => {
      initPromise = null
    })
    return initPromise
  }

  async function sendMagicLink(email: string) {
    const client = getSupabaseClient()
    if (!client) {
      syncError.value = '同期を使うには Supabase の設定が必要です。'
      return
    }

    const normalizedEmail = email.trim()
    if (!normalizedEmail) return

    authPending.value = true
    syncError.value = null
    linkNotice.value = null
    try {
      const redirectTo = new URL(config.app.baseURL || '/', window.location.origin).toString()
      const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: redirectTo }
      })
      if (error) throw error
      linkNotice.value = 'ログイン用リンクを送信しました。メールを確認してください。'
    } catch (error) {
      syncError.value =
        error instanceof Error ? error.message : 'ログインリンクの送信に失敗しました。'
    } finally {
      authPending.value = false
    }
  }

  async function signOut() {
    const client = getSupabaseClient()
    if (!client) {
      await handleSignedOut()
      return
    }

    authPending.value = true
    try {
      const { error } = await client.auth.signOut()
      if (error) throw error
      await handleSignedOut()
    } catch (error) {
      syncStatus.value = 'error'
      syncError.value = error instanceof Error ? error.message : 'ログアウトに失敗しました。'
    } finally {
      authPending.value = false
    }
  }

  async function addSubject(name: string, emoji: string) {
    const profile = activeProfile.value
    if (!profile) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    const now = isoNow()
    const row: SyncedSubject = {
      id: createId(),
      user_id: getProfileOwner(profile.id, profile.user_id),
      device_id: deviceId.value,
      name: trimmedName,
      emoji,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }

    await upsertSubjectRows(profile.id, [row])
    if (profile.user_id) {
      await enqueueMutation(profile.id, 'subjects', row)
    }

    if (session.value && profile.user_id === session.value.user.id) {
      void syncNow()
    } else {
      updatePassiveStatus()
    }
  }

  async function removeSubject(subjectId: string) {
    const profile = activeProfile.value
    if (!profile) return
    const current = subjectRows.value.find((subject) => subject.id === subjectId)
    if (!current || current.deleted_at) return

    const now = isoNow()
    const next: SyncedSubject = {
      ...current,
      device_id: deviceId.value,
      updated_at: now,
      deleted_at: now
    }

    await upsertSubjectRows(profile.id, [next])
    if (profile.user_id) {
      await enqueueMutation(profile.id, 'subjects', next)
    }

    if (session.value && profile.user_id === session.value.user.id) {
      void syncNow()
    } else {
      updatePassiveStatus()
    }
  }

  async function addTask(subjectId: string, date: string, type: TaskType) {
    const profile = activeProfile.value
    if (!profile) return

    const now = isoNow()
    const row: SyncedTask = {
      id: createId(),
      user_id: getProfileOwner(profile.id, profile.user_id),
      device_id: deviceId.value,
      subject_id: subjectId,
      date,
      type,
      memo: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }

    await upsertTaskRows(profile.id, [row])
    if (profile.user_id) {
      await enqueueMutation(profile.id, 'tasks', row)
    }

    if (session.value && profile.user_id === session.value.user.id) {
      void syncNow()
    } else {
      updatePassiveStatus()
    }
  }

  async function updateTaskMemo(taskId: string, memo: string) {
    const profile = activeProfile.value
    if (!profile) return
    const current = taskRows.value.find((task) => task.id === taskId)
    if (!current || current.deleted_at) return

    const now = isoNow()
    const next: SyncedTask = {
      ...current,
      device_id: deviceId.value,
      memo: memo.trim() ? memo.trim() : null,
      updated_at: now
    }

    await upsertTaskRows(profile.id, [next])
    if (profile.user_id) {
      await enqueueMutation(profile.id, 'tasks', next)
    }

    if (session.value && profile.user_id === session.value.user.id) {
      void syncNow()
    } else {
      updatePassiveStatus()
    }
  }

  async function removeTask(taskId: string) {
    const profile = activeProfile.value
    if (!profile) return
    const current = taskRows.value.find((task) => task.id === taskId)
    if (!current || current.deleted_at) return

    const now = isoNow()
    const next: SyncedTask = {
      ...current,
      device_id: deviceId.value,
      updated_at: now,
      deleted_at: now
    }

    await upsertTaskRows(profile.id, [next])
    if (profile.user_id) {
      await enqueueMutation(profile.id, 'tasks', next)
    }

    if (session.value && profile.user_id === session.value.user.id) {
      void syncNow()
    } else {
      updatePassiveStatus()
    }
  }

  return {
    activeProfileId,
    activeSubjects,
    activeTasks,
    authPending,
    authReady,
    canUseSyncFeatures,
    canSyncNow,
    initialized,
    isConfigured,
    lastSyncedAt,
    linkNotice,
    online,
    session,
    syncError,
    syncMode,
    syncStatus,
    syncStatusLabel,
    taskTypes,
    userEmail,
    initialize,
    sendMagicLink,
    signOut,
    syncNow,
    getSubjectName,
    addSubject,
    removeSubject,
    addTask,
    updateTaskMemo,
    removeTask
  }
}
