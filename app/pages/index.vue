<template>
  <div class="page-shell">
  <main class="page">
    <header class="header">
      <h1>3-Taps!</h1>
      <button
        class="menu-toggle"
        type="button"
        aria-label="共有設定を開く"
        aria-controls="share-panel"
        :aria-expanded="isSharePanelOpen"
        @click="toggleSharePanel"
      >
        <span class="menu-bar"></span>
        <span class="menu-bar"></span>
        <span class="menu-bar"></span>
      </button>
    </header>

    <!-- 共有コードパネル -->
    <Teleport to="body">
      <div v-if="isSharePanelOpen" class="share-panel-overlay" @click="closeSharePanel"></div>
      <aside
        v-if="isSharePanelOpen"
        id="share-panel"
        class="share-panel"
        role="dialog"
        aria-modal="true"
        aria-label="共有設定"
        @click.stop
      >
        <div class="share-panel-header">
          <h2 class="share-panel-title">共有コード</h2>
          <div class="share-panel-actions">
            <button class="share-generate" type="button" :disabled="!shareEnabled" @click="regenerateShareCode">
              再生成
            </button>
            <button class="share-close" type="button" aria-label="閉じる" @click="closeSharePanel">×</button>
          </div>
        </div>
        <p v-if="!shareEnabled" class="share-hint">共有機能は現在停止中です。</p>
        <div class="share-code">
          <label class="share-label" for="share-code-input">共有コード</label>
          <div class="share-controls">
            <input
              id="share-code-input"
              v-model="shareCodeInput"
              class="share-input"
              type="text"
              inputmode="text"
              placeholder="例）AB12CD34"
              autocomplete="off"
              :disabled="!shareEnabled"
            />
            <button
              class="share-apply"
              type="button"
              :disabled="!shareEnabled || shareCodeInput.trim().length === 0"
              @click="applyShareCode"
            >
              設定
            </button>
          </div>
          <p v-if="shareEnabled" class="share-hint">
            このコードを友だちに共有すると、直近の予定が表示されます。
          </p>
        </div>
      </aside>
    </Teleport>

    <!-- 直近の予定 -->
    <section class="card">
      <h2>直近の予定</h2>
      <p v-if="upcomingTasks.length === 0">まだ予定はないよ！</p>
      <ul v-else class="taskList taskList-scroll taskList-scroll-upcoming">
        <li
          v-for="task in upcomingTasks"
          :key="task.id"
          class="taskRow"
          :class="{ todayTask: task.date === todayString }"
          @click="openMemoModal(task)"
        >
          <span class="taskText">
            {{ formatRelative(task.date) }} / {{ getSubjectName(task.subjectId) }}（{{ task.type }}）
            <span v-if="hasMemo(task)" class="taskBadge">詳細あり</span>
          </span>
          <button v-if="ownedTaskIds.has(task.id)" class="deleteBtn" @click.stop="removeTask(task.id)">削除</button>
        </li>
      </ul>

    </section>

    <!-- カレンダー -->
    <section class="card">
      <div class="calendar-header">
        <h2>{{ currentYear }}年 {{ currentMonth }}月</h2>
        <div class="calendar-actions">
          <button class="month-btn" type="button" @click="goPrevMonth">?</button>
          <button class="month-btn" type="button" @click="goNextMonth">?</button>
        </div>
      </div>
      <div class="calendar-weekdays">
        <span v-for="(label, index) in weekdayLabels" :key="label"
          class="weekday" :class="{ sunday: index === 0, saturday: index === 6 }">
          {{ label }}
        </span>
      </div>
      <div class="calendar">
        <button v-for="(cell, index) in calendarCells" :key="`${currentYear}-${currentMonth}-${index}`" class="day"
          :class="{
            selected: cell.day !== null && selectedDay === cell.day,
            today: cell.day !== null && isCurrentMonth && cell.day === todayDay,
            empty: cell.day === null
          }" :disabled="cell.day === null" @click="cell.day !== null && (selectedDay = cell.day)">
          <span class="day-number">{{ cell.day ?? '' }}</span>
          <span v-if="cell.types.length" class="day-dots">
            <span v-for="type in cell.types" :key="type" class="day-dot" :data-type="type"></span>
          </span>
        </button>
      </div>
    </section>

    <!-- 選択した日の予定 -->
    <section class="card">
      <h2>{{ selectedLabel }}</h2>
      <p v-if="selectedDayTasks.length === 0">まだ予定はないよ！</p>
      <ul v-else class="taskList taskList-scroll taskList-scroll-selected">
        <li v-for="task in selectedDayTasks" :key="task.id" class="taskRow" @click="openMemoModal(task)">
          <span class="taskText">
            {{ getSubjectName(task.subjectId) }}（{{ task.type }}）
            <span v-if="hasMemo(task)" class="taskBadge">詳細あり</span>
          </span>
        </li>
      </ul>
    </section>

    <!-- 科目アイコン -->
    <section class="subjects">
      <div class="subjects-header">
        <h3>科目から予定を追加</h3>
        <button class="manage-link" type="button" @click="openSubjectManageModal">科目を管理</button>
      </div>
      <div class="subject-grid">
        <button v-for="subject in subjects" :key="subject.id" class="subject-btn"
          @click="openTypeMenu(subject, $event)">
          <span class="icon">{{ subject.emoji }}</span>
          <span class="label">{{ subject.name }}</span>
        </button>

        <button class="subject-btn add" type="button" aria-label="科目を追加" @click="openSubjectModal">
          ＋
        </button>
      </div>
    </section>

    <!-- 種別選択バブル -->
    <Teleport to="body">
      <div v-if="typeMenuSubject" class="type-menu-overlay" @click="closeTypeMenu"></div>
      <div v-if="typeMenuSubject" class="type-menu-bubble" :style="typeMenuStyle" @click.stop>
        <button v-for="t in taskTypes" :key="t" class="type-chip" type="button" :data-type="t"
          @click="addTask(typeMenuSubject, t)">
          {{ t }}
        </button>
      </div>
    </Teleport>

    <!-- 科目追加モーダル -->
    <div v-if="isSubjectModalOpen" class="subject-menu-backdrop" @click="closeSubjectModal">
      <div class="subject-menu" @click.stop>
        <h3>科目を追加</h3>
        <label class="subject-field">
          <span class="subject-label">科目名</span>
          <input v-model="newSubjectName" class="subject-input" type="text" placeholder="例）線形代数" />
        </label>
        <div class="subject-field">
          <span class="subject-label">アイコン</span>
          <div class="emoji-grid">
            <button
              v-for="emoji in emojiOptions"
              :key="emoji"
              class="emoji-btn"
              :class="{ selected: newSubjectEmoji === emoji }"
              type="button"
              @click="newSubjectEmoji = emoji"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
        <div class="subject-actions">
          <button class="primary" type="button" :disabled="newSubjectName.trim().length === 0" @click="addSubject">
            追加
          </button>
          <button class="cancel" type="button" @click="closeSubjectModal">キャンセル</button>
        </div>
      </div>
    </div>

    <!-- 科目管理モーダル -->
    <div v-if="isSubjectManageOpen" class="subject-manage-backdrop" @click="closeSubjectManageModal">
      <div class="subject-manage" @click.stop>
        <h3>科目を管理</h3>
        <p v-if="subjects.length === 0" class="manage-empty">科目がありません</p>
        <ul v-else class="manage-list">
          <li v-for="subject in subjects" :key="subject.id" class="manage-row">
            <span class="manage-name">
              <span class="icon">{{ subject.emoji }}</span>
              {{ subject.name }}
            </span>
            <button class="manage-delete" type="button" @click="removeSubject(subject.id)">削除</button>
          </li>
        </ul>
        <div class="subject-actions">
          <button class="cancel" type="button" @click="closeSubjectManageModal">閉じる</button>
        </div>
      </div>
    </div>
    <!-- 予定メモモーダル -->
    <div v-if="isMemoModalOpen" class="memo-modal-backdrop" @click="closeMemoModal">
      <div class="memo-modal" @click.stop>
        <h3>予定メモ</h3>
        <label class="memo-field">
          <span class="memo-label">メモ</span>
          <textarea
            v-model="memoDraft"
            class="memo-input"
            rows="4"
            placeholder="例）参考書の第3章まで進める"
          ></textarea>
        </label>
        <div class="subject-actions">
          <button class="primary" type="button" @click="saveMemo">保存</button>
          <button class="cancel" type="button" @click="closeMemoModal">閉じる</button>
        </div>
      </div>
    </div>
  </main>
  <BottomNav active="home" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { createClient } from '@supabase/supabase-js'

