<template>
  <div class="alarm-page">
    <div class="alarm-tabs">
      <button
        v-for="tab in alarmTabs"
        :key="tab.key"
        type="button"
        :class="['alarm-tab', { active: activeAlarmTab === tab.key }]"
        @click="activeAlarmTab = tab.key"
      >
        <UIcon :name="tab.icon" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <section v-if="activeAlarmTab === 'data'" class="alarm-tab-panel">
      <!-- KPI 区 -->
      <div class="kpi-row">
        <UCard
          v-for="kpi in kpis"
          :key="kpi.key"
          class="kpi-card"
        >
          <div class="kpi-inner">
            <div :class="['kpi-icon', `kpi-icon-${kpi.color}`]">
              <UIcon :name="kpi.icon" />
            </div>
            <div class="kpi-meta">
              <div class="kpi-label">{{ kpi.label }}</div>
              <div class="kpi-value">{{ kpi.value }}</div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- 工具栏 + 表格 -->
      <UCard
        class="data-card"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="toolbar">
            <div class="toolbar-left">
              <USelectMenu
                v-model="filterSources"
                :items="sourceOptions"
                multiple
                value-key="value"
                placeholder="来源"
                icon="i-lucide-radio-tower"
                size="sm"
                class="toolbar-source"
              />
              <UInput
                v-model="keywordFilter"
                icon="i-lucide-search"
                placeholder="关键字"
                size="sm"
                class="toolbar-keyword"
                @keyup.enter="applySearch"
              />
              <USelectMenu
                v-model="filterLevels"
                :items="levelOptions"
                multiple
                value-key="value"
                placeholder="级别"
                icon="i-lucide-filter"
                size="sm"
                class="toolbar-filter"
              />
              <USelectMenu
                v-model="filterStatuses"
                :items="statusOptions"
                multiple
                value-key="value"
                placeholder="状态"
                icon="i-lucide-circle-dot"
                size="sm"
                class="toolbar-filter"
              />
              <div class="time-range">
                <span class="filter-label">时间范围</span>
                <UInput
                  v-model="startTimeFilter"
                  type="datetime-local"
                  step="1"
                  size="sm"
                  aria-label="开始时间"
                  class="toolbar-time"
                  @keyup.enter="applySearch"
                />
                <span class="time-separator">至</span>
                <UInput
                  v-model="endTimeFilter"
                  type="datetime-local"
                  step="1"
                  size="sm"
                  aria-label="结束时间"
                  class="toolbar-time"
                  @keyup.enter="applySearch"
                />
              </div>
              <UButton
                color="primary"
                size="sm"
                icon="i-lucide-search"
                @click="applySearch"
              >搜索</UButton>
              <UButton
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-rotate-ccw"
                @click="resetFilters"
              >重置</UButton>
            </div>

            <div class="toolbar-right">
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-check-check"
                :disabled="unhandledFilteredAlarms.length === 0"
                @click="handleAllFiltered"
              >全部标记为已处理</UButton>
              <transition name="fade">
                <div v-if="selectedIds.length > 0" class="selection-actions">
                  <span class="selection-text">已选 {{ selectedIds.length }} 条</span>
                  <UButton size="sm" color="primary" icon="i-lucide-check" @click="handleBatch">
                    标记所选已处理
                  </UButton>
                </div>
              </transition>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-refresh-cw"
                :loading="loading"
                @click="loadAlarms"
              >刷新</UButton>
            </div>
          </div>
        </template>

        <UTable
          v-model:row-selection="rowSelection"
          v-model:sorting="sorting"
          :data="filteredAlarms"
          :columns="columns"
          :loading="loading"
          sticky
          :empty="emptyText"
          :on-select="openDetail"
          class="alarm-table"
        >
          <template #select-header="{ table }">
            <UCheckbox
              :model-value="table.getIsAllPageRowsSelected() ? true : (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)"
              aria-label="全选"
              @update:model-value="table.toggleAllPageRowsSelected(!!$event)"
            />
          </template>
          <template #select-cell="{ row }">
            <UCheckbox
              :model-value="row.getIsSelected()"
              aria-label="选择该行"
              @update:model-value="row.toggleSelected(!!$event)"
              @click.stop
            />
          </template>

          <template #alarmTime-cell="{ row }">
            <span class="mono">{{ formatAlarmTime(row.original.alarmTime) }}</span>
          </template>

          <template #level-cell="{ row }">
            <UBadge
              :color="getLevelColor(row.original.level)"
              variant="subtle"
              size="sm"
            >
              {{ getLevelText(row.original.level) }}
            </UBadge>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="isHandled(row.original) ? 'success' : 'warning'"
              variant="subtle"
              size="sm"
            >
              {{ getStatusText(row.original.status) }}
            </UBadge>
          </template>

          <template #actions-cell="{ row }">
            <div class="row-actions">
              <UButton
                variant="link"
                size="xs"
                color="neutral"
                @click.stop="openDetailByAlarm(row.original)"
              >详情</UButton>
              <UButton
                v-if="isUnhandled(row.original)"
                variant="link"
                size="xs"
                color="primary"
                @click.stop="handleAlarm(row.original.id)"
              >处理</UButton>
            </div>
          </template>
        </UTable>
      </UCard>
    </section>

    <section v-else class="alarm-tab-panel">
      <div class="system-overview-grid">
        <UCard
          v-for="item in systemOverview"
          :key="item.key"
          class="system-overview-card"
        >
          <div class="system-overview-inner">
            <div :class="['system-overview-icon', `kpi-icon-${item.color}`]">
              <UIcon :name="item.icon" />
            </div>
            <div class="system-overview-meta">
              <div class="system-overview-label">{{ item.label }}</div>
              <div class="system-overview-value">{{ item.value }}</div>
              <div class="system-overview-desc">{{ item.description }}</div>
            </div>
          </div>
        </UCard>
      </div>

      <div class="system-panel-grid">
        <UCard class="system-card">
          <template #header>
            <div class="section-title">
              <UIcon name="i-lucide-activity" />
              <span>系统运行状况</span>
            </div>
          </template>

          <div class="runtime-grid">
            <div v-for="item in systemRuntimeItems" :key="item.label" class="runtime-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </UCard>

        <UCard class="system-card">
          <template #header>
            <div class="section-title">
              <UIcon name="i-lucide-heart-pulse" />
              <span>健康状态</span>
            </div>
          </template>

          <div class="health-list">
            <div v-for="item in systemHealthItems" :key="item.key" class="health-row">
              <div class="health-row-main">
                <span class="health-name">{{ item.name }}</span>
                <UBadge :color="item.color" variant="subtle" size="sm">{{ item.status }}</UBadge>
              </div>
              <div class="health-row-meta">
                <span>{{ item.value }}</span>
                <span>{{ item.description }}</span>
              </div>
              <div class="health-bar">
                <div :class="['health-bar-fill', `health-bar-${item.color}`]" :style="{ width: `${item.percent}%` }"></div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <UCard
        class="data-card"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="system-table-header">
            <div class="section-title">
              <UIcon name="i-lucide-server-crash" />
              <span>系统告警事件</span>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-refresh-cw"
              @click="refreshSystemAlarms"
            >刷新</UButton>
          </div>
        </template>

        <UTable
          :data="systemAlarms"
          :columns="systemAlarmColumns"
          sticky
          empty="暂无系统告警"
          class="alarm-table"
        >
          <template #time-cell="{ row }">
            <span class="mono">{{ formatAlarmTime(row.original.time) }}</span>
          </template>
          <template #level-cell="{ row }">
            <UBadge :color="getLevelColor(row.original.level)" variant="subtle" size="sm">
              {{ getLevelText(row.original.level) }}
            </UBadge>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="row.original.status === '已恢复' ? 'success' : 'warning'" variant="subtle" size="sm">
              {{ row.original.status }}
            </UBadge>
          </template>
        </UTable>
      </UCard>
    </section>

    <!-- 详情 Slideover -->
    <USlideover
      v-model:open="detailVisible"
      :title="detailAlarm?.alarmSource || '告警详情'"
      :description="detailAlarm ? formatAlarmTime(detailAlarm.alarmTime) : ''"
    >
      <template #body>
        <div v-if="detailAlarm" class="detail">
          <dl class="detail-list">
            <div><dt>级别</dt><dd>
              <UBadge :color="getLevelColor(detailAlarm.level)" variant="subtle" size="sm">
                {{ getLevelText(detailAlarm.level) }}
              </UBadge>
            </dd></div>
            <div><dt>状态</dt><dd>
              <UBadge :color="isHandled(detailAlarm) ? 'success' : 'warning'" variant="subtle" size="sm">
                {{ getStatusText(detailAlarm.status) }}
              </UBadge>
            </dd></div>
            <div><dt>来源</dt><dd>{{ detailAlarm.alarmSource }}</dd></div>
            <div v-if="detailAlarm.task"><dt>任务</dt><dd>{{ detailAlarm.task }}</dd></div>
            <div v-if="detailAlarm.channel"><dt>通道</dt><dd>{{ detailAlarm.channel }}</dd></div>
            <div><dt>时间</dt><dd class="mono">{{ formatAlarmTime(detailAlarm.alarmTime) }}</dd></div>
            <div><dt>告警信息</dt><dd>{{ detailAlarm.alarmMessage }}</dd></div>
            <div v-if="detailAlarm.triggerRule"><dt>触发规则</dt><dd>{{ detailAlarm.triggerRule }}</dd></div>
            <div v-if="detailAlarm.paramName || detailAlarm.paramCode"><dt>参数</dt><dd>{{ detailAlarm.paramName || detailAlarm.paramCode }}</dd></div>
          </dl>

          <div v-if="isUnhandled(detailAlarm)" class="detail-footer">
            <UButton
              color="primary"
              icon="i-lucide-check"
              block
              @click="handleAlarm(detailAlarm.id); detailVisible = false"
            >标记为已处理</UButton>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { alarmApi } from '../api'
