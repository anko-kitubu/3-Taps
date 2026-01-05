<template>
  <main class="page">
    <header class="header">
      <h1>友だち</h1>
      <p>友だちの予定を見たり、共有するページ（仮）</p>
    </header>

    <section class="card">
      <h2>友だちの直近の予定</h2>
      <div class="share-code">
        <p class="share-hint">共有機能は現在未実装です。</p>
        <label class="share-label" for="share-code-input">共有コード</label>
        <div class="share-controls">
          <input
            id="share-code-input"
            v-model="shareCodeInput"
            class="share-input"
            type="text"
            placeholder="例）AB12CD34"
            autocomplete="off"
          />
          <button class="share-apply" type="button" :disabled="shareCodeInput.trim().length === 0" @click="applyShareCode">
            接続
          </button>
        </div>
        <p class="share-hint">同じコードの予定が表示されます。</p>
      </div>
      <p v-if="!isSupabaseReady">共有設定が未完了です。</p>
      <p v-else-if="!isShareCodeSet">共有コードを入力してください。</p>
      <p v-else-if="sharedUpcomingTasks.length === 0">まだ共有された予定はないよ！</p>
      <ul v-else class="taskList">
        <li v-for="task in sharedUpcomingTasks" :key="task.id" class="taskRow">
          <span class="taskText">
            {{ formatRelative(task.date) }} / {{ task.subject }}（{{ task.type }}）
          </span>
        </li>
      </ul>
    </section>

    <!-- 下のナビ -->
    <BottomNav active="friends" />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'

type SharedTask = {
  id: string
  date: string
  subject: string
  type: string
}

const SHARE_CODE_STORAGE_KEY = 'shared-tasks-code'
const config = useRuntimeConfig()
const publicConfig = config.public as Record<string, string | undefined>
const supabaseUrl = publicConfig.supabaseUrl ?? publicConfig.SUPABASE_URL
const supabaseAnonKey = publicConfig.supabaseAnonKey ?? publicConfig.SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
const isSupabaseReady = Boolean(supabase)

const shareCode = ref('')
const shareCodeInput = ref('')
const isShareCodeSet = computed(() => shareCode.value.trim().length > 0)
const sharedTasks = ref<SharedTask[]>([])
const todayRef = ref(new Date())
const MS_PER_DAY = 24 * 60 * 60 * 1000
const todayString = computed(
  () =>
    `${todayRef.value.getFullYear()}-${String(todayRef.value.getMonth() + 1).padStart(2, '0')}-${String(
      todayRef.value.getDate()
    ).padStart(2, '0')}`
)
const todayUtcDay = computed(() =>
  Date.UTC(todayRef.value.getFullYear(), todayRef.value.getMonth(), todayRef.value.getDate())
)

const sharedUpcomingTasks = computed(() => {
  if (!supabase || !isShareCodeSet.value) return []
  return [...sharedTasks.value]
    .filter((t) => t.date >= todayString.value)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
})

let shareChannel: RealtimeChannel | null = null
let todayTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  scheduleTodayRefresh()

  if (!supabase) {
    console.warn('Supabase config missing. Shared tasks are disabled.')
    return
  }

  const saved = localStorage.getItem(SHARE_CODE_STORAGE_KEY)
  const normalized = saved ? normalizeShareCode(saved) : ''
  if (normalized) {
    shareCode.value = normalized
    shareCodeInput.value = normalized
    await subscribeToShareCode(normalized)
  }
})

onBeforeUnmount(() => {
  if (shareChannel) {
    void shareChannel.unsubscribe()
    shareChannel = null
  }
  if (todayTimer) {
    clearTimeout(todayTimer)
    todayTimer = null
  }
})

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

function normalizeShareCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function fetchSharedTasks() {
  if (!supabase || !isShareCodeSet.value) return
  const { data, error } = await supabase
    .from('shared_tasks')
    .select('id,date,subject,type')
    .eq('share_code', shareCode.value)
    .gte('date', todayString.value)
    .order('date', { ascending: true })
  if (error) {
    console.warn('Failed to fetch shared tasks.', error)
    return
  }
  sharedTasks.value = data ?? []
}

async function subscribeToShareCode(code: string) {
  if (!supabase) return
  if (!code) return
  if (shareChannel) {
    await shareChannel.unsubscribe()
    shareChannel = null
  }
  shareCode.value = code
  await fetchSharedTasks()
  shareChannel = supabase
    .channel(`shared_tasks:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shared_tasks', filter: `share_code=eq.${code}` },
      () => {
        void fetchSharedTasks()
      }
    )
    .subscribe()
}

async function applyShareCode() {
  if (!supabase) return
  const code = normalizeShareCode(shareCodeInput.value)
  if (!code) return
  if (code === shareCode.value) return
  shareCodeInput.value = code
  localStorage.setItem(SHARE_CODE_STORAGE_KEY, code)
  await subscribeToShareCode(code)
}

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

.share-code {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
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

@media (min-width: 520px) {
  .page {
    margin: 24px auto;
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  }
}
</style>
