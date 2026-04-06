export const taskTypes = ['課題', '試験', '補講'] as const

export type TaskType = (typeof taskTypes)[number]

export type DefaultSubjectTemplate = {
  slug: string
  name: string
  emoji: string
}

export const defaultSubjectTemplates: DefaultSubjectTemplate[] = [
  { slug: 'denji', name: '電子工学', emoji: '📝' },
  { slug: 'yuukagaku', name: '有機化学', emoji: '🧪' },
  { slug: 'eikoku', name: '英語', emoji: '📖' },
  { slug: 'kikaikougaku', name: '機械工学', emoji: '⚙️' }
]

export const emojiOptions = [
  '📝',
  '🧪',
  '📖',
  '⚙️',
  '📐',
  '🎧',
  '🔬',
  '📚',
  '🏫',
  '🧠',
  '🗂️',
  '✅'
]

export type SyncedSubject = {
  id: string
  user_id: string
  device_id: string
  name: string
  emoji: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SyncedTask = {
  id: string
  user_id: string
  device_id: string
  subject_id: string
  date: string
  type: TaskType
  memo: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SyncTable = 'subjects' | 'tasks'

export type ProfileId = 'guest' | `account:${string}`

export type SyncMode = 'guest' | 'local-account' | 'synced'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'local-only' | 'error'

export type OutboxEntry = {
  id: string
  table: SyncTable
  row: SyncedSubject | SyncedTask
  queued_at: string
}

export type ProfileEntry = {
  id: ProfileId
  user_id: string | null
  guest_linked_user_id: string | null
  last_synced_at: string | null
  legacy_imported_at: string | null
  created_at: string
  updated_at: string
}

export type GlobalMetaKey = 'activeProfileId' | 'deviceId'

export type GlobalMetaEntry = {
  key: GlobalMetaKey
  value: string
}

export type LegacySubject = {
  id: string
  name: string
  emoji: string
}

export type LegacyTask = {
  id: string
  date: string
  subjectId: string
  type: TaskType
  memo?: string
}
