import type {
  GlobalMetaEntry,
  GlobalMetaKey,
  OutboxEntry,
  ProfileEntry,
  ProfileId,
  SyncedSubject,
  SyncedTask
} from '~/types/sync'

const DB_NAME = 'three-taps-sync'
const DB_VERSION = 2

const META_STORE = 'meta'
const PROFILES_STORE = 'profiles'
const PROFILE_SUBJECTS_STORE = 'profile-subjects'
const PROFILE_TASKS_STORE = 'profile-tasks'
const PROFILE_OUTBOX_STORE = 'profile-outbox'

const LEGACY_META_STORE = 'meta'
const LEGACY_SUBJECTS_STORE = 'subjects'
const LEGACY_TASKS_STORE = 'tasks'
const LEGACY_OUTBOX_STORE = 'outbox'

type LegacyMetaKey = 'currentUserId' | 'lastSyncedAt' | 'legacyImportedUserId'

type LegacyMetaEntry = {
  key: LegacyMetaKey
  value: string
}

type StoredSubjectRow = SyncedSubject & {
  profile_id: ProfileId
  storage_id: string
}

type StoredTaskRow = SyncedTask & {
  profile_id: ProfileId
  storage_id: string
}

type StoredOutboxEntry = OutboxEntry & {
  profile_id: ProfileId
  storage_id: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

function subjectStorageId(profileId: ProfileId, rowId: string) {
  return `${profileId}:subject:${rowId}`
}

function taskStorageId(profileId: ProfileId, rowId: string) {
  return `${profileId}:task:${rowId}`
}

function outboxStorageId(profileId: ProfileId, entryId: string) {
  return `${profileId}:outbox:${entryId}`
}

function stripSubjectRow(row: StoredSubjectRow): SyncedSubject {
  const { profile_id: _profileId, storage_id: _storageId, ...subject } = row
  return subject
}

function stripTaskRow(row: StoredTaskRow): SyncedTask {
  const { profile_id: _profileId, storage_id: _storageId, ...task } = row
  return task
}

function stripOutboxEntry(row: StoredOutboxEntry): OutboxEntry {
  const { profile_id: _profileId, storage_id: _storageId, ...entry } = row
  return entry
}

function toStoredSubjectRow(profileId: ProfileId, row: SyncedSubject): StoredSubjectRow {
  return {
    ...row,
    profile_id: profileId,
    storage_id: subjectStorageId(profileId, row.id)
  }
}

function toStoredTaskRow(profileId: ProfileId, row: SyncedTask): StoredTaskRow {
  return {
    ...row,
    profile_id: profileId,
    storage_id: taskStorageId(profileId, row.id)
  }
}

function toStoredOutboxEntry(profileId: ProfileId, entry: OutboxEntry): StoredOutboxEntry {
  return {
    ...entry,
    profile_id: profileId,
    storage_id: outboxStorageId(profileId, entry.id)
  }
}

async function getDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(PROFILE_SUBJECTS_STORE)) {
        const store = db.createObjectStore(PROFILE_SUBJECTS_STORE, { keyPath: 'storage_id' })
        store.createIndex('by_profile_id', 'profile_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(PROFILE_TASKS_STORE)) {
        const store = db.createObjectStore(PROFILE_TASKS_STORE, { keyPath: 'storage_id' })
        store.createIndex('by_profile_id', 'profile_id', { unique: false })
      }

      if (!db.objectStoreNames.contains(PROFILE_OUTBOX_STORE)) {
        const store = db.createObjectStore(PROFILE_OUTBOX_STORE, { keyPath: 'storage_id' })
        store.createIndex('by_profile_id', 'profile_id', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'))
  })
  return dbPromise
}

async function getAllFromStore<T>(storeName: string) {
  const db = await getDb()
  if (!db.objectStoreNames.contains(storeName)) return [] as T[]
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const result = await requestToPromise(store.getAll() as IDBRequest<T[]>)
  await transactionDone(tx)
  return result
}

async function getAllByProfile<T>(storeName: string, profileId: ProfileId) {
  const db = await getDb()
  if (!db.objectStoreNames.contains(storeName)) return [] as T[]
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const index = store.index('by_profile_id')
  const result = await requestToPromise(index.getAll(IDBKeyRange.only(profileId)) as IDBRequest<T[]>)
  await transactionDone(tx)
  return result
}

async function putMany<T>(storeName: string, rows: T[]) {
  if (rows.length === 0) return
  const db = await getDb()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  for (const row of rows) {
    store.put(row)
  }
  await transactionDone(tx)
}

