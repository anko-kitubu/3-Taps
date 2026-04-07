<template>
  <div class="page-shell">
    <main class="page">
      <header class="header">
        <h1>3-Taps!</h1>
        <button
          ref="syncMenuButton"
          class="menu-btn"
          type="button"
          aria-label="同期メニュー"
          aria-controls="sync-drawer"
          aria-haspopup="dialog"
          :aria-expanded="isSyncMenuOpen"
          @click="toggleSyncMenu"
        >
          <span class="menu-line"></span>
          <span class="menu-line"></span>
          <span class="menu-line"></span>
        </button>
      </header>

      <section v-if="!authReady" class="hero-card">
        <h2>準備中</h2>
        <p>ローカルデータを確認しています。</p>
      </section>

      <template v-else>
        <div class="two-column-layout">
          <div class="column">
            <section class="card">
              <h2>直近の予定</h2>
              <p v-if="upcomingTasks.length === 0" class="task-empty task-empty-upcoming">まだ予定はないよ！</p>
              <ul v-else class="task-list task-list-scroll task-list-scroll-upcoming">
                <li
                  v-for="task in upcomingTasks"
                  :key="task.id"
                  class="task-row"
                  :class="{ 'task-row-today': task.date === todayString }"
                  @click="openMemoModal(task)"
                >
                  <span class="task-text">
                    {{ formatRelative(task.date) }} / {{ getSubjectName(task.subject_id) }}（{{ task.type }}）
                    <span v-if="hasMemo(task)" class="task-badge">詳細あり</span>
                  </span>
                  <button class="small-btn" type="button" @click.stop="removeTaskWithConfirm(task.id)">削除</button>
                </li>
              </ul>
            </section>

            <section class="card">
              <div class="calendar-header">
                <h2>{{ currentYear }}年 {{ currentMonth }}月</h2>
                <div class="calendar-actions">
                  <button class="month-btn" type="button" @click="goPrevMonth">‹</button>
                  <button class="month-btn" type="button" @click="goNextMonth">›</button>
                </div>
              </div>
              <div class="calendar-weekdays">
                <span
                  v-for="(label, index) in weekdayLabels"
                  :key="label"
                  class="weekday"
                  :class="{ 'weekday-sunday': index === 0, 'weekday-saturday': index === 6 }"
                >
                  {{ label }}
                </span>
              </div>
              <div class="calendar">
                <button
                  v-for="(cell, index) in calendarCells"
                  :key="`${currentYear}-${currentMonth}-${index}`"
                  class="day"
                  :class="{
                    'day-selected': cell.day !== null && selectedDay === cell.day,
                    'day-today': cell.day !== null && isCurrentMonth && cell.day === todayDay,
                    'day-empty': cell.day === null
                  }"
                  :disabled="cell.day === null"
                  @click="cell.day !== null && (selectedDay = cell.day)"
                >
                  <span class="day-number">{{ cell.day ?? '' }}</span>
                  <span v-if="cell.types.length" class="day-dots">
                    <span v-for="type in cell.types" :key="type" class="day-dot" :data-type="type"></span>
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div class="column">
            <section class="card">
              <h2>{{ selectedLabel }}</h2>
              <p v-if="selectedDayTasks.length === 0" class="task-empty task-empty-selected">まだ予定はないよ！</p>
              <ul v-else class="task-list task-list-scroll task-list-scroll-selected">
                <li
                  v-for="task in selectedDayTasks"
                  :key="task.id"
                  class="task-row"
                  @click="openMemoModal(task)"
                >
                  <span class="task-text">
                    {{ getSubjectName(task.subject_id) }}（{{ task.type }}）
                    <span v-if="hasMemo(task)" class="task-badge">詳細あり</span>
                  </span>
                </li>
              </ul>
            </section>

            <section class="subjects">
              <div class="subjects-header">
                <h3>科目から予定を追加</h3>
                <button class="small-btn" type="button" @click="openSubjectManageModal">科目を管理</button>
              </div>
              <div class="subject-grid">
                <button
                  v-for="subject in activeSubjects"
                  :key="subject.id"
                  class="subject-btn"
                  type="button"
                  @click="openTypeMenu(subject, $event)"
                >
                  <span class="subject-icon">{{ subject.emoji }}</span>
                  <span class="subject-label">{{ subject.name }}</span>
                </button>
                <button class="subject-btn subject-btn-add" type="button" aria-label="科目を追加" @click="openSubjectModal">
                  ＋
                </button>
              </div>
            </section>
          </div>
        </div>

        <Teleport to="body">
          <div v-if="typeMenuSubject" class="type-menu-overlay" @click="closeTypeMenu"></div>
          <div v-if="typeMenuSubject" class="type-menu-bubble" :style="typeMenuStyle" @click.stop>
            <button
              v-for="taskType in availableTaskTypes"
              :key="taskType"
              class="type-chip"
              type="button"
              :data-type="taskType"
              @click="addTaskForSelectedDate(typeMenuSubject.id, taskType)"
            >
              {{ taskType }}
            </button>
          </div>
        </Teleport>

        <Teleport to="body">
          <Transition name="sync-overlay">
            <div v-if="isSyncMenuOpen" class="sync-drawer-overlay" @click="closeSyncMenu"></div>
          </Transition>
          <Transition name="sync-drawer">
            <aside
              v-if="isSyncMenuOpen"
              ref="syncDrawerPanel"
              id="sync-drawer"
              class="sync-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-drawer-title"
              tabindex="-1"
              @click.stop
            >
              <div class="sync-drawer-shell">
                <div class="sync-drawer-header">
                  <h2 id="sync-drawer-title">同期設定</h2>
                  <button class="icon-btn sync-drawer-close" type="button" aria-label="閉じる" @click="closeSyncMenu">×</button>
                </div>

                <div class="sync-drawer-body">
                  <section class="sync-card sync-card-soft">
                    <div class="sync-card-intro">
                      <span class="sync-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" class="sync-svg-icon" fill="none" stroke="currentColor" stroke-width="1.9">
                          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                          <path d="M4 20a8 8 0 0 1 16 0" />
                        </svg>
                      </span>
                      <div class="sync-card-copy">
                        <h3>アカウント</h3>
                        <p>同期用メールアドレス</p>
                      </div>
                    </div>

                    <label class="field">
                      <span class="field-label">{{ syncFormLabel }}</span>
                      <span class="sync-input-wrap">
                        <span class="sync-input-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" class="sync-svg-icon" fill="none" stroke="currentColor" stroke-width="1.9">
                            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
                            <path d="m5 7 7 5 7-5" />
                          </svg>
                        </span>
                        <input
                          v-if="!session"
                          ref="syncEmailInput"
                          v-model="email"
                          class="text-input sync-account-input sync-account-input-with-icon"
                          type="email"
                          autocomplete="email"
                          :disabled="syncEmailDisabled"
                          placeholder="example@email.com"
                        />
                        <input
                          v-else
                          :value="userEmail || 'メール未取得'"
                          class="text-input sync-account-input sync-account-input-with-icon sync-account-input-readonly"
                          type="email"
                          readonly
                        />
                      </span>
                    </label>
                  </section>

                  <section class="sync-card">
                    <div class="sync-card-header">
                      <h3>同期ステータス</h3>
                      <span
                        v-if="showSyncStatusIndicator"
                        class="sync-status-indicator"
                        :class="`sync-status-indicator-${syncStatus}`"
                        aria-hidden="true"
                      >
                        <svg
                          v-if="syncStatus === 'syncing'"
                          viewBox="0 0 24 24"
                          class="sync-svg-icon sync-spin"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                        >
                          <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                          <path d="M21 3v6h-6" />
                        </svg>
                        <svg
                          v-else-if="syncStatus === 'error'"
                          viewBox="0 0 24 24"
                          class="sync-svg-icon"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v5" />
                          <path d="M12 16h.01" />
                        </svg>
                        <svg
                          v-else-if="showSyncHistoryEntry"
                          viewBox="0 0 24 24"
                          class="sync-svg-icon"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      </span>
                    </div>

                    <div class="sync-status-list">
                      <p class="sync-status-row"><span>最終同期</span><strong>{{ lastSyncedLabel }}</strong></p>
                      <p class="sync-status-row">
                        <span>ステータス</span>
                        <strong class="sync-status-value" :class="`sync-status-value-${syncStatus}`">{{ syncStatusLabel }}</strong>
                      </p>
                    </div>

                    <button
                      class="primary-btn sync-primary-action"
                      type="button"
                      :disabled="syncPrimaryDisabled"
                      @click="handleSyncPrimaryAction"
                    >
                      <span class="sync-primary-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          class="sync-svg-icon"
                          :class="{ 'sync-spin': syncStatus === 'syncing' || authPending }"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                        >
                          <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                          <path d="M21 3v6h-6" />
                        </svg>
                      </span>
                      <span>{{ syncPrimaryLabel }}</span>
                    </button>
                    <p v-if="syncPrimaryNote" class="sync-note sync-status-note">{{ syncPrimaryNote }}</p>
                  </section>

                  <p v-if="linkNotice" class="inline-note">{{ linkNotice }}</p>
                  <p v-if="syncError" class="error-note">{{ syncError }}</p>

                  <section class="sync-history-section">
                    <h3 class="sync-section-title">同期履歴</h3>
                    <div v-if="showSyncHistoryEntry" class="sync-history-entry">
                      <div class="sync-history-copy">
                        <span class="sync-history-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" class="sync-svg-icon" fill="none" stroke="currentColor" stroke-width="1.9">
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                        </span>
                        <span>同期完了</span>
                      </div>
                      <span class="sync-history-time">{{ syncHistoryLabel }}</span>
                    </div>
                    <div v-else class="sync-history-empty">まだ同期履歴がありません</div>
                  </section>

                  <button
                    v-if="showSyncLogoutAction"
                    class="ghost-btn sync-secondary-action danger-btn"
                    type="button"
                    :disabled="authPending"
                    @click="handleSignOut"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            </aside>
          </Transition>
        </Teleport>

        <Teleport to="body">
          <div v-if="isSubjectModalOpen" class="modal-backdrop" @click="closeSubjectModal">
            <div class="modal-dialog" @click.stop>
              <h3>科目を追加</h3>
              <label class="field">
                <span>科目名</span>
                <input v-model="newSubjectName" class="text-input" type="text" placeholder="例）線形代数" />
              </label>
              <div class="field">
                <span>アイコン</span>
                <div class="emoji-grid">
                  <button
                    v-for="emoji in availableEmojiOptions"
                    :key="emoji"
                    class="emoji-btn"
                    :class="{ 'emoji-btn-selected': newSubjectEmoji === emoji }"
                    type="button"
                    @click="newSubjectEmoji = emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
              </div>
              <div class="modal-actions">
                <button class="primary-btn" type="button" :disabled="newSubjectName.trim().length === 0" @click="saveSubject">
                  追加
                </button>
                <button class="small-btn" type="button" @click="closeSubjectModal">キャンセル</button>
              </div>
            </div>
          </div>

          <div v-if="isSubjectManageOpen" class="modal-backdrop" @click="closeSubjectManageModal">
            <div class="modal-dialog" @click.stop>
              <h3>科目を管理</h3>
              <p v-if="activeSubjects.length === 0" class="task-empty">科目がありません</p>
              <ul v-else class="manage-list">
                <li v-for="subject in activeSubjects" :key="subject.id" class="manage-row">
                  <span class="manage-name">
                    <span class="subject-icon manage-icon">{{ subject.emoji }}</span>
                    {{ subject.name }}
                  </span>
                  <button class="small-btn" type="button" @click="removeSubjectWithConfirm(subject.id, subject.name)">
                    削除
                  </button>
                </li>
              </ul>
              <div class="modal-actions">
                <button class="small-btn" type="button" @click="closeSubjectManageModal">閉じる</button>
              </div>
            </div>
          </div>

          <div v-if="isMemoModalOpen" class="modal-backdrop" @click="closeMemoModal">
            <div class="modal-dialog modal-dialog-wide" @click.stop>
              <h3>予定メモ</h3>
              <label class="field">
                <span>メモ</span>
                <textarea
                  v-model="memoDraft"
                  class="text-input memo-input"
                  rows="4"
                  placeholder="例）参考書の第3章まで進める"
                ></textarea>
              </label>
              <div class="modal-actions">
                <button class="primary-btn" type="button" @click="saveMemo">保存</button>
                <button class="small-btn" type="button" @click="closeMemoModal">閉じる</button>
              </div>
            </div>
          </div>
        </Teleport>
      </template>
    </main>

    <BottomNav active="home" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SyncedSubject, SyncedTask, TaskType } from '~/types/sync'
