<template>
  <UDashboardGroup>
    <UDashboardSidebar id="main-sidebar" collapsible>
      <template #header="{ collapsed }">
        <div class="sidebar-brand" :class="{ collapsed }">
          <UIcon name="i-lucide-satellite" class="brand-icon" />
          <span v-if="!collapsed" class="brand-text">数据处理软件</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="navItems"
          orientation="vertical"
          :collapsed="collapsed"
          highlight
        />
      </template>

      <template #footer="{ collapsed }">
        <UDashboardSidebarCollapse :class="collapsed ? 'mx-auto' : ''" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel id="main-panel">
      <UDashboardNavbar :toggle="true" class="top-navbar">
          <template #left>
            <div class="page-title">{{ pageTitle }}</div>
          </template>

          <template #right>
            <div class="global-task-control">
              <span class="global-task-label">试验任务</span>
              <select
                v-model="taskSelectValue"
                class="global-task-select"
                aria-label="试验任务"
                :disabled="loadingTasks"
              >
                <option value="">全部试验任务</option>
                <option
                  v-for="task in experimentTaskOptions"
                  :key="task.value"
                  :value="task.value"
                >
                  {{ task.label }}
                </option>
              </select>
            </div>

            <UPopover v-model:open="alarmPopoverVisible" :ui="{ content: 'w-80' }">
              <UChip
                :show="alarmCount > 0"
                :text="alarmCount"
                color="error"
                size="lg"
              >
                <UButton
                  icon="i-lucide-bell"
                  color="neutral"
                  variant="ghost"
                  square
                  aria-label="最新告警"
                />
              </UChip>

              <template #content>
                <div class="alarm-popover">
                  <div class="alarm-popover-title">最新告警</div>

                  <div v-if="loadingAlarms" class="alarm-state">
                    <UIcon name="i-lucide-loader-2" class="animate-spin" />
                    加载中...
                  </div>
                  <div v-else-if="recentAlarms.length === 0" class="alarm-state">
                    暂无告警
                  </div>
                  <div v-else class="alarm-list">
                    <div
                      v-for="alarm in recentAlarms"
                      :key="alarm.id"
                      class="alarm-item"
                      :class="`alarm-level-${alarm.level}`"
                    >
                      <div class="alarm-item-header">
                        <UBadge
                          :color="getLevelColor(alarm.level)"
                          variant="subtle"
                          size="sm"
                        >
                          {{ getLevelText(alarm.level) }}
                        </UBadge>
                        <span class="alarm-time">{{ alarm.alarmTime }}</span>
                      </div>
                      <div class="alarm-source">{{ alarm.alarmSource }}</div>
                      <div class="alarm-message">{{ alarm.alarmMessage }}</div>
                    </div>
                  </div>

                  <div class="alarm-popover-footer">
                    <UButton
                      variant="link"
                      size="sm"
                      block
                      @click="viewAllAlarms"
                    >
                      查看全部
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>

            <AppThemeMenu />

            <UButton
              color="neutral"
              variant="ghost"
              class="profile-button"
              @click="profileModalVisible = true"
            >
              <UAvatar size="xs" :text="userAvatarText" />
              <span class="profile-name">{{ displayName }}</span>
            </UButton>
          </template>
      </UDashboardNavbar>

      <UDashboardToolbar v-if="breadcrumbItems.length > 1">
        <UBreadcrumb :items="breadcrumbItems" />
      </UDashboardToolbar>

      <div class="content">
        <router-view />
      </div>
    </UDashboardPanel>

    <UModal
      v-model:open="profileModalVisible"
      title="个人信息"
      :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <dl class="profile-list">
          <div><dt>用户名</dt><dd>{{ currentUser?.username || '-' }}</dd></div>
          <div><dt>姓名</dt><dd>{{ currentUser?.realName || '-' }}</dd></div>
          <div><dt>角色</dt><dd>{{ currentUser?.role || '-' }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ formatTime(currentUser?.createTime) }}</dd></div>
        </dl>
      </template>
      <template #footer>
        <div class="profile-actions">
          <UButton color="error" variant="soft" icon="i-lucide-log-out" block @click="handleLogout">
            退出登录
          </UButton>
        </div>
      </template>
    </UModal>

    <ToastBridge />
  </UDashboardGroup>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppThemeMenu from '../components/AppThemeMenu.vue'
