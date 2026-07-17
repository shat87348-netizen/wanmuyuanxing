<template>
  <div class="agent-registry">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="采集代理总数" :value="agentStats.total" />
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="在线采集代理" :value="agentStats.online" :value-style="{ color: 'var(--ui-success)' }" />
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="异常采集代理" :value="agentStats.error" :value-style="{ color: 'var(--ui-error)' }" />
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="采集协议" :value="agentStats.protocols" />
        </UiCard>
      </UiCol>
    </UiRow>

    <div class="agent-workspace">
      <UiCard title="采集代理列表" class="data-card agent-table-card">
        <template #extra>
          <UiButton type="primary" size="small" @click="loadAgents" :loading="agentLoading">刷新</UiButton>
        </template>
        <UiTable
          :columns="agentColumns"
          :data-source="agentRows"
          :loading="agentLoading"
          row-key="agentId"
          size="small"
          :pagination="false"
          :custom-row="getAgentRowProps"
          :row-class-name="getAgentRowClass"
          class="agent-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'agentId'">
              <span class="agent-id-cell">{{ record.agentLabel }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <UiTag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</UiTag>
            </template>
            <template v-else-if="column.key === 'lastHeartbeat'">
              <span class="muted-text table-time">{{ record.lastHeartbeatText }}</span>
            </template>
          </template>
        </UiTable>
      </UiCard>

      <UiCard :title="selectedAgent ? selectedAgent.agentLabel : '采集代理详情'" class="data-card agent-detail-card">
        <template #extra>
          <div v-if="selectedAgent" class="agent-card-actions">
            <span class="status-pill" :class="'status-' + getStatusTone(selectedAgent.status)">
              <span class="status-dot" />
              {{ getStatusText(selectedAgent.status) }}
            </span>
            <UiButton
              size="small"
              :disabled="selectedAgent.instances.length === 0 || !agentControlSupported"
              :loading="isAgentBusy(selectedAgent, 'stop')"
              :title="agentControlUnsupportedTip"
              @click="stopAgent(selectedAgent)"
            >
              停止
            </UiButton>
            <UiButton
              type="primary"
              size="small"
              :disabled="selectedAgent.instances.length === 0 || !agentControlSupported"
              :loading="isAgentBusy(selectedAgent, 'restart')"
              :title="agentControlUnsupportedTip"
              @click="restartAgent(selectedAgent)"
            >
              重启
            </UiButton>
            <UiPopconfirm title="确定删除此采集代理?" @confirm="deleteAgent(selectedAgent.agentId)" ok-text="确定" cancel-text="取消">
              <UiButton size="small" danger>删除</UiButton>
            </UiPopconfirm>
          </div>
        </template>

        <template v-if="selectedAgent">
          <div class="agent-meta-grid">
            <div class="agent-meta-item">
              <span>主机</span>
              <strong>{{ selectedAgent.host }}</strong>
            </div>
            <div class="agent-meta-item">
              <span>首次注册</span>
              <strong>{{ selectedAgent.firstSeenText }}</strong>
            </div>
            <div class="agent-meta-item">
              <span>最后心跳</span>
              <strong>{{ selectedAgent.lastHeartbeatText }}</strong>
            </div>
            <div class="agent-meta-item">
              <span>采集协议</span>
              <strong>{{ selectedAgent.protocolText }}</strong>
            </div>
            <div class="agent-meta-item">
              <span>速率</span>
              <strong>{{ selectedAgent.totalRateText }}</strong>
            </div>
            <div class="agent-meta-item">
              <span>消息数量</span>
              <strong>{{ selectedAgent.totalMessagesText }}</strong>
            </div>
          </div>

          <div class="resource-grid">
            <div>
              <div class="resource-label">
                <span>CPU</span>
                <span>{{ formatPercent(selectedAgent.cpuUsage) }}</span>
              </div>
              <UiProgress :percent="toPercent(selectedAgent.cpuUsage)" />
            </div>
            <div>
              <div class="resource-label">
                <span>内存</span>
                <span>{{ formatPercent(selectedAgent.memUsage) }}</span>
              </div>
              <UiProgress :percent="toPercent(selectedAgent.memUsage)" />
            </div>
          </div>

          <div class="instance-list">
            <div v-for="instance in selectedAgent.instances" :key="instance.interfaceInstanceId || instance.protocol" class="instance-item">
              <div class="instance-main">
                <div>
                  <strong>{{ instance.protocol || '-' }}</strong>
                  <span class="muted-text">#{{ instance.interfaceInstanceId || '-' }}</span>
                </div>
                <div class="instance-main-right">
                  <UiTag :color="getStatusColor(instance.state)" size="small">{{ getStatusText(instance.state) }}</UiTag>
                </div>
              </div>

              <div class="instance-metrics">
                <span>速率 {{ formatRate(instance.rxRate) }}</span>
                <span>消息 {{ formatNumber(instance.rxMessages) }}</span>
                <span>字节 {{ formatBytes(instance.rxBytes) }}</span>
                <span>异常 {{ formatNumber(instance.errorCount) }}</span>
              </div>

              <div class="instance-chart-block">
                <div class="instance-chart-head">
                  <span class="instance-chart-title">速率曲线</span>
                  <div class="metric-toggle">
                    <button
                      type="button"
                      :class="{ active: (instanceMetric[instance.interfaceInstanceId] || 'message') === 'message' }"
                      @click="setInstanceMetric(instance.interfaceInstanceId, 'message')"
                    >消息数量</button>
                    <button
                      type="button"
                      :class="{ active: (instanceMetric[instance.interfaceInstanceId] || 'message') === 'rate' }"
                      @click="setInstanceMetric(instance.interfaceInstanceId, 'rate')"
                    >网络速率</button>
                  </div>
                </div>
                <div class="instance-chart" :ref="(el) => setInstanceChartRef(instance.interfaceInstanceId, el)"></div>
              </div>

              <div v-if="instance.lastError" class="instance-error">{{ instance.lastError }}</div>
            </div>
            <div v-if="selectedAgent.instances.length === 0" class="empty-state">暂无采集接口实例</div>
          </div>

          <div class="event-section">
            <div class="section-title">接口通信异常事件</div>
            <div class="event-list">
              <div v-for="event in selectedAgent.communicationEvents" :key="event.key" class="event-item">
                <span class="event-dot" />
                <div class="event-content">
                  <div class="event-main">
                    <strong>{{ event.protocol }}</strong>
                    <span>{{ event.message }}</span>
                  </div>
                  <div class="event-meta">
                    <span>{{ event.timeText }}</span>
                    <span>{{ event.level }}</span>
                  </div>
                </div>
              </div>
              <div v-if="selectedAgent.communicationEvents.length === 0" class="empty-state compact">暂无接口通信异常事件</div>
            </div>
          </div>
        </template>
        <div v-else class="empty-state">暂无采集代理数据</div>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, nextTick, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { agentApi } from '../api'
import { message } from '../utils/feedback'

const agentLoading = ref(false)
const rawAgents = ref([])
const selectedAgentId = ref('')
const agentActionKey = ref('')
const agentControlSupported = false
const agentControlUnsupportedTip = '当前后端暂未提供采集实例启停/重启控制接口'

const agentColumns = [
  { title: '采集代理', dataIndex: 'agentId', key: 'agentId', width: 110 },
  { title: '主机', dataIndex: 'host', key: 'host', width: 120 },
  { title: '状态', key: 'status', width: 74 },
  { title: '接口', dataIndex: 'instanceCount', key: 'instanceCount', width: 56 },
  { title: '心跳', key: 'lastHeartbeat', width: 150 }
]

const valueFrom = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  if (typeof value === 'string') return value.split(/[,，\s]+/).filter(Boolean)
  return [value]
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const formatPercent = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return `${Math.round((numeric > 1 ? numeric : numeric * 100) * 10) / 10}%`
}

