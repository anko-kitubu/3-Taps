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
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 88px; /* 下のナビ分の余白 */
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.header h1 {
  font-size: 20px;
  margin-bottom: 4px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.card h2 {
  font-size: 16px;
  margin-bottom: 8px;
}
</style>
