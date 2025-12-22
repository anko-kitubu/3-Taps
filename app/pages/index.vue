<template>
  <main class="page">
    <header class="header">
      <h1>課題管理アプリ</h1>
      <p>やるべきことを、日付ごとに見通せるように。</p>
    </header>

    <!-- 直近の予定 -->
    <section class="card">
      <h2>直近の予定</h2>
      <p v-if="upcomingTasks.length === 0">まだ予定はないよ！</p>
      <ul v-else class="taskList">
        <li v-for="task in upcomingTasks" :key="task.id" class="taskRow">
          <span class="taskText">
            {{ formatRelative(task.date) }} / {{ task.subject }}（{{ task.type }}）
          </span>
          <button class="deleteBtn" @click="removeTask(task.id)">削除</button>
        </li>
      </ul>

    </section>

    <!-- カレンダー -->
    <section class="card">
      <h2>{{ currentYear }}年 {{ currentMonth }}月</h2>
      <div class="calendar">
        <button v-for="day in daysInMonth" :key="day" class="day"
          :class="{ selected: selectedDay === day, today: day === todayDay }"
          @click="selectedDay = day">
          {{ day }}
        </button>
      </div>
    </section>

    <!-- 選択した日の予定 -->
    <section class="card">
      <h2>{{ selectedLabel }}</h2>
      <p v-if="selectedDayTasks.length === 0">まだ予定はないよ！</p>
      <ul v-else>
        <li v-for="task in selectedDayTasks" :key="task.id">
          {{ task.subject }}（{{ task.type }}）
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
        <button v-for="subject in subjects" :key="subject.id" class="subject-btn" @click="openTypeMenu(subject)">
          <span class="icon">{{ subject.emoji }}</span>
          <span class="label">{{ subject.name }}</span>
        </button>

        <button class="subject-btn add" type="button" aria-label="科目を追加" @click="openSubjectModal">
          ＋
        </button>
      </div>
    </section>

    <!-- 種別選択の簡単モーダル -->
    <div v-if="typeMenuSubject" class="type-menu-backdrop" @click="closeTypeMenu">
      <div class="type-menu" @click.stop>
        <h3>{{ typeMenuSubject.name }} の予定を追加</h3>
        <button v-for="t in taskTypes" :key="t" @click="addTask(typeMenuSubject, t)">
          {{ t }} を追加
        </button>
        <button class="cancel" @click="closeTypeMenu">キャンセル</button>
      </div>
    </div>

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
  </main>
  <BottomNav active="home" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const today = new Date()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth() + 1
const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
const todayDay = today.getDate()

const selectedDay = ref(today.getDate())

type Subject = {
  id: string
  name: string
  emoji: string
}

// 科目の初期データ（あとで増やしたり名前変えてOK）
const defaultSubjects: Subject[] = [
  { id: 'denji', name: '電磁気学', emoji: '⚡' },
  { id: 'yuukagaku', name: '有機化学', emoji: '🧪' },
  { id: 'eikoku', name: '英語', emoji: '📘' },
  { id: 'kikaikougaku', name: '機械工学', emoji: '⚙️' }
]

const subjects = ref<Subject[]>([...defaultSubjects])

const taskTypes = ['授業', 'レポート', 'テスト']

const emojiOptions = ['📘', '📗', '📙', '📕', '🧪', '⚡', '🧠', '🧮', '📝', '🛠️', '💻', '🌎']
const isSubjectModalOpen = ref(false)
const isSubjectManageOpen = ref(false)
const newSubjectName = ref('')
const newSubjectEmoji = ref(emojiOptions[0])

type Task = {
  id: string
  date: string // "YYYY-MM-DD"
  subjectId: string
  subject: string
  type: string
}

const tasks = ref<Task[]>([])

const STORAGE_KEY = 'task-manager-tasks'
const SUBJECTS_STORAGE_KEY = 'task-manager-subjects'

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    tasks.value = JSON.parse(saved)
  }
  const savedSubjects = localStorage.getItem(SUBJECTS_STORAGE_KEY)
  if (savedSubjects) {
    subjects.value = JSON.parse(savedSubjects)
  }
})

watch(
  tasks,
  (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  },
  { deep: true }
)