import ToastBridge from '../components/ToastBridge.vue'
import { alarmApi, authApi, processTaskApi } from '../api'
import { useCurrentTask } from '../composables/useCurrentTask'
import { clearAuthSession, getCurrentUser } from '../utils/auth'

const router = useRouter()
const route = useRoute()
const currentTask = useCurrentTask()

const navItems = computed(() => [
  { label: '总览', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: '数据可视化', icon: 'i-lucide-line-chart', to: '/data-viz' },
  { label: '数据采集', icon: 'i-lucide-radio-tower', to: '/data-collection' },
  { label: '数据处理', icon: 'i-lucide-cog', to: '/data-process' },
  { label: '数据校准', icon: 'i-lucide-sliders-horizontal', to: '/calibration' },
  { label: '告警管理', icon: 'i-lucide-bell-ring', to: '/alarm' },
  {
    label: '系统配置',
    icon: 'i-lucide-settings',
    defaultOpen: route.path.startsWith('/config'),
    children: [
      { label: '采集代理管理', icon: 'i-lucide-server', to: '/config/agents' },
      { label: '日志管理', icon: 'i-lucide-scroll-text', to: '/config/log' },
      { label: '用户管理', icon: 'i-lucide-users', to: '/config/user' }
    ]
  }
])

const flatNavLookup = computed(() => {
  const map = new Map()
  navItems.value.forEach((item) => {
    if (item.to) map.set(item.to, { label: item.label, parent: null })
    item.children?.forEach((child) => {
      if (child.to) map.set(child.to, { label: child.label, parent: item })
    })
  })
  return map
})

const pageTitle = computed(() => {
  const hit = flatNavLookup.value.get(route.path)
  return hit?.label || '数据处理软件'
})

const breadcrumbItems = computed(() => {
  const hit = flatNavLookup.value.get(route.path)
  if (!hit) return []
  const crumbs = []
  if (hit.parent) crumbs.push({ label: hit.parent.label, icon: hit.parent.icon })
  crumbs.push({ label: hit.label })
  return crumbs
})

const alarmCount = ref(0)
const recentAlarms = ref([])
const alarmPopoverVisible = ref(false)
const loadingAlarms = ref(false)
const loadingTasks = ref(false)
const experimentTasks = ref([])
const profileModalVisible = ref(false)
const currentUser = ref(getCurrentUser())

const displayName = computed(() => currentUser.value?.realName || currentUser.value?.username || '用户')
const userAvatarText = computed(() => displayName.value.slice(0, 1))
const taskSelectValue = computed({
  get: () => currentTask.id.value || '',
  set: (value) => {
    if (value) currentTask.set(value)
    else currentTask.clear()
  }
})

const fallbackExperimentTasks = [
  { value: 'telemetry-joint-test', label: '综合遥测试验任务' },
  { value: 'link-stability-test', label: '链路稳定性试验任务' },
  { value: 'payload-parameter-test', label: '载荷参数试验任务' }
]

const taskOptionLabel = (task) => task?.taskName || task?.name || task?.title || `试验任务 ${task?.id || ''}`.trim()
const taskOptionValue = (task) => String(task?.id ?? task?.taskId ?? task?.taskName ?? task?.name ?? '')

const experimentTaskOptions = computed(() => {
  const source = Array.isArray(experimentTasks.value) ? experimentTasks.value : []
  const options = source
    .map(task => ({ value: taskOptionValue(task), label: taskOptionLabel(task) }))
    .filter(task => task.value && task.label)
  const normalized = options.length ? options : fallbackExperimentTasks
  const selected = taskSelectValue.value

  if (selected && !normalized.some(task => task.value === selected)) {
    return [{ value: selected, label: `试验任务 ${selected}` }, ...normalized]
  }
  return normalized
})

const getLevelColor = (level) => {
  const colors = { CRITICAL: 'error', WARNING: 'warning', INFO: 'info' }
  return colors[level] || 'neutral'
}

