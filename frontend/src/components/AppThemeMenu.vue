<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end', sideOffset: 8 }"
    :ui="{ content: 'w-56' }"
  >
    <UButton
      icon="i-lucide-palette"
      color="neutral"
      variant="ghost"
      square
      :aria-label="`主题：${currentTheme?.name || ''}，${modeLabel}`"
      data-testid="theme-menu"
    />
  </UDropdownMenu>
</template>

<script setup>
import { computed } from 'vue'
import { useAppTheme } from '../composables/useAppTheme'

const {
  themes,
  themeId,
  currentTheme,
  isDark,
  modeLabel,
  setTheme,
  setMode
} = useAppTheme()

const items = computed(() => [
  [
    { type: 'label', label: '主题风格' },
    ...themes.map((theme) => ({
      label: theme.name,
      icon: themeId.value === theme.id ? 'i-lucide-check' : 'i-lucide-circle',
      onSelect: () => setTheme(theme.id)
    }))
  ],
  [
    { type: 'label', label: '明暗模式' },
    {
      label: '浅色',
      icon: !isDark.value ? 'i-lucide-check' : 'i-lucide-sun',
      onSelect: () => setMode('light')
    },
    {
      label: '深色',
      icon: isDark.value ? 'i-lucide-check' : 'i-lucide-moon',
      onSelect: () => setMode('dark')
    }
  ]
])
</script>
