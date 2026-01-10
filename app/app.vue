<template>
  <div class="app-shell">
    <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
  </div>
</template>

<style>
.app-shell {
  min-height: 100svh;
  position: relative;
  background: #ffffff;
}

.app-shell > * {
  position: relative;
  z-index: 1;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.page-enter-to,
.page-leave-from {
  opacity: 1;
  transform: scale(1);
}

</style>