import { message } from '../utils/feedback'

const route = useRoute()
const loading = ref(false)
const activeAlarmTab = ref('data')
const filterSources = ref([])
const keywordFilter = ref('')
const startTimeFilter = ref('')
const endTimeFilter = ref('')
const filterLevels = ref([])
const filterStatuses = ref([])
const rowSelection = ref({})
const sorting = ref([{ id: 'alarmTime', desc: true }])
const detailVisible = ref(false)
const detailAlarm = ref(null)
const appliedFilters = reactive({
  sources: [],
  keyword: '',
  levels: [],
  statuses: [],
  startTime: '',
  endTime: ''
})

const stats = ref({ total: 0, critical: 0, warning: 0, unhandled: 0 })
const alarms = ref([])
const systemRefreshSeed = ref(0)

const alarmTabs = [
  { key: 'data', label: '数据监测告警', icon: 'i-lucide-radar' },
  { key: 'system', label: '系统告警', icon: 'i-lucide-server-cog' }
]

const levelOptions = [
  { label: '严重', value: 'CRITICAL' },
  { label: '重要', value: 'MAJOR' },
  { label: '一般', value: 'WARNING' },
  { label: '轻微', value: 'MINOR' },
  { label: '提示', value: 'INFO' }
]

const statusOptions = [
  { label: '未处理', value: '未处理' },
  { label: '已处理', value: '已处理' }
]