// 日付の基準値
const todayRef = ref(new Date())
const todayYear = computed(() => todayRef.value.getFullYear())
const todayMonth = computed(() => todayRef.value.getMonth() + 1)
const todayDay = computed(() => todayRef.value.getDate())
const MS_PER_DAY = 24 * 60 * 60 * 1000
const todayUtcDay = computed(() =>
  Date.UTC(todayYear.value, todayMonth.value - 1, todayDay.value)
)

// カレンダーの状態
const currentYear = ref(todayYear.value)
const currentMonth = ref(todayMonth.value)
const daysInMonth = computed(() =>
  new Date(currentYear.value, currentMonth.value, 0).getDate()
)

const selectedDay = ref(todayDay.value)
const isCurrentMonth = computed(
  () => currentYear.value === todayYear.value && currentMonth.value === todayMonth.value
)

// 共有（Supabase）設定
const config = useRuntimeConfig()
const publicConfig = config.public as Record<string, string | undefined>
const supabaseUrl = publicConfig.supabaseUrl ?? publicConfig.SUPABASE_URL
const supabaseAnonKey = publicConfig.supabaseAnonKey ?? publicConfig.SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

// 共有コードの状態
const shareEnabled = false
const SHARE_CODE_STORAGE_KEY = 'shared-tasks-code'
const SHARED_TASK_IDS_STORAGE_KEY = 'task-manager-shared-ids'
const SHARE_CODE_LENGTH = 8
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const shareCode = ref('')
const shareCodeInput = ref('')
const isShareCodeSet = computed(() => shareCode.value.trim().length > 0)
const sharedTaskIds = ref<Set<string>>(new Set())
const isSharePanelOpen = ref(false)

