<template>
  <nav class="config-subnav" aria-label="系统配置二级菜单">
    <RouterLink to="/config/agents" class="config-subnav-link">采集代理 (Agent) 管理</RouterLink>
    <RouterLink to="/config/log" class="config-subnav-link">日志管理</RouterLink>
    <RouterLink to="/config/user" class="config-subnav-link">用户管理</RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.config-subnav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 4px;
  border-radius: var(--ui-radius);
  background: color-mix(in srgb, var(--ui-bg-elevated) 72%, transparent);
  box-shadow: 0 0 0 1px var(--ui-border);
  width: fit-content;
}

.config-subnav-link {
  padding: 8px 12px;
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  font-weight: 500;
  transition: color 0.2s ease, background 0.2s ease;
}

.config-subnav-link:hover,
.config-subnav-link.router-link-active {
  background: var(--ui-bg-accented);
  color: var(--ui-primary);
}
</style>