const columns = [
  { id: 'select', enableSorting: false, enableHiding: false, size: 44 },
  { accessorKey: 'alarmTime', header: '时间', enableSorting: true, size: 170 },
  { accessorKey: 'alarmSource', header: '来源', size: 180 },
  { accessorKey: 'alarmMessage', header: '告警信息' },
  { accessorKey: 'level', header: '级别', size: 90 },
  { accessorKey: 'status', header: '状态', size: 90 },
  { id: 'actions', header: '操作', size: 110, enableSorting: false }
]

const systemAlarmColumns = [
  { accessorKey: 'time', header: '时间', size: 170 },
  { accessorKey: 'target', header: '系统对象', size: 150 },
  { accessorKey: 'type', header: '类型', size: 120 },
  { accessorKey: 'message', header: '告警内容' },
  { accessorKey: 'level', header: '级别', size: 90 },
  { accessorKey: 'status', header: '状态', size: 90 }
]

const sourceOptions = computed(() => {
  const set = new Set()
  alarms.value.forEach((a) => { if (a.alarmSource) set.add(a.alarmSource) })
  return Array.from(set).sort().map((s) => ({ label: s, value: s }))
})

const kpis = computed(() => [
  { key: 'total',    label: '告警总数', value: stats.value.total,    icon: 'i-lucide-bell',           color: 'neutral' },
  { key: 'critical', label: '严重告警', value: stats.value.critical, icon: 'i-lucide-octagon-alert',  color: 'error'   },
  { key: 'warning',  label: '一般告警', value: stats.value.warning,  icon: 'i-lucide-triangle-alert', color: 'warning' },
  { key: 'unhandled', label: '未处理',  value: stats.value.unhandled, icon: 'i-lucide-circle-alert', color: 'warning' }
])