const toPercent = (value) => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.min(100, numeric > 1 ? numeric : numeric * 100))
}

const formatNumber = (value) => {
  const numeric = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('zh-CN')
}

const formatRate = (value) => {
  const numeric = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(numeric)) return '0 条/s'
  return `${numeric.toLocaleString('zh-CN')} 条/s`
}

const toNumber = (value) => {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

const formatBytes = (value) => {
  const numeric = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(numeric)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = Math.max(0, numeric)
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${Math.round(size * 10) / 10} ${units[unitIndex]}`
}

const protocolName = (protocol) => {
  if (typeof protocol === 'string') return protocol
  return valueFrom(protocol, ['protocol', 'name', 'type', 'protocolType'])
}

const getProtocols = (agent, instances) => {
  const topLevel = toArray(valueFrom(agent, ['protocols', 'protocolList', 'collectProtocols'])).map(protocolName).filter(Boolean)
  const fromInstances = instances.map(instance => instance.protocol).filter(Boolean)
  return Array.from(new Set([...topLevel, ...fromInstances]))
}

const getCommunicationEvents = (agent, instances) => {
  const rawEvents = [
    ...toArray(valueFrom(agent, ['communicationEvents', 'interfaceEvents', 'eventList', 'events', 'exceptions'])),
    ...instances.flatMap(instance => toArray(valueFrom(instance.raw, ['communicationEvents', 'interfaceEvents', 'eventList', 'events', 'exceptions'])).map(event => ({
      ...event,
      protocol: valueFrom(event, ['protocol', 'interfaceProtocol']) || instance.protocol
    })))
  ]

  const normalizedEvents = rawEvents.map((event, index) => {
    const time = valueFrom(event, ['time', 'timestamp', 'eventTime', 'occurredAt', 'createdAt'])
    return {
      key: valueFrom(event, ['id', 'eventId']) || `raw-${index}`,
      protocol: valueFrom(event, ['protocol', 'interfaceProtocol', 'source']) || '-',
      message: valueFrom(event, ['message', 'description', 'detail', 'lastError', 'errorMessage']) || '接口通信异常',
      level: valueFrom(event, ['level', 'severity', 'type']) || '异常',
      timeText: formatDateTime(time)
    }
  })

  const syntheticEvents = instances
    .filter(instance => instance.lastError || toNumber(instance.errorCount) > 0 || ['ERROR', 'BLOCKED'].includes(instance.state))
    .map(instance => ({
      key: `instance-${instance.interfaceInstanceId || instance.protocol}`,
      protocol: instance.protocol || '-',
      message: instance.lastError || `近 1 分钟异常 ${formatNumber(instance.errorCount)} 次`,
      level: getStatusText(instance.state),
      timeText: formatDateTime(instance.lastErrorTime || instance.lastEventTime)
    }))

  return [...normalizedEvents, ...syntheticEvents].slice(0, 8)
}

const getAgentStatus = (agent, instances) => {
  const explicit = valueFrom(agent, ['status', 'state'])
  if (explicit) return explicit
  const states = instances.map(instance => instance.state).filter(Boolean)
  if (states.some(state => ['ERROR', 'BLOCKED'].includes(state))) return 'ERROR'
  if (states.some(state => state === 'RUNNING')) return 'ONLINE'
  if (states.some(state => state === 'STOPPED')) return 'STOPPED'
  return agent.lastHeartbeat ? 'ONLINE' : 'OFFLINE'
}

const normalizeAgent = (agent) => {
  const instances = toArray(valueFrom(agent, ['instances', 'interfaceInstances', 'channels'])).map(instance => ({
    raw: instance,
    interfaceInstanceId: valueFrom(instance, ['interfaceInstanceId', 'id', 'instanceId']),
    protocol: valueFrom(instance, ['protocol', 'name', 'type', 'protocolType']),
    state: valueFrom(instance, ['state', 'status']) || 'UNKNOWN',
    rxBytes: valueFrom(instance, ['rxBytes', 'receivedBytes']),
    rxMessages: valueFrom(instance, ['rxMessages', 'receivedMessages']),
    rxRate: valueFrom(instance, ['rxRate', 'rate', 'currentRate']),
    errorCount: valueFrom(instance, ['errorCount', 'errors']),
    lastError: valueFrom(instance, ['lastError', 'errorMessage']),
    lastErrorTime: valueFrom(instance, ['lastErrorTime', 'errorTime']),
    lastEventTime: valueFrom(instance, ['lastEventTime', 'eventTime'])
  }))
  const protocols = getProtocols(agent, instances)
  const totalRate = instances.reduce((sum, instance) => sum + toNumber(instance.rxRate), 0)
  const totalMessages = instances.reduce((sum, instance) => sum + toNumber(instance.rxMessages), 0)
  const os = valueFrom(agent, ['os', 'operatingSystem', 'platform'])
  const arch = valueFrom(agent, ['arch', 'architecture'])
  const lastHeartbeat = valueFrom(agent, ['lastHeartbeat', 'heartbeatTime', 'lastSeen'])
  const firstSeen = valueFrom(agent, ['firstSeen', 'registerTime', 'createdAt'])

  const rawAgentId = valueFrom(agent, ['agentId', 'id', 'name']) || '-'
  return {
    raw: agent,
    agentId: rawAgentId,
    agentLabel: String(rawAgentId).replace(/^AGENT-/i, '采集代理-'),
    host: valueFrom(agent, ['host', 'ipAddress', 'ip']) || '-',
    osLabel: [os, arch].filter(Boolean).join(' / ') || '-',
    version: valueFrom(agent, ['version', 'agentVersion']) || '-',
    deployForm: valueFrom(agent, ['deployForm', 'deployMode']) || '-',
    firstSeen,
    firstSeenText: formatDateTime(firstSeen),
    lastHeartbeat,
    lastHeartbeatText: formatDateTime(lastHeartbeat),
    cpuUsage: valueFrom(agent, ['cpuUsage', 'cpu']),
    memUsage: valueFrom(agent, ['memUsage', 'memoryUsage', 'mem']),
    protocols,
    protocolText: protocols.length > 0 ? protocols.join('、') : '-',
    totalRate,
    totalRateText: formatRate(totalRate),
    totalMessages,
    totalMessagesText: formatNumber(totalMessages),
    status: getAgentStatus(agent, instances),
    communicationEvents: getCommunicationEvents(agent, instances),
    instances,
    instanceCount: instances.length
  }
}

const agentRows = computed(() => rawAgents.value.map(normalizeAgent))

const selectedAgent = computed(() => agentRows.value.find(agent => agent.agentId === selectedAgentId.value) || agentRows.value[0] || null)

const agentStats = computed(() => {
  const rows = agentRows.value
  const protocolSet = new Set(rows.flatMap(agent => agent.protocols))
  return {
    total: rows.length,
    online: rows.filter(agent => ['ONLINE', 'RUNNING'].includes(agent.status)).length,
    error: rows.filter(agent => ['ERROR', 'BLOCKED'].includes(agent.status)).length,
    protocols: protocolSet.size
  }
})

const getStatusColor = (status) => {
  const colors = {
    ONLINE: 'green',
    RUNNING: 'green',
    STOPPED: 'default',
    OFFLINE: 'red',
    ERROR: 'red',
    BLOCKED: 'orange',
    UNKNOWN: 'default'
  }
  return colors[status] || 'default'
}

const getStatusTone = (status) => {
  if (['ONLINE', 'RUNNING'].includes(status)) return 'success'
  if (['ERROR', 'BLOCKED'].includes(status)) return 'error'
  if (['STOPPED', 'OFFLINE'].includes(status)) return 'muted'
  return 'neutral'
}

const getStatusText = (status) => {
  const texts = {
    ONLINE: '运行中',
    RUNNING: '运行中',
    STOPPED: '停止',
    OFFLINE: '停止',
    ERROR: '异常',
    BLOCKED: '阻塞',
    UNKNOWN: '未知'
  }
  return texts[status] || status || '未知'
}

const toList = (payload) => {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.agents)) return data.agents
  return []
}

const loadAgents = async () => {
  agentLoading.value = true
  try {
    const res = await agentApi.getAll()
    rawAgents.value = toList(res)
    const rows = rawAgents.value.map(normalizeAgent)
    if (!rows.some(agent => agent.agentId === selectedAgentId.value)) {
      selectedAgentId.value = rows[0]?.agentId || ''
    }
  } catch (error) {
    rawAgents.value = []
    selectedAgentId.value = ''
    message.error('采集代理列表加载失败')
  } finally {
    agentLoading.value = false
  }
}

const selectAgent = (agent) => {
  selectedAgentId.value = agent.agentId
}

const getAgentRowClass = (agent) => selectedAgent.value?.agentId === agent.agentId ? 'agent-row is-active' : 'agent-row'

const getAgentRowProps = (agent) => ({
  role: 'button',
  tabindex: 0,
  title: `查看 ${agent.agentId} 详情`,
  onClick: () => selectAgent(agent),
  onKeydown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectAgent(agent)
    }
  }
})

const deleteAgent = async (agentId) => {
  try {
    await agentApi.delete(agentId)
    message.success('删除成功')
    loadAgents()
  } catch (error) {
    message.error('删除失败')
  }
}

const isAgentBusy = (agent, action) => agentActionKey.value === `${agent.agentId}:${action}`

const runAgentAction = async (agent, action) => {
  const instanceIds = agent.instances.map(instance => instance.interfaceInstanceId).filter(Boolean)
  if (instanceIds.length === 0) {
    message.error('当前 Agent 暂无可操作的采集接口实例')
    return
  }

  agentActionKey.value = `${agent.agentId}:${action}`
  try {
    await Promise.all(instanceIds.map(instanceId => agentApi.instanceAction(agent.agentId, instanceId, action)))
    message.success(action === 'restart' ? '重启指令已下发' : '停止指令已下发')
    loadAgents()
  } catch (error) {
    message.error(action === 'restart' ? '重启失败' : '停止失败')
  } finally {
    agentActionKey.value = ''
  }
}

const stopAgent = (agent) => runAgentAction(agent, 'stop')

const restartAgent = (agent) => runAgentAction(agent, 'restart')

// ── 速率曲线 ─────────────────────────────────────────────────────
const RATE_POINTS = 30
const instanceChartEls = new Map()
const instanceCharts = new Map()
const instanceMetric = reactive({})

const setInstanceChartRef = (id, el) => {
  if (el) instanceChartEls.set(id, el)
  else instanceChartEls.delete(id)
}

const setInstanceMetric = (id, metric) => {
  instanceMetric[id] = metric
  renderInstanceCharts()
}

const buildInstanceSeries = (instance, metric) => {
  const id = Number(instance.interfaceInstanceId) || 0
  let seed = id + (metric === 'rate' ? 7 : 3) + 1
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const now = Date.now()
  const intervalMs = 2000
  const running = ['RUNNING', 'ONLINE', 'ACTIVE'].includes(String(instance.state || '').toUpperCase())
  const baseMsgRate = running ? Math.max(20, Math.round((Number(instance.rxMessages) || 60000) / 600)) : 0
  const baseByteRate = running ? Math.max(1024, Number(instance.rxRate) || 200000) : 0
  const data = []
  for (let i = 0; i < RATE_POINTS; i += 1) {
    const t = now - (RATE_POINTS - 1 - i) * intervalMs
    const wave = 0.78 + 0.22 * Math.sin(i / 3 + seed * 0.05) + (rand() - 0.5) * 0.16
    const base = metric === 'rate' ? baseByteRate : baseMsgRate
    data.push([t, Math.max(0, Math.round(base * wave))])
  }
  return data
}

const formatBytesPerSec = (v) => `${formatBytes(v)}/s`

const compactNumber = (val) => {
  const n = Number(val) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const renderInstanceCharts = async () => {
  await nextTick()
  const agent = selectedAgent.value
  if (!agent) return
  const rootStyle = getComputedStyle(document.documentElement)
  const textColor = rootStyle.getPropertyValue('--ui-text-muted').trim() || '#9ca3af'
  const borderColor = rootStyle.getPropertyValue('--ui-border-muted').trim() || 'rgba(148,163,184,0.25)'
  const primaryColor = rootStyle.getPropertyValue('--ui-primary').trim() || '#38bdf8'
  const pad = (n) => String(n).padStart(2, '0')
  const fmtTime = (val) => { const d = new Date(val); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }

  agent.instances.forEach((instance) => {
    const id = instance.interfaceInstanceId
    const el = instanceChartEls.get(id)
    if (!el) return
    let chart = instanceCharts.get(id)
    if (!chart) { chart = echarts.init(el); instanceCharts.set(id, chart) }
    const metric = instanceMetric[id] || 'message'
    const isRate = metric === 'rate'
    const data = buildInstanceSeries(instance, metric)
    chart.setOption({
      color: [isRate ? '#45AD8D' : primaryColor],
      grid: { left: 8, right: 12, top: 12, bottom: 22, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          if (!params || !params.length) return ''
          const v = params[0].value[1]
          const text = isRate ? formatBytesPerSec(v) : `${formatNumber(v)} 条/s`
          return `${fmtTime(params[0].value[0])}<br/>${params[0].marker}${text}`
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: { color: textColor, fontSize: 10, formatter: fmtTime },
        axisLine: { lineStyle: { color: borderColor } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textColor, fontSize: 10, formatter: (val) => isRate ? formatBytes(val) : compactNumber(val) },
        axisLine: { lineStyle: { color: borderColor } },
        splitLine: { lineStyle: { color: borderColor } }
      },
      series: [{
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        areaStyle: { opacity: 0.12 },
        data
      }]
    }, true)
    chart.resize()
  })
}

const disposeInstanceCharts = () => {
  instanceCharts.forEach((chart) => chart.dispose())
  instanceCharts.clear()
}

const handleAgentResize = () => { instanceCharts.forEach((chart) => chart.resize()) }

watch(selectedAgentId, () => {
  disposeInstanceCharts()
  renderInstanceCharts()
})

onMounted(async () => {
  window.addEventListener('resize', handleAgentResize)
  await loadAgents()
  renderInstanceCharts()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleAgentResize)
  disposeInstanceCharts()
  instanceChartEls.clear()
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 16px;
}

.agent-table-card {
  min-width: 0;
}

.agent-workspace {
  display: grid;
  grid-template-columns: minmax(430px, 0.9fr) minmax(520px, 1.1fr);
  gap: 16px;
  align-items: start;
}

.agent-table-card :deep(.ui-card-body) {
  padding: 10px;
}

.agent-table :deep(.ui-table) {
  min-width: 0;
  table-layout: fixed;
}

.agent-table :deep(.ui-table th),
.agent-table :deep(.ui-table td) {
  padding: 8px 9px;
  vertical-align: middle;
  font-size: 12px;
}

.agent-table :deep(.ui-table tr.agent-row) {
  cursor: pointer;
  outline: none;
}

.agent-table :deep(.ui-table tr.agent-row:hover td),
.agent-table :deep(.ui-table tr.agent-row:focus-visible td) {
  background: color-mix(in srgb, var(--ui-bg-accented) 72%, transparent);
}

.agent-table :deep(.ui-table tr.agent-row.is-active td) {
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg-elevated));
}

.agent-table :deep(.ui-table tr.agent-row.is-active td:first-child) {
  box-shadow: inset 3px 0 0 var(--ui-primary);
}

.muted-text {
  color: var(--ui-text-muted);
}

.table-time {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-id-cell {
  display: block;
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-detail-card :deep(.ui-card-header) {
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
}

.agent-detail-card :deep(.ui-card-body) {
  padding: 10px 12px;
}

.agent-detail-card :deep(.ui-card-title) {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-detail-card :deep(.ui-card-extra) {
  flex: none;
  gap: 4px;
}

.agent-detail-card {
  min-width: 0;
}

.agent-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.agent-card-actions :deep(.ui-button) {
  min-height: 24px;
  padding: 2px 8px;
  font-size: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 0 0 1px currentColor inset;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.status-success {
  background: color-mix(in srgb, var(--ui-success) 12%, transparent);
  color: var(--ui-success);
}

.status-error {
  background: color-mix(in srgb, var(--ui-error) 12%, transparent);
  color: var(--ui-error);
}

.status-muted {
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.status-neutral {
  background: var(--ui-bg-muted);
  color: var(--ui-text);
}

.agent-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.agent-meta-item {
  min-width: 0;
  padding: 6px 8px;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-muted);
}

.agent-meta-item span,
.resource-label,
.instance-metrics {
  color: var(--ui-text-muted);
  font-size: 11px;
}

.agent-meta-item strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.resource-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.instance-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.instance-item {
  padding: 7px 8px;
  border-radius: var(--ui-radius);
  box-shadow: 0 0 0 1px var(--ui-border-muted);
}

.instance-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.instance-main strong {
  margin-right: 6px;
  color: var(--ui-text-highlighted);
}

.instance-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 6px;
  margin-top: 6px;
}

.instance-error {
  margin-top: 6px;
  color: var(--ui-error);
  font-size: 11px;
}

.instance-main-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.instance-chart-block {
  margin-top: 10px;
}

.instance-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.instance-chart-title {
  color: var(--ui-text-muted);
  font-size: 11px;
}

.metric-toggle {
  display: inline-flex;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
}

.metric-toggle button {
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  background: transparent;
  color: var(--ui-text-muted);
  border: 0;
  border-right: 1px solid var(--ui-border);
  cursor: pointer;
}

.metric-toggle button:last-child {
  border-right: 0;
}

.metric-toggle button:hover {
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
}

.metric-toggle button.active {
  background: var(--ui-primary);
  color: #fff;
}

.instance-chart {
  width: 100%;
  height: 140px;
}

.event-section {
  margin-top: 10px;
}

.section-title {
  margin-bottom: 8px;
  color: var(--ui-text-highlighted);
  font-size: 13px;
  font-weight: 600;
}

.event-list {
  display: grid;
  gap: 6px;
}

.event-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  padding: 7px 8px;
  border-radius: var(--ui-radius);
  background: color-mix(in srgb, var(--ui-error) 8%, var(--ui-bg-muted));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-error) 22%, transparent);
}

.event-dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--ui-error);
}

.event-content {
  min-width: 0;
}

.event-main {
  display: flex;
  gap: 6px;
  color: var(--ui-text);
  font-size: 12px;
}

.event-main strong {
  flex: none;
  color: var(--ui-text-highlighted);
}

.event-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 11px;
}

.empty-state {
  padding: 12px;
  color: var(--ui-text-muted);
  text-align: center;
}

.empty-state.compact {
  padding: 10px;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-muted);
}

@media (max-width: 1180px) {
  .agent-workspace {
    grid-template-columns: 1fr;
  }

  .agent-card-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 760px) {
  .agent-meta-grid,
  .resource-grid {
    grid-template-columns: 1fr;
  }

  .agent-table :deep(.ui-table) {
    min-width: 560px;
  }
}
</style>