// 科目マスタ
type Subject = {
  id: string
  name: string
  emoji: string
}

// 科目の初期データ
const defaultSubjects: Subject[] = [
  { id: 'denji', name: '電磁気学', emoji: '?' },
  { id: 'yuukagaku', name: '有機化学', emoji: '??' },
  { id: 'eikoku', name: '英語', emoji: '??' },
  { id: 'kikaikougaku', name: '機械工学', emoji: '??' }
]

// 科目の状態と表示用マップ
const subjects = ref<Subject[]>([...defaultSubjects])

const subjectNameById = computed(() => {
  const map = new Map<string, string>()
  for (const subject of subjects.value) {
    map.set(subject.id, subject.name)
  }
  return map
})

// UI用の固定データ
const taskTypes = ['課題', '試験', '補講']
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

const emojiOptions = ['??', '??', '??', '??', '??', '?', '??', '??', '??', '???', '??', '??']
const isSubjectModalOpen = ref(false)
const isSubjectManageOpen = ref(false)
const newSubjectName = ref('')
const newSubjectEmoji = ref(emojiOptions[0] ?? '??')

// 予定メモの状態
const isMemoModalOpen = ref(false)
const memoDraft = ref('')
const memoTaskId = ref<string | null>(null)

// 予定データ
type Task = {
  id: string
  date: string // "YYYY-MM-DD"
  subjectId: string
  type: string
  memo?: string
}

const tasks = ref<Task[]>([])