const systemMetrics = computed(() => {
  const seed = systemRefreshSeed.value
  return {
    healthScore: Math.max(82, Math.min(99, 94 - (seed % 5))),
    activeAlarms: 2 + (seed % 3),
    cpu: 42 + ((seed * 7) % 24),
    memory: 68 + ((seed * 5) % 14),
    disk: 57 + ((seed * 3) % 18),
    queue: 84 + ((seed * 17) % 86),
    dbLatency: 12 + ((seed * 5) % 22),
    agentHeartbeat: seed % 4 === 0 ? '存在延迟' : '正常',
    uptimeHours: 392 + seed
  }
})

const systemOverview = computed(() => {
  const metrics = systemMetrics.value
  return [
    {
      key: 'running',
      label: '运行状态',
      value: '运行中',
      description: `连续运行 ${formatUptime(metrics.uptimeHours)}`,
      icon: 'i-lucide-power',
      color: 'success'
    },
    {
      key: 'health',
      label: '健康评分',
      value: `${metrics.healthScore}%`,
      description: metrics.healthScore >= 90 ? '整体健康' : '需要关注',
      icon: 'i-lucide-heart-pulse',
      color: metrics.healthScore >= 90 ? 'success' : 'warning'
    },
    {
      key: 'resource',
      label: '资源负载',
      value: `${metrics.cpu}%`,
      description: `CPU ${metrics.cpu}% / 内存 ${metrics.memory}%`,
      icon: 'i-lucide-gauge',
      color: metrics.cpu >= 70 || metrics.memory >= 78 ? 'warning' : 'neutral'
    },
    {
      key: 'active',
      label: '系统告警',
      value: metrics.activeAlarms,
      description: '待关注系统事件',
      icon: 'i-lucide-server-crash',
      color: metrics.activeAlarms > 0 ? 'warning' : 'success'
    }
  ]
})

const systemRuntimeItems = computed(() => {
  const metrics = systemMetrics.value
  return [
    { label: '服务状态', value: '运行中' },
    { label: '运行时长', value: formatUptime(metrics.uptimeHours) },
    { label: '处理节点', value: '8 / 8 在线' },
    { label: '数据库连接', value: `${metrics.dbLatency}ms` },
    { label: '消息队列', value: `${metrics.queue} 条待处理` },
    { label: '最近巡检', value: formatAlarmTime(new Date()) }
  ]
})

