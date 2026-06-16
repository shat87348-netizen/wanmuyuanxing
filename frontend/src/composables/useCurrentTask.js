import { ref, watch } from 'vue'

const STORAGE_KEY = 'currentTaskId'
const taskId = ref(localStorage.getItem(STORAGE_KEY) || null)

watch(taskId, (v) => {
  if (v) localStorage.setItem(STORAGE_KEY, v)
  else localStorage.removeItem(STORAGE_KEY)
})

export function useCurrentTask() {
  return {
    id: taskId,
    set: (v) => { taskId.value = v },
    clear: () => { taskId.value = null },
  }
}
