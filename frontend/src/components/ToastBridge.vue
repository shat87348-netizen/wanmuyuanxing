<template>
  <div class="toast-bridge" aria-live="polite">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-item"
      :class="`toast-${toast.type}`"
    >
      {{ toast.text }}
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const toasts = ref([])
let seed = 0

const removeToast = (id) => {
  toasts.value = toasts.value.filter(toast => toast.id !== id)
}

const handleToast = (event) => {
  const id = ++seed
  const toast = {
    id,
    type: event.detail?.type || 'info',
    text: event.detail?.text || ''
  }
  toasts.value = [...toasts.value, toast].slice(-4)
  window.setTimeout(() => removeToast(id), 2600)
}

onMounted(() => {
  window.addEventListener('sjcl:toast', handleToast)
})

onBeforeUnmount(() => {
  window.removeEventListener('sjcl:toast', handleToast)
})
</script>

<style scoped>
.toast-bridge {
  position: fixed;
  top: calc(var(--ui-header-height, 56px) + 16px);
  right: 16px;
  z-index: 80;
  display: grid;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  min-width: 220px;
  max-width: 360px;
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: calc(var(--ui-radius) + 4px);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  box-shadow: var(--ui-shadow);
}

.toast-success {
  border-color: color-mix(in srgb, var(--ui-success) 55%, transparent);
}

.toast-error {
  border-color: color-mix(in srgb, var(--ui-error) 65%, transparent);
}

.toast-warning {
  border-color: color-mix(in srgb, var(--ui-warning) 65%, transparent);
}
</style>