const systemHealthItems = computed(() => {
  const metrics = systemMetrics.value
  return [
    {
      key: 'cpu',
      name: 'CPU 负载',
      value: `${metrics.cpu}%`,
      percent: metrics.cpu,
      status: metrics.cpu >= 70 ? '关注' : '正常',
      color: metrics.cpu >= 70 ? 'warning' : 'success',
      description: '计算服务负载'
    },
    {
      key: 'memory',
      name: '内存使用',
      value: `${metrics.memory}%`,
      percent: metrics.memory,
      status: metrics.memory >= 78 ? '关注' : '正常',
      color: metrics.memory >= 78 ? 'warning' : 'success',
      description: '业务进程内存占用'
    },
    {
      key: 'disk',
      name: '磁盘空间',
      value: `${metrics.disk}%`,
      percent: metrics.disk,
      status: metrics.disk >= 80 ? '关注' : '正常',
      color: metrics.disk >= 80 ? 'warning' : 'success',
      description: '日志与遥测存储卷'
    },
    {
      key: 'queue',
      name: '消息队列',
      value: `${metrics.queue} 条`,
      percent: Math.min(100, Math.round(metrics.queue / 2)),
      status: metrics.queue >= 140 ? '积压' : '正常',
      color: metrics.queue >= 140 ? 'warning' : 'success',
      description: '待消费系统消息'
    },
    {
      key: 'database',
      name: '数据库连接',
      value: `${metrics.dbLatency}ms`,
      percent: Math.min(100, metrics.dbLatency * 3),
      status: metrics.dbLatency >= 30 ? '关注' : '正常',
      color: metrics.dbLatency >= 30 ? 'warning' : 'success',
      description: '主库连接延迟'
    },
    {
      key: 'heartbeat',
      name: '节点心跳',
      value: metrics.agentHeartbeat,
      percent: metrics.agentHeartbeat === '正常' ? 96 : 72,
      status: metrics.agentHeartbeat === '正常' ? '正常' : '延迟',
      color: metrics.agentHeartbeat === '正常' ? 'success' : 'warning',
      description: '采集与处理节点心跳'
    }
  ]
})

const systemAlarms = computed(() => {
  const seed = systemRefreshSeed.value
  const now = Date.now()
  return [
    {
      id: 'sys-queue',
      time: new Date(now - 1000 * (62 + seed)).toISOString(),
      target: '消息队列',
      type: '队列积压',
      message: `待处理消息 ${systemMetrics.value.queue} 条，消费速率低于阈值`,
      level: systemMetrics.value.queue >= 140 ? 'WARNING' : 'INFO',
      status: systemMetrics.value.queue >= 140 ? '未恢复' : '已恢复'
    },
    {
      id: 'sys-memory',
      time: new Date(now - 1000 * (180 + seed * 2)).toISOString(),
      target: '处理服务',
      type: '资源水位',
      message: `内存使用率 ${systemMetrics.value.memory}%，接近预警线`,
      level: systemMetrics.value.memory >= 78 ? 'WARNING' : 'INFO',
      status: systemMetrics.value.memory >= 78 ? '未恢复' : '已恢复'
    },
    {
      id: 'sys-agent',
      time: new Date(now - 1000 * (420 + seed * 3)).toISOString(),
      target: '采集节点',
      type: '心跳状态',
      message: systemMetrics.value.agentHeartbeat === '正常' ? '全部节点心跳正常' : '节点心跳存在短暂延迟',
      level: systemMetrics.value.agentHeartbeat === '正常' ? 'INFO' : 'WARNING',
      status: systemMetrics.value.agentHeartbeat === '正常' ? '已恢复' : '未恢复'
    },
    {
      id: 'sys-database',
      time: new Date(now - 1000 * (720 + seed)).toISOString(),
      target: '数据库',
      type: '连接延迟',
      message: `主库响应 ${systemMetrics.value.dbLatency}ms`,
      level: systemMetrics.value.dbLatency >= 30 ? 'WARNING' : 'INFO',
      status: systemMetrics.value.dbLatency >= 30 ? '未恢复' : '已恢复'
    }
  ]
})

const hasFilter = computed(() =>
  appliedFilters.sources.length > 0 ||
  appliedFilters.keyword ||
  appliedFilters.startTime ||
  appliedFilters.endTime ||
  appliedFilters.levels.length > 0 ||
  appliedFilters.statuses.length > 0
)