const getLevelText = (level) => {
  const texts = { CRITICAL: '严重', WARNING: '一般', INFO: '提示' }
  return texts[level] || level
}

const loadRecentAlarms = async () => {
  loadingAlarms.value = true
  try {
    const res = await alarmApi.getList()
    const data = res.data?.data || res.data || []
    recentAlarms.value = data.slice(0, 5)
    alarmCount.value = data.filter((a) => a.status === '未处理').length
  } catch (error) {
    console.error('Failed to load alarms:', error)
  } finally {
    loadingAlarms.value = false
  }
}

const loadExperimentTasks = async () => {
  loadingTasks.value = true
  try {
    const res = await processTaskApi.getAll()
    experimentTasks.value = res.data || []
  } catch (error) {
    console.error('Failed to load experiment tasks:', error)
    experimentTasks.value = []
  } finally {
    loadingTasks.value = false
  }
}

const viewAllAlarms = () => {
  alarmPopoverVisible.value = false
  router.push('/alarm')
}

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').replace('Z', '')
  return date.toLocaleString('zh-CN', { hour12: false })
}

const handleLogout = async () => {
  await authApi.logout()
  clearAuthSession()
  profileModalVisible.value = false
  router.replace('/login')
}

watch(() => route.path, () => {
  alarmPopoverVisible.value = false
})

loadRecentAlarms()
loadExperimentTasks()
</script>

<style scoped>
:global(.top-navbar) {
  position: relative;
  min-height: 48px;
}

:global(.top-navbar [data-slot="right"]) {
  flex: 0 0 auto;
  min-width: 0;
  justify-content: flex-end;
  position: relative;
  z-index: 2;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ui-primary);
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-brand.collapsed {
  justify-content: center;
}

.brand-icon {
  width: 18px;
  height: 18px;
  flex: none;
}

.brand-text {
  letter-spacing: 0.3px;
}

.page-title {
  min-width: 0;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
}

.global-task-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.global-task-label {
  flex: none;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.global-task-select {
  width: 220px;
  height: 32px;
  min-width: 180px;
  max-width: 24vw;
  padding: 0 32px 0 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  outline: none;
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-size: 13px;
  line-height: 32px;
  cursor: pointer;
}

.global-task-select:hover {
  border-color: var(--ui-primary);
}

.global-task-select:focus {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-primary) 22%, transparent);
}

.global-task-select:disabled {
  cursor: wait;
  opacity: 0.65;
}

.profile-button {
  max-width: 142px;
}

.profile-name {
  max-width: 86px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1500px) {
  .global-task-label {
    display: none;
  }

  .global-task-select {
    width: 190px;
    min-width: 170px;
  }

  .profile-name {
    display: none;
  }
}

.alarm-popover {
  display: flex;
  flex-direction: column;
  max-height: 460px;
}

.alarm-popover-title {
  padding: 12px 14px 10px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  border-bottom: 1px solid var(--ui-border);
}

.alarm-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 12px;
  color: var(--ui-text-muted);
  font-size: 13px;
}

.alarm-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alarm-item {
  padding: 10px;
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius);
  border-left: 3px solid transparent;
}

.alarm-item.alarm-level-CRITICAL { border-left-color: var(--ui-error); }
.alarm-item.alarm-level-WARNING  { border-left-color: var(--ui-warning); }
.alarm-item.alarm-level-INFO     { border-left-color: var(--ui-info); }

.alarm-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.alarm-time {
  font-size: 12px;
  color: var(--ui-text-dimmed);
}

.alarm-source {
  font-size: 13px;
  color: var(--ui-text-highlighted);
  margin-bottom: 2px;
}

.alarm-message {
  font-size: 12px;
  color: var(--ui-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alarm-popover-footer {
  padding: 6px 8px;
  border-top: 1px solid var(--ui-border);
}

.profile-list {
  margin: 0;
  display: grid;
  gap: 10px;
}

.profile-list > div {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-muted);
}

.profile-list > div:last-child { border-bottom: 0; }

.profile-list dt {
  color: var(--ui-text-muted);
  font-size: 13px;
}

.profile-list dd {
  margin: 0;
  color: var(--ui-text-highlighted);
}

.profile-actions {
  padding: 0 4px 4px;
}
</style>
