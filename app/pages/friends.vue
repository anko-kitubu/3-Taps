<template>
  <main class="page">
    <header class="header">
      <h1>友だち</h1>
      <p>友だちの予定を見たり、共有するページ（仮）</p>
    </header>

    <section class="card">
      <h2>友だちの予定（ダミー）</h2>
      <ul>
        <li>○○：明日 電磁気学（授業）</li>
        <li>××：2日後 レポート提出</li>
        <li>△△：1週間後 テスト</li>
      </ul>
    </section>

    <!-- 下のナビ -->
    <BottomNav active="friends" />
  </main>
</template>

<script setup lang="ts">
// いまは表示だけ。あとでデータを繋ぐよ！
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

.card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.card li {
  font-size: 12px;
}

@media (min-width: 520px) {
  .page {
    margin: 24px auto;
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  }
}
</style>