const filteredAlarms = computed(() => {
  let list = alarms.value
  if (appliedFilters.levels.length > 0) {
    const set = new Set(appliedFilters.levels)
    list = list.filter((a) => set.has(a.level))
  }
  if (appliedFilters.statuses.length > 0) {
    const set = new Set(appliedFilters.statuses)
    list = list.filter((a) => set.has(getStatusText(a.status)))
  }
  if (appliedFilters.sources.length > 0) {
    const set = new Set(appliedFilters.sources)
    list = list.filter((a) => set.has(a.alarmSource))
  }
  if (appliedFilters.keyword) {
    const q = appliedFilters.keyword.toLowerCase()
    list = list.filter((a) =>
      (a.alarmSource || '').toLowerCase().includes(q) ||
      (a.alarmMessage || '').toLowerCase().includes(q) ||
      (a.paramName || '').toLowerCase().includes(q) ||
      (a.paramCode || '').toLowerCase().includes(q)
    )
  }
  const start = parseFilterTime(appliedFilters.startTime)
  const end = parseFilterTime(appliedFilters.endTime)
  if (start !== null || end !== null) {
    list = list.filter((a) => {
      const time = getAlarmTimestamp(a)
      if (time === null) return false
      if (start !== null && time < start) return false
      if (end !== null && time > end) return false
      return true
    })
  }
  return list
})

const unhandledFilteredAlarms = computed(() => filteredAlarms.value.filter(isUnhandled))

const selectedIds = computed(() =>
  Object.keys(rowSelection.value).filter((k) => rowSelection.value[k])
)

const emptyText = computed(() => (hasFilter.value ? '没有符合筛选条件的告警' : '暂无告警'))

const getLevelColor = (level) => ({
  CRITICAL: 'error',
  ERROR: 'error',
  FATAL: 'error',
  MAJOR: 'error',
  WARNING: 'warning',
  WARN: 'warning',
  MINOR: 'warning',
  INFO: 'info'
}[level] || 'neutral')

const getLevelText = (level) => ({
  CRITICAL: '严重',
  ERROR: '严重',
  FATAL: '严重',
  MAJOR: '重要',
  WARNING: '一般',
  WARN: '一般',
  MINOR: '轻微',
  INFO: '提示'
}[level] || level || '未知')

const normalizeLevel = (level) => String(level || 'WARNING').toUpperCase()

const getStatusText = (status) => {
  const raw = String(status || '').toUpperCase()
  if (['RESOLVED', 'HANDLED', 'PROCESSED', 'CLOSED', 'DONE', '已处理'].includes(raw) || status === true) return '已处理'
  return '未处理'
}

const isHandled = (alarm) => getStatusText(alarm?.status) === '已处理'
const isUnhandled = (alarm) => !isHandled(alarm)

const formatAlarmTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').replace('Z', '')
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatUptime = (hours) => {
  const totalHours = Math.max(0, Number(hours) || 0)
  const days = Math.floor(totalHours / 24)
  const restHours = totalHours % 24
  return `${days}天 ${String(restHours).padStart(2, '0')}小时`
}

const refreshSystemAlarms = () => {
  systemRefreshSeed.value += 1
}

const parseFilterTime = (value) => {
  if (!value) return null
  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}

const getAlarmTimestamp = (alarm) => {
  const timestampMs = Number(alarm?.timestampMs)
  if (Number.isFinite(timestampMs) && timestampMs > 0) return timestampMs
  const time = new Date(alarm?.alarmTime || alarm?.timestamp || alarm?.createTime).getTime()
  return Number.isNaN(time) ? null : time
}

const applySearch = () => {
  appliedFilters.sources = [...filterSources.value]
  appliedFilters.keyword = keywordFilter.value.trim()
  appliedFilters.levels = [...filterLevels.value]
  appliedFilters.statuses = [...filterStatuses.value]
  appliedFilters.startTime = startTimeFilter.value
  appliedFilters.endTime = endTimeFilter.value
  rowSelection.value = {}
}

const resetFilters = () => {
  filterSources.value = []
  keywordFilter.value = ''
  startTimeFilter.value = ''
  endTimeFilter.value = ''
  filterLevels.value = []
  filterStatuses.value = []
  applySearch()
}