// ローカル保存
const STORAGE_KEY = 'task-manager-tasks'
const SUBJECTS_STORAGE_KEY = 'task-manager-subjects'
const STORAGE_SAVE_DEBOUNCE_MS = 300
let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null
let subjectsSaveTimer: ReturnType<typeof setTimeout> | null = null
let todayTimer: ReturnType<typeof setTimeout> | null = null

// 初期化
onMounted(async () => {
  scheduleTodayRefresh()

  const savedSubjects = localStorage.getItem(SUBJECTS_STORAGE_KEY)
  if (savedSubjects) {
    try {
      subjects.value = JSON.parse(savedSubjects)
    } catch (error) {
      console.warn('Failed to parse saved subjects.', error)
      localStorage.removeItem(SUBJECTS_STORAGE_KEY)
    }
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      tasks.value = normalizeTasks(JSON.parse(saved))
    } catch (error) {
      console.warn('Failed to parse saved tasks.', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  initShareCode()

  if (!shareEnabled) {
    return
  }

  if (!supabase) {
    console.warn('Supabase config missing. Shared tasks are disabled.')
    return
  }

  if (isShareCodeSet.value) {
    await shareExistingTasks()
  }
})

// 後片付け
onBeforeUnmount(() => {
  if (todayTimer) {
    clearTimeout(todayTimer)
    todayTimer = null
  }
  if (tasksSaveTimer) {
    clearTimeout(tasksSaveTimer)
    tasksSaveTimer = null
  }
  if (subjectsSaveTimer) {
    clearTimeout(subjectsSaveTimer)
    subjectsSaveTimer = null
  }
})

// ローカル保存の監視
watch(
  tasks,
  (val) => {
    if (tasksSaveTimer) {
      clearTimeout(tasksSaveTimer)
    }
    tasksSaveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      tasksSaveTimer = null
    }, STORAGE_SAVE_DEBOUNCE_MS)
  },
  { deep: true }
)

watch(
  subjects,
  (val) => {
    if (subjectsSaveTimer) {
      clearTimeout(subjectsSaveTimer)
    }
    subjectsSaveTimer = setTimeout(() => {
      localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(val))
      subjectsSaveTimer = null
    }, STORAGE_SAVE_DEBOUNCE_MS)
  },
  { deep: true }
)

// 選択日の補正
watch([currentYear, currentMonth], () => {
  const maxDay = daysInMonth.value
  if (selectedDay.value > maxDay) {
    selectedDay.value = maxDay
  }
})

// 日付の派生値
const selectedDateString = computed(
  () =>
    `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(
      selectedDay.value
    ).padStart(2, '0')}`
)

const todayString = computed(
  () =>
    `${todayYear.value}-${String(todayMonth.value).padStart(2, '0')}-${String(
      todayDay.value
    ).padStart(2, '0')}`
)

const selectedLabel = computed(
  () => `${currentYear.value}年${currentMonth.value}月${selectedDay.value}日の予定`
)

const selectedDayTasks = computed(() =>
  tasks.value.filter((t) => t.date === selectedDateString.value)
)

const localUpcomingTasks = computed(() => {
  const nowStr = todayString.value
  return [...tasks.value]
    .filter((t) => t.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date))
})

const upcomingTasks = computed(() => {
  return [...localUpcomingTasks.value]
})

const ownedTaskIds = computed(() => new Set(tasks.value.map((task) => task.id)))

// 科目名の取得と移行補助
function getSubjectName(subjectId: string) {
  return subjectNameById.value.get(subjectId) ?? '（削除済み）'
}

function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  const subjectIdByName = new Map(subjects.value.map((subject) => [subject.name, subject.id]))
  const normalized: Task[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const task = item as Partial<Task> & { subject?: string; memo?: string }
    if (typeof task.id !== 'string' || typeof task.date !== 'string' || typeof task.type !== 'string') {
      continue
    }
    let subjectId =
      typeof task.subjectId === 'string' ? task.subjectId : undefined
    if (!subjectId && typeof task.subject === 'string') {
      subjectId = subjectIdByName.get(task.subject)
    }
    if (!subjectId) continue
    const memo = typeof task.memo === 'string' ? task.memo.trim() : ''
    const normalizedTask: Task = {
      id: task.id,
      date: task.date,
      subjectId,
      type: task.type
    }
    if (memo) {
      normalizedTask.memo = memo
    }
    normalized.push(normalizedTask)
  }
  return normalized
}