import { emojiOptions, taskTypes as availableTaskTypes } from '~/types/sync'

const {
  activeSubjects,
  activeTasks,
  authPending,
  authReady,
  canUseSyncFeatures,
  canSyncNow,
  initialize,
  isConfigured,
  lastSyncedAt,
  linkNotice,
  sendMagicLink,
  session,
  signOut,
  syncError,
  syncMode,
  syncNow,
  syncStatus,
  syncStatusLabel,
  userEmail,
  getSubjectName,
  addSubject,
  removeSubject,
  addTask,
  updateTaskMemo,
  removeTask
} = useSyncApp()

const availableEmojiOptions = emojiOptions
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

const email = ref('')
const syncMenuButton = ref<HTMLButtonElement | null>(null)
const syncDrawerPanel = ref<HTMLElement | null>(null)
const syncEmailInput = ref<HTMLInputElement | null>(null)
const isSyncMenuOpen = ref(false)
const isSubjectModalOpen = ref(false)
const isSubjectManageOpen = ref(false)
const isMemoModalOpen = ref(false)
const newSubjectName = ref('')
const newSubjectEmoji = ref(availableEmojiOptions[0] ?? '📝')
const memoDraft = ref('')
const memoTaskId = ref<string | null>(null)

const todayRef = ref(new Date())
const currentYear = ref(todayRef.value.getFullYear())
const currentMonth = ref(todayRef.value.getMonth() + 1)
const selectedDay = ref(todayRef.value.getDate())