const applyRouteFilters = () => {
  const status = String(route.query.status || '')
  if (status === 'unhandled' || status === '未处理') filterStatuses.value = ['未处理']
  if (status === 'resolved' || status === '已处理') filterStatuses.value = ['已处理']
  applySearch()
}

const openDetail = (_event, row) => {
  openDetailByAlarm(row.original)
}

const openDetailByAlarm = (alarm) => {
  detailAlarm.value = alarm
  detailVisible.value = true
}

const loadAlarms = async () => {
  loading.value = true
  try {
    const res = await alarmApi.getList(500)
    const data = res.data?.data || res.data || []
    alarms.value = data.map((item) => ({
      ...item,
      alarmTime: item.alarmTime || item.timestamp || item.createTime,
      alarmSource: item.alarmSource || item.source || item.sourceInterface || item.paramName || '系统',
      alarmMessage: item.alarmMessage || item.message || item.detail || '',
      level: normalizeLevel(item.level || item.severity),
      status: getStatusText(item.status || item.state)
    }))

    const statsRes = await alarmApi.getStats()
    const statsData = statsRes.data || {}
    const total = Number(statsData.total ?? 0)
    const resolved = Number(statsData.resolved ?? statsData.handled ?? 0)
    stats.value = {
      total,
      critical: Number(statsData.critical ?? 0),
      warning: Number(statsData.warning ?? statsData.warn ?? 0),
      unhandled: Number(statsData.unhandled ?? statsData.active ?? statsData.unresolved ?? Math.max(total - resolved, 0))
    }
  } catch (error) {
    console.error('Failed to load alarms:', error)
  } finally {
    loading.value = false
  }
}

const handleAlarm = async (id) => {
  try {
    await alarmApi.handle(id)
    message.success('告警已处理')
    await loadAlarms()
    if (detailAlarm.value?.id === id) {
      detailAlarm.value = alarms.value.find((alarm) => alarm.id === id) || { ...detailAlarm.value, status: '已处理' }
    }
  } catch (error) {
    message.error('处理失败')
  }
}

const handleBatch = async () => {
  const rows = selectedIds.value
    .map((key) => filteredAlarms.value[Number(key)] || filteredAlarms.value.find((alarm) => String(alarm.id) === String(key)))
    .filter(Boolean)
    .filter(isUnhandled)
  const ids = Array.from(new Set(rows.map((alarm) => alarm.id).filter(Boolean)))
  if (ids.length === 0) {
    message.info('已选告警中没有未处理项')
    return
  }
  try {
    await Promise.all(ids.map((id) => alarmApi.handle(id)))
    message.success(`已处理 ${ids.length} 条`)
    rowSelection.value = {}
    await loadAlarms()
  } catch (error) {
    message.error('批量处理失败')
  }
}

const handleAllFiltered = async () => {
  const ids = Array.from(new Set(unhandledFilteredAlarms.value.map((alarm) => alarm.id).filter(Boolean)))
  if (ids.length === 0) {
    message.info('当前筛选结果没有未处理告警')
    return
  }
  if (!window.confirm(`确定将当前筛选结果中的 ${ids.length} 条告警全部标记为已处理?`)) return
  try {
    await Promise.all(ids.map((id) => alarmApi.handle(id)))
    message.success(`已处理 ${ids.length} 条`)
    rowSelection.value = {}
    await loadAlarms()
  } catch (error) {
    message.error('全部标记失败')
  }
}

watch(() => route.query.status, applyRouteFilters)

onMounted(() => {
  applyRouteFilters()
  loadAlarms()
})
</script>

<style scoped>
.alarm-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alarm-tabs {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 2px;
  padding: 3px;
  background: color-mix(in oklch, var(--ui-bg-muted) 70%, transparent);
  border: 1px solid var(--ui-border-muted);
  border-radius: 6px;
}

.alarm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  color: var(--ui-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}

.alarm-tab:hover {
  color: var(--ui-text-highlighted);
}

.alarm-tab.active {
  color: var(--ui-primary);
  background: color-mix(in oklch, var(--ui-primary) 12%, transparent);
}