// メモの有無判定
function hasMemo(task: Task) {
  return Boolean(task.memo && task.memo.trim().length > 0)
}

// 共有同期（Supabase）
async function shareExistingTasks() {
  if (!shareEnabled) return
  if (!supabase || !isShareCodeSet.value) return
  const nowStr = todayString.value
  const pending = tasks.value.filter(
    (task) => task.date >= nowStr && !sharedTaskIds.value.has(task.id)
  )
  if (pending.length === 0) return
  const payload = pending.map((task) => ({
    id: task.id,
    share_code: shareCode.value,
    date: task.date,
    subject: getSubjectName(task.subjectId),
    type: task.type
  }))
  const { error } = await supabase.from('shared_tasks').upsert(payload, { onConflict: 'id' })
  if (error) {
    console.warn('Failed to share existing tasks.', error)
    return
  }
  for (const task of pending) {
    sharedTaskIds.value.add(task.id)
  }
  persistSharedTaskIds()
}

async function shareTask(task: Task) {
  if (!shareEnabled) return
  if (!supabase || !isShareCodeSet.value) return
  if (task.date < todayString.value) return
  const { error } = await supabase.from('shared_tasks').upsert(
    {
      id: task.id,
      share_code: shareCode.value,
      date: task.date,
      subject: getSubjectName(task.subjectId),
      type: task.type
    },
    { onConflict: 'id' }
  )
  if (error) {
    console.warn('Failed to share task.', error)
    return
  }
  sharedTaskIds.value.add(task.id)
  persistSharedTaskIds()
}

async function unshareTask(taskId: string) {
  if (!shareEnabled) return
  if (!supabase || !isShareCodeSet.value) return
  const { error } = await supabase
    .from('shared_tasks')
    .delete()
    .eq('id', taskId)
    .eq('share_code', shareCode.value)
  if (error) {
    console.warn('Failed to remove shared task.', error)
    return
  }
  if (sharedTaskIds.value.delete(taskId)) {
    persistSharedTaskIds()
  }
}

// カレンダー表示用データ
const taskTypeByDate = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const task of tasks.value) {
    if (!map.has(task.date)) {
      map.set(task.date, new Set())
    }
    map.get(task.date)?.add(task.type)
  }
  return map
})

