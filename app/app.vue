<template>
  <div class="app-shell">
    <NuxtPage />
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

</style>
