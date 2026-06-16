import { computed, ref, watch } from 'vue'
import { useColorMode } from '@vueuse/core'
import {
  APP_MODE_STORAGE_KEY,
  APP_THEME_STORAGE_KEY,
  APP_THEMES,
  DEFAULT_APP_THEME,
  DEFAULT_COLOR_MODE,
  getThemeById
} from '../theme/themes'

const themeId = ref(DEFAULT_APP_THEME)
let initialized = false

const getStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_APP_THEME
  const requested = new URLSearchParams(window.location.search).get('__theme')
  if (APP_THEMES.some(theme => theme.id === requested)) return requested
  const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY)
  return APP_THEMES.some(theme => theme.id === stored) ? stored : DEFAULT_APP_THEME
}

const getStoredMode = () => {
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE
  const requested = new URLSearchParams(window.location.search).get('__mode')
  if (requested === 'light' || requested === 'dark') return requested
  const stored = window.localStorage.getItem(APP_MODE_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_COLOR_MODE
}

const applyThemeAttribute = (nextThemeId) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.appTheme = nextThemeId
}

export const applyInitialTheme = () => {
  if (typeof document === 'undefined') return
  const nextTheme = getStoredTheme()
  const nextMode = getStoredMode()
  document.documentElement.dataset.appTheme = nextTheme
  document.documentElement.classList.toggle('dark', nextMode === 'dark')
  document.documentElement.classList.toggle('light', nextMode === 'light')
}

export const useAppTheme = () => {
  const colorMode = useColorMode({
    selector: 'html',
    attribute: 'class',
    modes: {
      light: 'light',
      dark: 'dark'
    },
    initialValue: DEFAULT_COLOR_MODE,
    storageKey: APP_MODE_STORAGE_KEY
  })

  if (!initialized) {
    themeId.value = getStoredTheme()
    applyThemeAttribute(themeId.value)
    colorMode.value = getStoredMode()
    initialized = true

    watch(themeId, (nextThemeId) => {
      applyThemeAttribute(nextThemeId)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextThemeId)
      }
    }, { immediate: true })
  }

  const currentTheme = computed(() => getThemeById(themeId.value))
  const isDark = computed(() => colorMode.value === 'dark')
  const modeLabel = computed(() => isDark.value ? '深色' : '浅色')

  const setTheme = (nextThemeId) => {
    if (APP_THEMES.some(theme => theme.id === nextThemeId)) {
      themeId.value = nextThemeId
    }
  }

  const setMode = (nextMode) => {
    colorMode.value = nextMode === 'light' ? 'light' : 'dark'
  }

  const toggleMode = () => {
    setMode(isDark.value ? 'light' : 'dark')
  }

  return {
    themes: APP_THEMES,
    themeId,
    currentTheme,
    colorMode,
    isDark,
    modeLabel,
    setTheme,
    setMode,
    toggleMode
  }
}