watch(
  subjects,
  (val) => {
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(val))
  },
  { deep: true }
)

const selectedDateString = computed(
  () =>
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
      selectedDay.value
    ).padStart(2, '0')}`
)

const todayString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
  today.getDate()
).padStart(2, '0')}`

const selectedLabel = computed(
  () => `${currentYear}年${currentMonth}月${selectedDay.value}日 の予定`
)

const selectedDayTasks = computed(() =>
  tasks.value.filter((t) => t.date === selectedDateString.value)
)

const upcomingTasks = computed(() => {
  const nowStr = todayString
  return [...tasks.value]
    .filter((t) => t.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
})


function formatRelative(dateStr: string) {
  const target = new Date(dateStr)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '明日'
  if (diffDays > 1 && diffDays <= 7) return `あと${diffDays}日`
  return dateStr
}

function openSubjectModal() {
  closeTypeMenu()
  isSubjectManageOpen.value = false
  isSubjectModalOpen.value = true
  newSubjectName.value = ''
  newSubjectEmoji.value = emojiOptions[0]
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

function openTypeMenu(subject: Subject) {
  typeMenuSubject.value = subject
}

function closeTypeMenu() {
  typeMenuSubject.value = null
}

function addTask(subject: Subject, type: string) {
  tasks.value.push({
    id: crypto.randomUUID(),
    date: selectedDateString.value,
    subjectId: subject.id,
    subject: subject.name,
    type
  })
  closeTypeMenu()
}

function removeTask(taskId: string) {
  const ok = confirm("この予定を削除しますか？")
  if (!ok) return

  tasks.value = tasks.value.filter((t) => t.id !== taskId)
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
  background: linear-gradient(180deg, #f5f4f1 0%, #ffffff 40%, #ffffff 100%);
  position: relative;
}

.page::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 18% 12%, rgba(255, 240, 226, 0.7), transparent 48%);
  pointer-events: none;
}

.page > * {
  position: relative;
  z-index: 1;
}

.header h1 {
  font-size: 18px;
  margin-bottom: 4px;
  letter-spacing: 0.02em;
}

.header p {
  font-size: 12px;
  color: var(--muted);
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

.card p {
  margin: 0 0 6px;
  font-size: 12px;
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

.day.selected {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
  box-shadow: inset 0 0 0 2px var(--accent);
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

/* 種別メニュー */
.type-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-menu {
  background: var(--surface);
  padding: 16px;
  border-radius: 16px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.type-menu h3 {
  font-size: 14px;
  margin-bottom: 4px;
}

.type-menu button {
  border-radius: 999px;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  background: var(--surface-muted);
  border: 1px solid var(--border);
}

.type-menu button.cancel {
  background: #eeeeee;
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
.taskList {
  list-style: none;
  padding: 0;
  margin: 0;
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
}

.taskText {
  flex: 1;
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

.header,
.card,
.subjects {
  animation: fadeUp 420ms ease-out both;
}

.card:nth-of-type(1) {
  animation-delay: 80ms;
}

.card:nth-of-type(2) {
  animation-delay: 140ms;
}

.card:nth-of-type(3) {
  animation-delay: 200ms;
}

.subjects {
  animation-delay: 260ms;
}

.subject-btn {
  animation: fadeIn 480ms ease-out both;
}

.subject-btn:nth-child(1) {
  animation-delay: 280ms;
}

.subject-btn:nth-child(2) {
  animation-delay: 320ms;
}

.subject-btn:nth-child(3) {
  animation-delay: 360ms;
}

.subject-btn:nth-child(4) {
  animation-delay: 400ms;
}

.subject-btn:nth-child(5) {
  animation-delay: 440ms;
}

.subject-btn:nth-child(6) {
  animation-delay: 480ms;
}

.subject-btn:nth-child(7) {
  animation-delay: 520ms;
}

.subject-btn:nth-child(8) {
  animation-delay: 560ms;
}

.subject-btn:nth-child(9) {
  animation-delay: 600ms;
}

.subject-btn:nth-child(10) {
  animation-delay: 640ms;
}

.subject-btn:nth-child(11) {
  animation-delay: 680ms;
}

.subject-btn:nth-child(12) {
  animation-delay: 720ms;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
  .subject-btn {
    animation: none;
  }
}

</style>