const calendarCells = computed(() => {
  const firstWeekday = new Date(currentYear.value, currentMonth.value - 1, 1).getDay()
  const blanks = Array.from({ length: firstWeekday }, () => ({ day: null, types: [] as string[] }))
  const days = Array.from({ length: daysInMonth.value }, (_, i) => {
    const day = i + 1
    const date = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`
    const types = taskTypeByDate.value.get(date)
    return { day, types: types ? Array.from(types) : [] }
  })
  return [...blanks, ...days]
})

// 月移動
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

// 日付更新タイマー
function scheduleTodayRefresh() {
  if (todayTimer) {
    clearTimeout(todayTimer)
  }
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  const msUntilNextDay = next.getTime() - now.getTime()
  todayTimer = setTimeout(() => {
    todayRef.value = new Date()
    scheduleTodayRefresh()
  }, msUntilNextDay + 1000)
}

// 共有コードのユーティリティ
function normalizeShareCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function generateShareCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_CODE_LENGTH))
  let code = ''
  for (const byte of bytes) {
    code += SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length]
  }
  return code
}

function loadSharedTaskIds(code: string) {
  const raw = localStorage.getItem(SHARED_TASK_IDS_STORAGE_KEY)
  if (!raw) {
    sharedTaskIds.value = new Set()
    return
  }
  try {
    const parsed = JSON.parse(raw) as { code?: string; ids?: string[] }
    if (parsed?.code === code && Array.isArray(parsed.ids)) {
      sharedTaskIds.value = new Set(parsed.ids.filter((id) => typeof id === 'string'))
    } else {
      sharedTaskIds.value = new Set()
    }
  } catch (error) {
    console.warn('Failed to parse shared task ids.', error)
    localStorage.removeItem(SHARED_TASK_IDS_STORAGE_KEY)
    sharedTaskIds.value = new Set()
  }
}

function persistSharedTaskIds() {
  if (!isShareCodeSet.value) return
  localStorage.setItem(
    SHARED_TASK_IDS_STORAGE_KEY,
    JSON.stringify({ code: shareCode.value, ids: Array.from(sharedTaskIds.value) })
  )
}

function setShareCode(code: string) {
  shareCode.value = code
  shareCodeInput.value = code
  loadSharedTaskIds(code)
}

function initShareCode() {
  const saved = localStorage.getItem(SHARE_CODE_STORAGE_KEY)
  const normalized = saved ? normalizeShareCode(saved) : ''
  if (normalized) {
    setShareCode(normalized)
    return
  }
  const generated = generateShareCode()
  setShareCode(generated)
  localStorage.setItem(SHARE_CODE_STORAGE_KEY, generated)
}

// 共有コードの操作
async function applyShareCode() {
  if (!shareEnabled) return
  const normalized = normalizeShareCode(shareCodeInput.value)
  if (!normalized) return
  if (normalized === shareCode.value) return
  shareCode.value = normalized
  shareCodeInput.value = normalized
  loadSharedTaskIds(normalized)
  localStorage.setItem(SHARE_CODE_STORAGE_KEY, normalized)
  await shareExistingTasks()
}

function regenerateShareCode() {
  if (!shareEnabled) return
  const ok = confirm('共有コードを再生成します。既存のコードでは見られなくなります。続けますか？')
  if (!ok) return
  shareCodeInput.value = generateShareCode()
  void applyShareCode()
}

// 共有パネルUI
function openSharePanel() {
  closeTypeMenu()
  isSharePanelOpen.value = true
}

function closeSharePanel() {
  isSharePanelOpen.value = false
}

function toggleSharePanel() {
  if (isSharePanelOpen.value) {
    closeSharePanel()
  } else {
    openSharePanel()
  }
}

// 表示用の日付ラベル
function formatRelative(dateStr: string) {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return dateStr
  const targetUtc = Date.UTC(year, month - 1, day)
  const diffDays = Math.round((targetUtc - todayUtcDay.value) / MS_PER_DAY)
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '明日'
  if (diffDays > 1 && diffDays <= 7) return `あと${diffDays}日`
  return dateStr
}

// 予定メモ操作
function openMemoModal(task: Task) {
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
  const task = tasks.value.find((item) => item.id === memoTaskId.value)
  if (!task) {
    closeMemoModal()
    return
  }
  const trimmed = memoDraft.value.trim()
  task.memo = trimmed ? trimmed : undefined
  closeMemoModal()
}

// 科目モーダル操作
function openSubjectModal() {
  closeTypeMenu()
  isSubjectManageOpen.value = false
  isSubjectModalOpen.value = true
  newSubjectName.value = ''
  newSubjectEmoji.value = emojiOptions[0] ?? '??'
}

function closeSubjectModal() {
  isSubjectModalOpen.value = false
}

function addSubject() {
  const name = newSubjectName.value.trim()
  if (!name) return

  subjects.value.push({
    id: crypto.randomUUID(),
    name,
    emoji: newSubjectEmoji.value
  })
  closeSubjectModal()
}

function openSubjectManageModal() {
  closeTypeMenu()
  closeSubjectModal()
  isSubjectManageOpen.value = true
}

function closeSubjectManageModal() {
  isSubjectManageOpen.value = false
}

function removeSubject(subjectId: string) {
  const subject = subjects.value.find((item) => item.id === subjectId)
  if (!subject) return
  const ok = confirm(`「${subject.name}」を削除しますか？（既存の予定は残ります）`)
  if (!ok) return
  subjects.value = subjects.value.filter((item) => item.id !== subjectId)
}

// 種別メニュー
const typeMenuSubject = ref<Subject | null>(null)
const typeMenuPosition = ref<{
  top: number
  left: number
  placement: 'right' | 'left'
} | null>(null)

const typeMenuStyle = computed(() => {
  if (!typeMenuPosition.value) return {}
  const { top, left, placement } = typeMenuPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    transform: placement === 'right'
      ? 'translate(8px, -50%)'
      : 'translate(calc(-100% - 8px), -50%)'
  }
})

function openTypeMenu(subject: Subject, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (target) {
    const rect = target.getBoundingClientRect()
    const bubbleWidth = 140
    const spaceRight = window.innerWidth - rect.right
    const placement =
      spaceRight < bubbleWidth && rect.left > spaceRight ? 'left' : 'right'
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

// 予定の追加・削除
function addTask(subject: Subject, type: string) {
  const task: Task = {
    id: crypto.randomUUID(),
    date: selectedDateString.value,
    subjectId: subject.id,
    type
  }
  tasks.value.push(task)
  void shareTask(task)
  closeTypeMenu()
}

function removeTask(taskId: string) {
  const ok = confirm("この予定を削除しますか？")
  if (!ok) return

  tasks.value = tasks.value.filter((t) => t.id !== taskId)
  void unshareTask(taskId)
}

</script>

<style scoped>
.page {
  --ink: #1f1f1f;
  --muted: #6f6f6f;
  --border: #dddddd;
  --surface: #ffffff;
  --surface-muted: #f6f6f6;
  --accent: #f2a15a;
  --accent-strong: #e57f32;
  --accent-soft: #fff0e2;
  max-width: 480px;
  margin: 0 auto;
  padding: calc(18px + env(safe-area-inset-top)) 16px 88px;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'M PLUS Rounded 1c', 'Noto Sans JP', 'Yu Gothic UI', sans-serif;
  color: var(--ink);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header h1 {
  font-size: 18px;
  margin-bottom: 4px;
  letter-spacing: 0.02em;
}

.menu-toggle {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0;
  cursor: pointer;
}

.menu-bar {
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: var(--ink);
  display: block;
}

.menu-toggle:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 2px;
}

.card {
  background: var(--surface);
  border-radius: 14px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}

.card h2 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.share-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 50;
}

.share-panel {
  --ink: #1f1f1f;
  --muted: #6f6f6f;
  --border: #dddddd;
  --surface: #ffffff;
  --surface-muted: #f6f6f6;
  --accent: #f2a15a;
  --accent-strong: #e57f32;
  --accent-soft: #fff0e2;
  position: fixed;
  top: 0;
  right: 0;
  height: 100svh;
  width: min(320px, 86vw);
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: -12px 0 24px rgba(0, 0, 0, 0.12);
  padding: calc(18px + env(safe-area-inset-top)) 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 60;
}

.share-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.share-panel-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.share-panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.share-generate {
  border: none;
  background: var(--surface-muted);
  padding: 4px 10px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.share-generate:hover {
  color: var(--ink);
}

.share-close {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.share-close:hover {
  color: var(--ink);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.calendar-actions {
  display: flex;
  gap: 6px;
}

.month-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.month-btn:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 2px;
}

.card p {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--muted);
}

.share-code {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.share-label {
  font-size: 12px;
  color: var(--muted);
}

.share-controls {
  display: flex;
  gap: 8px;
}

.share-input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--surface);
}

.share-apply {
  border: none;
  background: var(--surface-muted);
  padding: 6px 12px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid var(--border);
  white-space: nowrap;
}

.share-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.share-hint {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

.card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.card li {
  font-size: 12px;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 6px;
  letter-spacing: 0.04em;
}

.weekday {
  padding: 2px 0;
}

.weekday.sunday {
  color: #e06b6b;
}

.weekday.saturday {
  color: #5a8fd8;
}

.day {
  min-height: 32px;
  border-radius: 0;
  border: 1px solid var(--border);
  margin: -1px 0 0 -1px;
  background: var(--surface);
  cursor: pointer;
  font-size: 12px;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.day-number {
  line-height: 1;
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

.day.selected {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.day.empty {
  cursor: default;
  color: transparent;
  background: var(--surface);
}

.day.today {
  box-shadow: inset 0 0 0 2px #7cc7ff;
  font-weight: 600;
}

.day.selected.today {
  box-shadow: inset 0 0 0 2px var(--accent), inset 0 0 0 4px #7cc7ff;
}

.day:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: -2px;
}

.subjects {
  margin-bottom: 40px;
}

.subjects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.subjects h3 {
  font-size: 14px;
  margin-bottom: 6px;
}

.manage-link {
  border: none;
  background: var(--surface-muted);
  padding: 4px 10px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.manage-link:hover {
  color: var(--ink);
}

.subject-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.subject-btn {
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ink);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.subject-btn .icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  font-size: 16px;
}

.subject-btn.add {
  font-size: 22px;
}

/* 種別選択バブル */
.type-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.08);
  z-index: 30;
}

.type-menu-bubble {
  position: fixed;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 16px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #dddddd);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
  color: var(--ink, #1f1f1f);
  opacity: 1;
}

.type-chip {
  min-width: 72px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border, #dddddd);
  background: var(--surface, #ffffff);
  color: var(--ink, #1f1f1f);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.12);
  animation: bubbleIn 160ms ease-out both;
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

/* 科目追加モーダル */
.subject-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.subject-menu {
  background: var(--surface);
  padding: 16px;
  border-radius: 16px;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.subject-menu h3 {
  font-size: 14px;
  margin-bottom: 4px;
}

.subject-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subject-label {
  font-size: 12px;
  color: var(--muted);
}

.subject-input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--surface);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.emoji-btn {
  border: 1px solid var(--border);
  background: var(--surface-muted);
  border-radius: 10px;
  padding: 6px 0;
  font-size: 16px;
  cursor: pointer;
}

.emoji-btn.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.subject-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.subject-actions button {
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
  background: var(--surface-muted);
  border: 1px solid var(--border);
}

.subject-actions button.primary {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-strong);
}

.subject-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 科目管理モーダル */
.subject-manage-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.subject-manage {
  background: var(--surface);
  padding: 16px;
  border-radius: 16px;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.subject-manage h3 {
  font-size: 14px;
  margin-bottom: 4px;
}

.manage-empty {
  font-size: 12px;
  color: var(--muted);
}

.manage-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.manage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.manage-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.manage-delete {
  border: none;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}

/* 予定メモモーダル */
.memo-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.memo-modal {
  background: var(--surface);
  padding: 16px;
  border-radius: 16px;
  width: min(360px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.memo-modal h3 {
  font-size: 14px;
  margin-bottom: 4px;
}

.memo-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.memo-label {
  font-size: 12px;
  color: var(--muted);
}

.memo-input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--surface);
  resize: vertical;
  min-height: 96px;
}
.taskList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.taskList-scroll {
  max-height: min(160px, 50svh);
  overflow-y: auto;
  padding-right: 4px;
  overscroll-behavior: contain;
}

.taskList-scroll-upcoming {
  max-height: min(160px, 40svh);
}

.taskList-scroll-selected {
  max-height: min(90px, 60svh);
}

.taskRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  margin-bottom: 6px;
  font-size: 12px;
  cursor: pointer;
}

.taskRow.todayTask {
  border-color: #7cc7ff;
  background: #e9f6ff;
}

.taskText {
  flex: 1;
}

.taskBadge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  color: #2f6fb3;
  background: #e9f6ff;
  border: 1px solid #bfe2ff;
}

.deleteBtn {
  border: none;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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

@media (prefers-reduced-motion: reduce) {
  .header,
  .card,
  .subjects,
  .subject-btn,
  .type-chip {
    animation: none;
  }
}

</style>
