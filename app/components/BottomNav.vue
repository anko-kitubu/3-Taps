<template>
  <nav class="nav">
    <NuxtLink to="/" class="item" :class="{ active: active === 'home' }">
      ホーム
    </NuxtLink>
    <NuxtLink to="/friends" class="item" :class="{ active: active === 'friends' }">
      友だち
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
defineProps<{ active: "home" | "friends" }>()
</script>

<style scoped>
.nav {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  width: min(480px, calc(100% - 32px));
  height: 56px;
  background: #f3f3f3;
  border-radius: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  padding: 0 8px;
}

.item {
  text-align: center;
  text-decoration: none;
  color: #666;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.item.active {
  background: #ffffff;
  color: #111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
</style>