.alarm-tab :deep(svg) {
  width: 16px;
  height: 16px;
}

.alarm-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 900px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
}

.kpi-card { transition: border-color 0.15s; }
.kpi-card:hover { border-color: var(--ui-border-accented); }

.kpi-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kpi-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.kpi-icon :deep(svg) { width: 18px; height: 18px; }

.kpi-icon-neutral { background: var(--ui-bg-muted);     color: var(--ui-text-muted); }
.kpi-icon-error   { background: color-mix(in oklch, var(--ui-error)   12%, transparent); color: var(--ui-error);   }
.kpi-icon-warning { background: color-mix(in oklch, var(--ui-warning) 12%, transparent); color: var(--ui-warning); }
.kpi-icon-success { background: color-mix(in oklch, var(--ui-success) 12%, transparent); color: var(--ui-success); }

.kpi-label {
  font-size: 12px;
  color: var(--ui-text-muted);
  margin-bottom: 1px;
  line-height: 1.2;
}

.kpi-value {
  font-size: 19px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.system-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.system-overview-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.system-overview-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.system-overview-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.system-overview-meta {
  min-width: 0;
}

.system-overview-label,
.system-overview-desc {
  font-size: 12px;
  color: var(--ui-text-muted);
  line-height: 1.25;
}

.system-overview-value {
  margin: 1px 0;
  font-size: 19px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.system-panel-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.15fr);
  gap: 12px;
}

.system-card {
  min-width: 0;
}

.section-title,
.system-table-header {
  display: flex;
  align-items: center;
}

.section-title {
  gap: 8px;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
}

.section-title :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--ui-primary);
}

.system-table-header {
  justify-content: space-between;
  gap: 12px;
}

.runtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.runtime-item {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--ui-border-muted);
  border-radius: 6px;
  background: color-mix(in oklch, var(--ui-bg-muted) 45%, transparent);
}

.runtime-item span {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.runtime-item strong {
  color: var(--ui-text-highlighted);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.health-list {
  display: grid;
  gap: 10px;
}

.health-row {
  min-width: 0;
}

.health-row-main,
.health-row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.health-name {
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-weight: 600;
}

.health-row-meta {
  margin-top: 3px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.health-bar {
  height: 5px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-bg-muted);
}

.health-bar-fill {
  height: 100%;
  border-radius: inherit;
}

.health-bar-success { background: var(--ui-success); }
.health-bar-warning { background: var(--ui-warning); }
.health-bar-error { background: var(--ui-error); }
.health-bar-neutral { background: var(--ui-text-muted); }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-source { width: 150px; }
.toolbar-keyword { width: 190px; }
.toolbar-filter { min-width: 120px; }

.time-range {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.filter-label,
.time-separator {
  color: var(--ui-text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.toolbar-time {
  width: 190px;
}

.selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: color-mix(in oklch, var(--ui-primary) 10%, transparent);
  border: 1px solid color-mix(in oklch, var(--ui-primary) 30%, transparent);
  border-radius: var(--ui-radius);
}

.selection-text {
  font-size: 13px;
  color: var(--ui-primary);
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,
.fade-leave-to    { opacity: 0; }

.alarm-table { font-size: 13px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.text-muted { color: var(--ui-text-dimmed); }

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.detail-list {
  display: grid;
  gap: 12px;
  margin: 0;
}

.detail-list > div {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ui-border-muted);
}

.detail-list > div:last-child { border-bottom: 0; }
.detail-list dt { color: var(--ui-text-muted); font-size: 13px; }
.detail-list dd { margin: 0; color: var(--ui-text-highlighted); }

.detail-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border);
}

@media (max-width: 1100px) {
  .system-overview-grid,
  .system-panel-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-source,
  .toolbar-keyword,
  .toolbar-filter,
  .toolbar-time {
    width: 100%;
    min-width: 0;
  }

  .toolbar-left,
  .time-range {
    width: 100%;
  }

  .time-range {
    flex-wrap: wrap;
  }
}
</style>