const todayYear = computed(() => todayRef.value.getFullYear())
const todayMonth = computed(() => todayRef.value.getMonth() + 1)
const todayDay = computed(() => todayRef.value.getDate())
const todayString = computed(
  () =>
    `${todayYear.value}-${String(todayMonth.value).padStart(2, '0')}-${String(todayDay.value).padStart(2, '0')}`
)
const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value, 0).getDate())
const isCurrentMonth = computed(
  () => currentYear.value === todayYear.value && currentMonth.value === todayMonth.value
)
const selectedDateString = computed(
  () =>
    `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
)
const selectedLabel = computed(() => `${currentYear.value}年${currentMonth.value}月${selectedDay.value}日の予定`)
const syncMenuMode = computed(() => {
  if (!isConfigured.value) return 'unconfigured'
  if (!canUseSyncFeatures.value) return 'temporary-local'
  if (session.value) return 'synced'
  if (syncMode.value === 'local-account') return 'local-account'
  return 'guest'
})
const showSyncLoginForm = computed(
  () => !session.value && canUseSyncFeatures.value && (syncMenuMode.value === 'guest' || syncMenuMode.value === 'local-account')
)
const showSyncLogoutAction = computed(() => syncMenuMode.value === 'synced')
const syncEmailDisabled = computed(() => !canUseSyncFeatures.value || authPending.value)
const showSyncStatusIndicator = computed(
  () => syncStatus.value === 'syncing' || syncStatus.value === 'error' || Boolean(lastSyncedAt.value)
)
const syncMenuMessage = computed(() => {
  if (syncMenuMode.value === 'unconfigured') return 'ローカル保存のみ'
  if (syncMenuMode.value === 'temporary-local') return 'このセッションでは同期不可'
  if (syncMenuMode.value === 'local-account') return 'この端末のデータを保持中'
  return ''
})
const syncFormLabel = computed(() =>
  syncMenuMode.value === 'local-account' ? '同じメールアドレスで再ログイン' : 'メールアドレス'
)
const lastSyncedLabel = computed(() => {
  if (!lastSyncedAt.value) return '未同期'
  const date = new Date(lastSyncedAt.value)
  if (Number.isNaN(date.getTime())) return '未同期'
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
})
const syncHistoryLabel = computed(() => {
  if (!lastSyncedAt.value) return ''
  const date = new Date(lastSyncedAt.value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
})
const showSyncHistoryEntry = computed(() => Boolean(lastSyncedAt.value && syncMenuMode.value !== 'unconfigured'))
const syncPrimaryLabel = computed(() => {
  if (authPending.value) return '送信中...'
  if (syncMenuMode.value === 'synced' && syncStatus.value === 'syncing') return '同期中...'
  if (syncMenuMode.value === 'synced' || syncMenuMode.value === 'unconfigured' || syncMenuMode.value === 'temporary-local') return '今すぐ同期'
  if (syncMenuMode.value === 'local-account') return '再ログインして同期'
  return '同期を有効化'
})
const syncPrimaryDisabled = computed(() => {
  if (authPending.value || syncStatus.value === 'syncing') return true
  if (syncMenuMode.value === 'synced') return !canSyncNow.value
  if (syncMenuMode.value === 'guest' || syncMenuMode.value === 'local-account') {
    return !canUseSyncFeatures.value || email.value.trim().length === 0
  }
  return true
})
const syncPrimaryNote = computed(() => {
  if (syncMenuMode.value === 'unconfigured' || syncMenuMode.value === 'temporary-local') return syncMenuMessage.value
  if (syncMenuMode.value === 'guest' && !email.value.trim()) return 'メールアドレスを入力してください'
  if (syncMenuMode.value === 'local-account' && !email.value.trim()) return '同じメールアドレスを入力してください'
  return syncMenuMessage.value || ''
})

const upcomingTasks = computed(() =>
  [...activeTasks.value]
    .filter((task) => task.date >= todayString.value)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
)
const selectedDayTasks = computed(() =>
  activeTasks.value.filter((task) => task.date === selectedDateString.value)
)

const taskTypeByDate = computed(() => {
  const map = new Map<string, Set<TaskType>>()
  for (const task of activeTasks.value) {
    if (!map.has(task.date)) map.set(task.date, new Set())
    map.get(task.date)?.add(task.type)
  }
  return map
})

const calendarCells = computed(() => {
  const firstWeekday = new Date(currentYear.value, currentMonth.value - 1, 1).getDay()
  const blanks = Array.from({ length: firstWeekday }, () => ({ day: null, types: [] as TaskType[] }))
  const days = Array.from({ length: daysInMonth.value }, (_, index) => {
    const day = index + 1
    const date = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { day, types: Array.from(taskTypeByDate.value.get(date) ?? []) }
  })
  return [...blanks, ...days]
})

const typeMenuSubject = ref<SyncedSubject | null>(null)
const typeMenuPosition = ref<{ top: number; left: number; placement: 'right' | 'left' } | null>(null)
const typeMenuStyle = computed(() => {
  if (!typeMenuPosition.value) return {}
  const { top, left, placement } = typeMenuPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    transform:
      placement === 'right' ? 'translate(8px, -50%)' : 'translate(calc(-100% - 8px), -50%)'
  }
})

const MS_PER_DAY = 24 * 60 * 60 * 1000
const todayUtcDay = computed(() => Date.UTC(todayYear.value, todayMonth.value - 1, todayDay.value))
let todayTimer: ReturnType<typeof setTimeout> | null = null

watch([currentYear, currentMonth], () => {
  if (selectedDay.value > daysInMonth.value) selectedDay.value = daysInMonth.value
})

watch(isSyncMenuOpen, async (isOpen) => {
  if (!isOpen) {
    removeSyncDrawerListeners()
    return
  }

  await nextTick()
  focusSyncDrawer()
  window.addEventListener('keydown', handleSyncMenuKeydown)
})

onMounted(() => {
  void initialize()
  scheduleTodayRefresh()
})

onBeforeUnmount(() => {
  if (todayTimer) clearTimeout(todayTimer)
  removeSyncDrawerListeners()
})

function removeSyncDrawerListeners() {
  window.removeEventListener('keydown', handleSyncMenuKeydown)
}

function focusSyncDrawer() {
  if (showSyncLoginForm.value) {
    syncEmailInput.value?.focus()
    return
  }
  syncDrawerPanel.value?.focus()
}

function handleSyncMenuKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  closeSyncMenu()
  syncMenuButton.value?.focus()
}

function scheduleTodayRefresh() {
  if (todayTimer) clearTimeout(todayTimer)
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  todayTimer = setTimeout(() => {
    todayRef.value = new Date()
    scheduleTodayRefresh()
  }, next.getTime() - now.getTime() + 1000)
}

function formatRelative(dateStr: string) {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const targetUtc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const diffDays = Math.round((targetUtc - todayUtcDay.value) / MS_PER_DAY)
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '明日'
  if (diffDays > 1 && diffDays <= 7) return `あと${diffDays}日`
  return dateStr
}

function hasMemo(task: SyncedTask) {
  return Boolean(task.memo && task.memo.trim())
}

function toggleSyncMenu() {
  if (isSyncMenuOpen.value) {
    closeSyncMenu()
    return
  }
  closeTypeMenu()
  isSyncMenuOpen.value = true
}

function closeSyncMenu() {
  isSyncMenuOpen.value = false
}

function goPrevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value -= 1
  } else {
    currentMonth.value -= 1
  }
}

function goNextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value += 1
  } else {
    currentMonth.value += 1
  }
}

function openTypeMenu(subject: SyncedSubject, event: MouseEvent) {
  closeSyncMenu()
  const target = event.currentTarget as HTMLElement | null
  if (target) {
    const rect = target.getBoundingClientRect()
    const bubbleWidth = 140
    const spaceRight = window.innerWidth - rect.right
    const placement = spaceRight < bubbleWidth && rect.left > spaceRight ? 'left' : 'right'
    typeMenuPosition.value = {
      top: rect.top + rect.height / 2,
      left: placement === 'right' ? rect.right : rect.left,
      placement
    }
  }
  typeMenuSubject.value = subject
}

function closeTypeMenu() {
  typeMenuSubject.value = null
  typeMenuPosition.value = null
}

function addTaskForSelectedDate(subjectId: string, taskType: TaskType) {
  void addTask(subjectId, selectedDateString.value, taskType)
  closeTypeMenu()
}

function openSubjectModal() {
  closeSyncMenu()
  closeTypeMenu()
  isSubjectManageOpen.value = false
  isSubjectModalOpen.value = true
  newSubjectName.value = ''
  newSubjectEmoji.value = availableEmojiOptions[0] ?? '📝'
}

function closeSubjectModal() {
  isSubjectModalOpen.value = false
}

function saveSubject() {
  if (!newSubjectName.value.trim()) return
  void addSubject(newSubjectName.value, newSubjectEmoji.value)
  closeSubjectModal()
}

function openSubjectManageModal() {
  closeSyncMenu()
  closeTypeMenu()
  closeSubjectModal()
  isSubjectManageOpen.value = true
}

function closeSubjectManageModal() {
  isSubjectManageOpen.value = false
}

function removeSubjectWithConfirm(subjectId: string, subjectName: string) {
  if (!confirm(`「${subjectName}」を削除しますか？（既存の予定は残ります）`)) return
  void removeSubject(subjectId)
}

function openMemoModal(task: SyncedTask) {
  closeSyncMenu()
  closeTypeMenu()
  memoTaskId.value = task.id
  memoDraft.value = task.memo ?? ''
  isMemoModalOpen.value = true
}

function closeMemoModal() {
  isMemoModalOpen.value = false
  memoTaskId.value = null
  memoDraft.value = ''
}

function saveMemo() {
  if (!memoTaskId.value) return
  void updateTaskMemo(memoTaskId.value, memoDraft.value)
  closeMemoModal()
}

function removeTaskWithConfirm(taskId: string) {
  if (!confirm('この予定を削除しますか？')) return
  void removeTask(taskId)
}

function submitMagicLink() {
  if (!email.value.trim()) return
  void sendMagicLink(email.value)
}

function handleSyncPrimaryAction() {
  if (syncPrimaryDisabled.value) return
  if (syncMenuMode.value === 'synced') {
    void syncNow()
    return
  }
  submitMagicLink()
}

function handleSignOut() {
  closeSyncMenu()
  void signOut()
}
</script>

<style scoped>
:global(:root) {
  --app-ink: #1f1f1f;
  --app-muted: #6f6f6f;
  --app-border: #dddddd;
  --app-surface: #ffffff;
  --app-surface-muted: #f6f6f6;
  --app-accent: #f2a15a;
  --app-accent-strong: #e57f32;
  --app-accent-soft: #fff0e2;
}

.page-shell {
  min-height: 100svh;
}

.page {
  max-width: 480px;
  min-height: 100svh;
  margin: 0 auto;
  padding: calc(18px + env(safe-area-inset-top)) 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'M PLUS Rounded 1c', 'Noto Sans JP', 'Yu Gothic UI', sans-serif;
  color: var(--app-ink);
}

.header,
.calendar-header,
.subjects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header h1 {
  font-size: 18px;
  letter-spacing: 0.02em;
}

.hero-card,
.card {
  padding: 12px 16px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}

.hero-card h2,
.card h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-card p,
.field span,
.task-empty,
.sync-note {
  margin: 0;
  font-size: 12px;
  color: var(--app-muted);
}

.menu-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  appearance: none;
}

.menu-line {
  display: block;
  width: 18px;
  height: 1.5px;
  border-radius: 999px;
  background: var(--app-ink);
}

.menu-btn:focus-visible,
.month-btn:focus-visible,
.subject-btn:focus-visible,
.small-btn:focus-visible,
.ghost-btn:focus-visible,
.primary-btn:focus-visible,
.icon-btn:focus-visible,
.text-input:focus-visible,
.emoji-btn:focus-visible {
  outline: 2px solid var(--app-accent-strong);
  outline-offset: 2px;
}

.two-column-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.calendar-actions,
.modal-actions {
  display: flex;
  gap: 8px;
}

.calendar-weekdays,
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-weekdays {
  margin-bottom: 6px;
  text-align: center;
  font-size: 10px;
  color: var(--app-muted);
  letter-spacing: 0.04em;
}

.weekday {
  padding: 2px 0;
}

.weekday-sunday {
  color: #e06b6b;
}

.weekday-saturday {
  color: #5a8fd8;
}

.calendar {
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
}

.month-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-ink);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.day {
  min-height: 32px;
  margin: -1px 0 0 -1px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  font-size: 12px;
}

.day-number {
  line-height: 1;
}

.day-empty {
  cursor: default;
  color: transparent;
}

.day-selected {
  background: var(--app-accent-soft);
  color: var(--app-accent-strong);
  font-weight: 700;
  box-shadow: inset 0 0 0 2px var(--app-accent);
}

.day-today {
  box-shadow: inset 0 0 0 2px #7cc7ff;
  font-weight: 600;
}

.day-selected.day-today {
  box-shadow: inset 0 0 0 2px var(--app-accent), inset 0 0 0 4px #7cc7ff;
}

.day-dots {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 3px;
}

.day-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #bdbdbd;
}

.day-dot[data-type='課題'] {
  background: #4da3ff;
}

.day-dot[data-type='試験'] {
  background: #ff6b6b;
}

.day-dot[data-type='補講'] {
  background: #f2c94c;
}

.subjects {
  margin-bottom: 40px;
}

.subjects-header h3 {
  margin: 0;
  font-size: 14px;
}

.subject-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.subject-btn {
  padding: 10px 6px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--app-ink);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.05);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.subject-btn-add {
  font-size: 22px;
}

.subject-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface-muted);
  font-size: 16px;
}

.subject-label {
  line-height: 1.3;
}

.task-list,
.manage-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-list-scroll {
  overflow-y: auto;
  padding-right: 4px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.task-list-scroll-upcoming {
  min-height: 150px;
  max-height: 150px;
}

.task-list-scroll-selected {
  min-height: 80px;
  max-height: 80px;
}

.task-empty-upcoming {
  min-height: 150px;
  display: flex;
  align-items: center;
}

.task-empty-selected {
  min-height: 80px;
  display: flex;
  align-items: center;
}

.task-row,
.manage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
  font-size: 12px;
}

.task-row {
  cursor: pointer;
}

.task-row-today {
  border-color: #7cc7ff;
  background: #e9f6ff;
}

.task-text {
  flex: 1;
}

.task-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  border: 1px solid #bfe2ff;
  border-radius: 999px;
  background: #e9f6ff;
  color: #2f6fb3;
  font-size: 10px;
}

.manage-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.manage-icon {
  flex: none;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  color: var(--app-muted);
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
  font-size: 13px;
  color: var(--app-ink);
}

.memo-input {
  min-height: 96px;
  resize: vertical;
}

.primary-btn,
.ghost-btn,
.small-btn,
.icon-btn,
.type-chip,
.emoji-btn {
  border: 1px solid var(--app-border);
  background: var(--app-surface-muted);
  color: var(--app-ink);
  cursor: pointer;
}

.primary-btn,
.ghost-btn,
.small-btn {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
}

.primary-btn {
  border-color: var(--app-accent);
  background: var(--app-accent-soft);
  color: var(--app-accent-strong);
}

.danger-btn {
  color: #a44;
}

.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  font-size: 18px;
  line-height: 1;
}

.sync-overlay-enter-active,
.sync-overlay-leave-active {
  transition: opacity 300ms ease;
}

.sync-overlay-enter-from,
.sync-overlay-leave-to {
  opacity: 0;
}

.sync-overlay-enter-to,
.sync-overlay-leave-from {
  opacity: 1;
}

.sync-drawer-enter-active,
.sync-drawer-leave-active {
  transition: transform 300ms ease, opacity 300ms ease;
}

.sync-drawer-enter-from,
.sync-drawer-leave-to {
  opacity: 0.98;
  transform: translateX(100%);
}

.sync-drawer-enter-to,
.sync-drawer-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.sync-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(24, 24, 28, 0.5);
}

.sync-drawer-panel {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 60;
  width: min(420px, 100vw);
  height: 100svh;
  background: var(--app-surface);
  box-shadow: -20px 0 44px rgba(0, 0, 0, 0.18);
  will-change: transform;
}

.sync-drawer-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sync-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: calc(20px + env(safe-area-inset-top)) 16px 16px;
  border-bottom: 1px solid #e7e7ea;
}

.sync-drawer-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sync-drawer-close {
  flex: none;
  background: var(--app-surface);
}

.sync-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 16px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sync-card {
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.05);
}

.sync-card-soft {
  background: #f7f9fc;
}

.sync-card-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.sync-card-icon {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 999px;
  background: #e7f0ff;
  color: #4f7fcc;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 700;
}

.sync-card-copy h3,
.sync-section-title,
.sync-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-ink);
}

.sync-card-copy p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--app-muted);
}

.sync-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sync-status-indicator,
.sync-history-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--app-muted);
}

.sync-status-indicator-syncing {
  color: #2f6fb3;
}

.sync-status-indicator-error {
  color: #c44;
}

.sync-status-indicator-idle,
.sync-status-indicator-local-only,
.sync-status-indicator-offline {
  color: #2b8a57;
}

.sync-svg-icon {
  width: 1em;
  height: 1em;
  display: block;
}

.sync-spin {
  animation: sync-spin 0.9s linear infinite;
}

@keyframes sync-spin {
  to {
    transform: rotate(360deg);
  }
}

.sync-account-input,
.sync-primary-action,
.sync-secondary-action {
  min-height: 48px;
}

.sync-input-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.sync-input-icon {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: #8b8f98;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.sync-account-input {
  border-radius: 14px;
  background: var(--app-surface);
  padding-left: 40px;
}

.sync-account-input-readonly {
  color: var(--app-muted);
}

.sync-status-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 12px;
  border-top: 1px solid #ededed;
  border-bottom: 1px solid #ededed;
}

.sync-status-row {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 0;
  font-size: 13px;
  color: var(--app-muted);
  border-top: 1px solid #ededed;
}

.sync-status-row:first-child {
  border-top: none;
}

.sync-status-row strong {
  color: var(--app-ink);
  font-weight: 600;
  text-align: right;
}

.sync-status-value-syncing {
  color: #2f6fb3;
}

.sync-status-value-error {
  color: #c44;
}

.sync-primary-action {
  margin-top: 16px;
  width: 100%;
  border-radius: 14px;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sync-primary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sync-status-note {
  margin-top: 12px;
  text-align: center;
  color: #d86f15;
}

.sync-history-section {
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid #e7e7ea;
}

.sync-history-empty {
  margin-top: 14px;
  min-height: 44px;
  padding: 12px;
  border-radius: 14px;
  background: var(--app-surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-muted);
  font-size: 13px;
}

.sync-history-entry {
  margin-top: 14px;
  padding: 12px;
  border-radius: 14px;
  background: #eef8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--app-ink);
}

.sync-history-copy {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sync-history-icon {
  color: #2b8a57;
}

.sync-history-time {
  color: var(--app-muted);
  font-size: 12px;
}

.sync-secondary-action {
  width: 100%;
  margin-top: auto;
  border-radius: 14px;
  background: var(--app-surface-muted);
}

.inline-note,
.error-note {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
}

.inline-note {
  border: 1px solid #cde4ff;
  background: #eef7ff;
  color: #2f6fb3;
}

.error-note {
  border: 1px solid #f3c9c9;
  background: #fff2f2;
  color: #a44;
}

.type-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.08);
}

.type-menu-bubble {
  position: fixed;
  z-index: 35;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.type-chip {
  min-width: 72px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--app-surface);
  font-size: 12px;
}

.type-chip[data-type='課題'] {
  border-color: #4da3ff;
}

.type-chip[data-type='試験'] {
  border-color: #ff6b6b;
}

.type-chip[data-type='補講'] {
  border-color: #f2c94c;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  padding: 20px 16px calc(96px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
}

.modal-dialog {
  width: min(320px, 100%);
  max-height: min(72svh, 560px);
  overflow-y: auto;
  padding: 18px 16px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-dialog-wide {
  width: min(360px, 100%);
}

.modal-dialog h3 {
  margin: 0;
  font-size: 15px;
}

.modal-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.emoji-btn {
  padding: 6px 0;
  border-radius: 10px;
  font-size: 16px;
}

.emoji-btn-selected {
  border-color: var(--app-accent);
  background: var(--app-accent-soft);
}

@media (hover: hover) and (pointer: fine) {
  .subject-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  }
}

@media (min-width: 520px) {
  .page {
    margin: 24px auto;
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  }
}

@media (min-width: 900px) {
  .page {
    max-width: 980px;
  }

  .two-column-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
}
</style>