async function deleteByProfile(storeName: string, profileId: ProfileId) {
  const db = await getDb()
  if (!db.objectStoreNames.contains(storeName)) return
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  const index = store.index('by_profile_id')

  await new Promise<void>((resolve, reject) => {
    const request = index.openKeyCursor(IDBKeyRange.only(profileId))
    request.onerror = () => reject(request.error ?? new Error('Failed to iterate IndexedDB keys.'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      store.delete(cursor.primaryKey)
      cursor.continue()
    }
  })

  await transactionDone(tx)
}

async function getLegacyMetaValue(key: LegacyMetaKey) {
  const db = await getDb()
  if (!db.objectStoreNames.contains(LEGACY_META_STORE)) return null
  const tx = db.transaction(LEGACY_META_STORE, 'readonly')
  const result = await requestToPromise(
    tx.objectStore(LEGACY_META_STORE).get(key) as IDBRequest<LegacyMetaEntry | undefined>
  )
  await transactionDone(tx)
  return result?.value ?? null
}

export async function migrateLegacyFlatState() {
  const existingProfiles = await getAllFromStore<ProfileEntry>(PROFILES_STORE)
  if (existingProfiles.length > 0) return

  const [legacySubjects, legacyTasks, legacyOutbox, legacyCurrentUserId, legacyLastSyncedAt, legacyImportedUserId] =
    await Promise.all([
      getAllFromStore<SyncedSubject>(LEGACY_SUBJECTS_STORE),
      getAllFromStore<SyncedTask>(LEGACY_TASKS_STORE),
      getAllFromStore<OutboxEntry>(LEGACY_OUTBOX_STORE),
      getLegacyMetaValue('currentUserId'),
      getLegacyMetaValue('lastSyncedAt'),
      getLegacyMetaValue('legacyImportedUserId')
    ])

  const hasLegacyState =
    legacySubjects.length > 0 ||
    legacyTasks.length > 0 ||
    legacyOutbox.length > 0 ||
    Boolean(legacyCurrentUserId) ||
    Boolean(legacyLastSyncedAt) ||
    Boolean(legacyImportedUserId)

  if (!hasLegacyState) return

  const profileId = (legacyCurrentUserId
    ? `account:${legacyCurrentUserId}`
    : 'guest') as ProfileId
  const timestamp = new Date().toISOString()

  await putProfile({
    id: profileId,
    user_id: legacyCurrentUserId,
    guest_linked_user_id: legacyImportedUserId,
    last_synced_at: legacyLastSyncedAt,
    legacy_imported_at: legacyImportedUserId ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp
  })

  await Promise.all([
    putSubjects(profileId, legacySubjects),
    putTasks(profileId, legacyTasks),
    Promise.all(legacyOutbox.map((entry) => putOutboxEntry(profileId, entry)))
  ])

  await setActiveProfileId(profileId)
}

export async function loadProfiles() {
  return getAllFromStore<ProfileEntry>(PROFILES_STORE)
}

export async function getProfile(profileId: ProfileId) {
  const db = await getDb()
  const tx = db.transaction(PROFILES_STORE, 'readonly')
  const result = await requestToPromise(
    tx.objectStore(PROFILES_STORE).get(profileId) as IDBRequest<ProfileEntry | undefined>
  )
  await transactionDone(tx)
  return result ?? null
}

export async function putProfile(profile: ProfileEntry) {
  await putMany(PROFILES_STORE, [profile])
}

export async function loadSubjects(profileId: ProfileId) {
  const rows = await getAllByProfile<StoredSubjectRow>(PROFILE_SUBJECTS_STORE, profileId)
  return rows.map(stripSubjectRow)
}

export async function loadTasks(profileId: ProfileId) {
  const rows = await getAllByProfile<StoredTaskRow>(PROFILE_TASKS_STORE, profileId)
  return rows.map(stripTaskRow)
}

export async function putSubjects(profileId: ProfileId, rows: SyncedSubject[]) {
  await putMany(
    PROFILE_SUBJECTS_STORE,
    rows.map((row) => toStoredSubjectRow(profileId, row))
  )
}

export async function putTasks(profileId: ProfileId, rows: SyncedTask[]) {
  await putMany(
    PROFILE_TASKS_STORE,
    rows.map((row) => toStoredTaskRow(profileId, row))
  )
}

export async function loadOutbox(profileId: ProfileId) {
  const rows = await getAllByProfile<StoredOutboxEntry>(PROFILE_OUTBOX_STORE, profileId)
  return rows.map(stripOutboxEntry).sort((a, b) => a.queued_at.localeCompare(b.queued_at))
}

export async function putOutboxEntry(profileId: ProfileId, entry: OutboxEntry) {
  await putMany(PROFILE_OUTBOX_STORE, [toStoredOutboxEntry(profileId, entry)])
}

export async function deleteOutboxEntry(profileId: ProfileId, id: string) {
  const db = await getDb()
  const tx = db.transaction(PROFILE_OUTBOX_STORE, 'readwrite')
  tx.objectStore(PROFILE_OUTBOX_STORE).delete(outboxStorageId(profileId, id))
  await transactionDone(tx)
}

export async function clearProfileData(profileId: ProfileId) {
  await Promise.all([
    deleteByProfile(PROFILE_SUBJECTS_STORE, profileId),
    deleteByProfile(PROFILE_TASKS_STORE, profileId),
    deleteByProfile(PROFILE_OUTBOX_STORE, profileId)
  ])
}

export async function getGlobalMetaValue(key: GlobalMetaKey) {
  const db = await getDb()
  const tx = db.transaction(META_STORE, 'readonly')
  const result = await requestToPromise(
    tx.objectStore(META_STORE).get(key) as IDBRequest<GlobalMetaEntry | undefined>
  )
  await transactionDone(tx)
  return result?.value ?? null
}

export async function setGlobalMetaValue(key: GlobalMetaKey, value: string) {
  const db = await getDb()
  const tx = db.transaction(META_STORE, 'readwrite')
  tx.objectStore(META_STORE).put({ key, value } satisfies GlobalMetaEntry)
  await transactionDone(tx)
}

export async function getActiveProfileId() {
  const value = await getGlobalMetaValue('activeProfileId')
  return (value as ProfileId | null) ?? null
}

export async function setActiveProfileId(profileId: ProfileId) {
  await setGlobalMetaValue('activeProfileId', profileId)
}
