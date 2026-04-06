<template>
  <main class="page">
    <header class="header">
      <h1>友だち</h1>
      <p>共有は準備中です。</p>
    </header>

    <section class="card">
      <h2>このページについて</h2>
      <p>直近の予定部分を友人知人と共有することで、より予定の把握がしやすくなるような機能の追加を予定しています！</p>
    </section>

    <BottomNav active="friends" />
  </main>
</template>

<style scoped>
.page{--ink:#1f1f1f;--muted:#6f6f6f;--border:#dddddd;--surface:#fff;max-width:480px;margin:0 auto;padding:calc(18px + env(safe-area-inset-top)) 16px 88px;min-height:100svh;display:flex;flex-direction:column;gap:16px;font-family:'M PLUS Rounded 1c','Noto Sans JP','Yu Gothic UI',sans-serif;color:var(--ink)}
.header h1{font-size:18px;margin-bottom:4px;letter-spacing:.02em}
.header p,.card p{font-size:12px;color:var(--muted)}
.card{background:var(--surface);border-radius:14px;padding:12px 16px;border:1px solid var(--border);box-shadow:0 6px 14px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:10px}
.card h2{font-size:15px;font-weight:700;margin-bottom:4px;letter-spacing:.02em}
@media (min-width:520px){.page{margin:24px auto;border-radius:20px;box-shadow:0 16px 40px rgba(0,0,0,.12)}}
</style>
