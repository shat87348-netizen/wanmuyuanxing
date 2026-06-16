<template>
  <div class="dashboard">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard
          class="stat-card metric-card metric-card-clickable"
          role="button"
          tabindex="0"
          @click="goTo('/config/agents')"
          @keyup.enter="goTo('/config/agents')"
        >
          <UiStatistic title="在线Agent" :value="formatNumber(stats.onlineAgents)" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><ApiOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card metric-card">
          <UiStatistic title="数据速率" :value="formatNumber(stats.dataRate)" suffix="Mbps" :value-style="{ color: '#45AD8D' }">
            <template #prefix><LineChartOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card metric-card">
          <UiStatistic title="处理延迟" :value="formatNumber(stats.latency)" suffix="ms" :value-style="{ color: '#ECBE84' }">
            <template #prefix><ClockCircleOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard
          class="stat-card metric-card metric-card-clickable"
          role="button"
          tabindex="0"
          @click="goTo('/alarm?status=unhandled')"
          @keyup.enter="goTo('/alarm?status=unhandled')"
        >
          <UiStatistic title="未处理告警" :value="formatNumber(stats.unhandledAlarms)" :value-style="{ color: '#EF443C' }">
            <template #prefix><WarningOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiRow :gutter="16">
      <UiCol :xs="24" :lg="12">
        <UiCard title="数据采集统计" class="data-card">
          <template #extra>
            <div class="card-extra">
              <div class="view-switch" aria-label="数据采集统计时间范围">
                <button
                  v-for="opt in timeRangeOptions"
                  :key="opt.value"
                  type="button"
                  :class="['view-switch-button', { active: collectionTimeRange === opt.value }]"
                  @click="collectionTimeRange = opt.value"
                >{{ opt.label }}</button>
              </div>
              <div class="view-switch" aria-label="数据采集统计展示形式">
                <button
                  v-for="item in collectionViewOptions"
                  :key="item.value"
                  type="button"
                  :class="['view-switch-button', { active: collectionView === item.value }]"
                  @click="collectionView = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </template>

          <div class="summary-strip">
            <div>
              <span>发送方</span>
              <strong>{{ collectionTableRows.length }}</strong>
            </div>
            <div>
              <span>采集量</span>
              <strong>{{ formatNumber(collectionStats.totalPacketCount) }} 条</strong>
            </div>
            <div>
              <span>接口流量</span>
              <strong>{{ formatFlowRate(collectionStats.totalFlowRate) }}</strong>
            </div>
          </div>

          <UiTable
            v-if="collectionView === 'table'"
            :columns="collectionColumns"
            :data-source="collectionTableRows"
            :pagination="false"
            row-key="key"
            size="small"
            :locale="{ emptyText: '暂无采集统计数据' }"
          />
          <div v-show="collectionView !== 'table'" ref="collectionChartRef" class="chart-panel"></div>
        </UiCard>
      </UiCol>

      <UiCol :xs="24" :lg="12">
        <UiCard title="数据处理统计" class="data-card">
          <template #extra>
            <div class="card-extra">
              <div class="view-switch" aria-label="数据处理统计时间范围">
                <button
                  v-for="opt in timeRangeOptions"
                  :key="opt.value"
                  type="button"
                  :class="['view-switch-button', { active: processTimeRange === opt.value }]"
                  @click="processTimeRange = opt.value"
                >{{ opt.label }}</button>
              </div>
              <div class="view-switch" aria-label="数据处理统计展示形式">
                <button
                  v-for="item in processViewOptions"
                  :key="item.value"
                  type="button"
                  :class="['view-switch-button', { active: processView === item.value }]"
                  @click="processView = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </template>

          <div class="summary-strip">
            <div>
              <span>{{ processReceivedLabel }}</span>
              <strong>{{ formatNumber(processStats.todayReceived) }} 条</strong>
            </div>
            <div>
              <span>{{ processProcessedLabel }}</span>
              <strong>{{ formatNumber(processStats.todayProcessed) }} 条</strong>
            </div>
            <div>
              <span>异常数据</span>
              <strong>{{ formatNumber(processStats.errorData) }} 条</strong>
            </div>
          </div>

          <UiTable
            v-if="processView === 'table'"
            :columns="processColumns"
            :data-source="processTableRows"
            :pagination="false"
            row-key="key"
            size="small"
            :locale="{ emptyText: '暂无处理统计数据' }"
          />
          <div v-show="processView === 'line'" ref="processChartRef" class="chart-panel"></div>
        </UiCard>
      </UiCol>
    </UiRow>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { dashboardApi } from '../api'

const router = useRouter()

const CHART_COLORS = ['#45AD8D', '#8ABBDB', '#ECBE84', '#EF443C', '#A78BFA', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6']

const refreshInterval = ref(null)
const collectionChartRef = ref(null)
const processChartRef = ref(null)
const collectionView = ref('line')
const processView = ref('line')
const collectionTimeRange = ref('3h')
const processTimeRange = ref('3h')
let collectionChart = null
let processChart = null
let themeObserver = null

const collectionViewOptions = [
  { label: '折线图', value: 'line' },
  { label: '饼图', value: 'pie' },
  { label: '表格', value: 'table' }
]

const processViewOptions = [
  { label: '折线图', value: 'line' },
  { label: '表格', value: 'table' }
]

const timeRangeOptions = [
  { label: '近3小时', value: '3h' },
  { label: '近24小时', value: '24h' },
  { label: '近一周', value: '1w' },
]

const timeRangeLabelMap = {
  '3h': '近3小时',
  '24h': '近24小时',
  '1w': '近一周',
}

const stats = ref({
  onlineAgents: 0,
  dataRate: 0,
  latency: 0,
  unhandledAlarms: 0
})

const collectionStats = ref({
  rows: [],
  pie: [],
  timeline: [],
  interfaceTimelines: {},
  totalFlowRate: 0,
  totalPacketCount: 0
})

const processStats = ref({
  todayReceived: 0,
  todayProcessed: 0,
  dedupedCount: 0,
  errorData: 0,
  rows: [],
  timeline: [],
  interfaceTimelines: {}
})

const collectionColumns = [
  { title: '发送方', dataIndex: 'sender', key: 'sender' },
  { title: '接口数', dataIndex: 'interfaceCountText', key: 'interfaceCountText' },
  { title: '协议', dataIndex: 'protocolsText', key: 'protocolsText' },
  { title: '采集量', dataIndex: 'packetCountText', key: 'packetCountText' },
  { title: '流量', dataIndex: 'flowRateText', key: 'flowRateText' },
  { title: '状态', dataIndex: 'status', key: 'status' }
]

const processColumns = [
  { title: '数据类型', dataIndex: 'type', key: 'type' },
  { title: '处理数量', dataIndex: 'processedText', key: 'processedText' },
  { title: '去重数量', dataIndex: 'dedupedText', key: 'dedupedText' },
  { title: '异常数量', dataIndex: 'errorText', key: 'errorText' }
]

const collectionTableRows = computed(() =>
  (collectionStats.value.rows || []).map((row, index) => ({
    key: row.key || row.sender || row.name || index,
    sender: row.sender || row.name || '未知发送方',
    interfaceCountText: formatNumber(row.interfaceCount || 0),
    protocolsText: Array.isArray(row.protocols) ? row.protocols.join(' / ') : row.protocols || '-',
    packetCountText: `${formatNumber(row.packetCount || 0)} 条`,
    flowRateText: formatFlowRate(row.flowRate || row.value || 0),
    status: row.status || '-'
  }))
)

const processReceivedLabel = computed(() => `${timeRangeLabelMap[processTimeRange.value] || '今日'}接收`)
const processProcessedLabel = computed(() => `${timeRangeLabelMap[processTimeRange.value] || '今日'}处理`)

const processTableRows = computed(() => {
  const rows = processStats.value.rows || []
  return rows.map((row, index) => ({
    key: row.key || row.type || row.name || index,
    type: row.type || row.name || '-',
    processedText: `${formatNumber(row.processedCount || row.processed || 0)} 条`,
    dedupedText: `${formatNumber(row.dedupedCount || row.deduped || 0)} 条`,
    errorText: `${formatNumber(row.errorCount || row.error || 0)} 条`
  }))
})

const goTo = (path) => {
  router.push(path)
}

const getCssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const getChartTheme = () => ({
  text: getCssVar('--ui-text', '#1f2937'),
  muted: getCssVar('--ui-text-muted', '#4b5563'),
  border: getCssVar('--ui-border', 'rgba(100,116,139,0.35)'),
  borderMuted: getCssVar('--ui-border-muted', 'rgba(100,116,139,0.22)'),
  panel: getCssVar('--block-bg', '#ffffff')
})

const formatNumber = (num) => {
  const value = Number(num || 0)
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const formatFlowRate = (bytes) => {
  const value = Number(bytes || 0)
  if (value < 1024) return `${formatNumber(value)} B/s`
  if (value < 1024 * 1024) return `${formatNumber(value / 1024)} KB/s`
  if (value < 1024 * 1024 * 1024) return `${formatNumber(value / 1024 / 1024)} MB/s`
  return `${formatNumber(value / 1024 / 1024 / 1024)} GB/s`
}

const formatAxisTime = (value, showDate = false) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (showDate) {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const baseTooltip = (trigger = 'axis') => {
  const theme = getChartTheme()
  return {
    trigger,
    backgroundColor: theme.panel,
    borderColor: theme.border,
    textStyle: { color: theme.text }
  }
}

const axisStyle = () => {
  const theme = getChartTheme()
  return {
    axisLabel: { color: theme.muted },
    axisLine: { lineStyle: { color: theme.border } },
    axisTick: { lineStyle: { color: theme.borderMuted } },
    splitLine: { lineStyle: { color: theme.borderMuted } }
  }
}

const ensureCollectionChart = () => {
  if (collectionView.value === 'table') return false
  if (!collectionChart && collectionChartRef.value) collectionChart = echarts.init(collectionChartRef.value)
  return Boolean(collectionChart)
}

const ensureProcessChart = () => {
  if (processView.value !== 'line') return false
  if (!processChart && processChartRef.value) processChart = echarts.init(processChartRef.value)
  return Boolean(processChart)
}

const renderCollectionChart = async () => {
  if (collectionView.value === 'table') return
  await nextTick()
  if (!ensureCollectionChart()) return

  const theme = getChartTheme()
  if (collectionView.value === 'pie') {
    const pieData = (collectionStats.value.pie || []).map((item) => ({
      name: item.sender || item.name || '未知发送方',
      value: Number(item.value || item.flowRate || item.packetCount || item.interfaceCount || 0),
      raw: item
    }))

    collectionChart.setOption({
      tooltip: {
        ...baseTooltip('item'),
        formatter: (params) => {
          const raw = params.data?.raw || {}
          return `${params.name}<br/>流量: ${formatFlowRate(params.value)}<br/>采集量: ${formatNumber(raw.packetCount || 0)} 条`
        }
      },
      legend: { show: false },
      series: [{
        type: 'pie',
        radius: ['32%', '56%'],
        center: ['50%', '52%'],
        itemStyle: { borderRadius: 4, borderColor: theme.panel, borderWidth: 2 },
        label: {
          show: true,
          color: theme.text,
          fontSize: 11,
          formatter: '{b}',
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 14,
        },
        emphasis: { label: { show: true, color: theme.text, fontSize: 12, fontWeight: 'bold' } },
        data: pieData
      }]
    }, true)
  } else {
    const axis = axisStyle()
    const showDate = collectionTimeRange.value === '1w'
    const ifaceTimelines = collectionStats.value.interfaceTimelines || {}
    const entries = Object.entries(ifaceTimelines)
    let series
    if (entries.length > 0) {
      series = entries.map(([name, tl], idx) => ({
        name,
        type: 'line',
        smooth: false,
        symbolSize: 4,
        lineStyle: { width: 2 },
        itemStyle: { color: CHART_COLORS[idx % CHART_COLORS.length] },
        data: (Array.isArray(tl) ? tl : []).map(item => [item.time, Number(item.packetCount || 0)])
      }))
    } else {
      const timeline = collectionStats.value.timeline || []
      series = [{
        name: '采集量',
        type: 'line',
        smooth: false,
        symbolSize: 4,
        itemStyle: { color: '#45AD8D' },
        lineStyle: { width: 2 },
        data: timeline.map(item => [item.time, Number(item.packetCount || 0)])
      }]
    }
    collectionChart.setOption({
      tooltip: {
        ...baseTooltip('axis'),
        valueFormatter: (value) => `${formatNumber(value)} 条`
      },
      legend: {
        type: 'scroll',
        top: 0,
        textStyle: { color: theme.text, fontSize: 11, fontWeight: 500 }
      },
      grid: { left: '3%', right: '4%', top: '36px', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'time',
        axisLabel: { ...axis.axisLabel, formatter: (v) => formatAxisTime(v, showDate) },
        axisLine: axis.axisLine,
        axisTick: axis.axisTick
      },
      yAxis: {
        type: 'value',
        axisLabel: axis.axisLabel,
        axisLine: axis.axisLine,
        splitLine: axis.splitLine
      },
      dataZoom: [{ type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true }],
      series
    }, true)
  }
  collectionChart.resize()
}

const renderProcessChart = async () => {
  if (processView.value !== 'line') return
  await nextTick()
  if (!ensureProcessChart()) return

  const theme = getChartTheme()
  const axis = axisStyle()
  const showDate = processTimeRange.value === '1w'
  const ifaceTimelines = processStats.value.interfaceTimelines || {}
  const entries = Object.entries(ifaceTimelines)

  let series
  if (entries.length > 0) {
    series = entries.map(([name, tl], idx) => ({
      name,
      type: 'line',
      smooth: false,
      symbolSize: 4,
      lineStyle: { width: 2 },
      itemStyle: { color: CHART_COLORS[idx % CHART_COLORS.length] },
      data: (Array.isArray(tl) ? tl : []).map(item => [item.time, Number(item.packetCount || 0)])
    }))
  } else {
    const timeline = processStats.value.timeline || []
    series = [
      {
        name: '接收',
        type: 'line',
        smooth: false,
        symbolSize: 4,
        itemStyle: { color: '#8ABBDB' },
        lineStyle: { width: 2 },
        data: timeline.map(item => [item.time, Number(item.todayReceived || 0)])
      },
      {
        name: '处理',
        type: 'line',
        smooth: false,
        symbolSize: 4,
        itemStyle: { color: '#45AD8D' },
        lineStyle: { width: 2 },
        data: timeline.map(item => [item.time, Number(item.todayProcessed || 0)])
      },
      {
        name: '异常',
        type: 'line',
        smooth: false,
        symbolSize: 4,
        itemStyle: { color: '#EF443C' },
        lineStyle: { width: 2 },
        data: timeline.map(item => [item.time, Number(item.errorData || 0)])
      }
    ]
  }

  processChart.setOption({
    tooltip: {
      ...baseTooltip('axis'),
      valueFormatter: (value) => `${formatNumber(value)} 条`
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: theme.text, fontSize: 11, fontWeight: 500 }
    },
    grid: { left: '3%', right: '4%', top: '36px', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'time',
      axisLabel: { ...axis.axisLabel, formatter: (v) => formatAxisTime(v, showDate) },
      axisLine: axis.axisLine,
      axisTick: axis.axisTick
    },
    yAxis: {
      type: 'value',
      axisLabel: axis.axisLabel,
      axisLine: axis.axisLine,
      splitLine: axis.splitLine
    },
    dataZoom: [{ type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true }],
    series
  }, true)
  processChart.resize()
}

const refreshChartsForTheme = () => {
  renderCollectionChart()
  renderProcessChart()
}

const loadStats = async () => {
  try {
    const res = await dashboardApi.getStats()
    const data = res.data || {}
    stats.value = {
      onlineAgents: data.onlineAgents || data.runningAgents || data.onlineSatellites || 0,
      dataRate: data.dataRate || 0,
      latency: data.latency || 0,
      unhandledAlarms: data.unhandledAlarms || 0
    }
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) return
    console.error(e)
  }
}

const loadCollectionStats = async () => {
  try {
    const res = await dashboardApi.getCollectionStats(collectionTimeRange.value)
    collectionStats.value = {
      rows: res.data?.rows || [],
      pie: res.data?.pie || [],
      timeline: res.data?.timeline || [],
      interfaceTimelines: res.data?.interfaceTimelines || {},
      totalFlowRate: res.data?.totalFlowRate || 0,
      totalPacketCount: res.data?.totalPacketCount || 0
    }
    renderCollectionChart()
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) return
    console.error(e)
  }
}

const loadProcessStats = async () => {
  try {
    const res = await dashboardApi.getProcessStats(processTimeRange.value)
    const data = res.data || {}
    processStats.value = {
      todayReceived: data.todayReceived || 0,
      todayProcessed: data.todayProcessed || 0,
      dedupedCount: data.dedupedCount || 0,
      errorData: data.errorData || 0,
      rows: data.rows || [],
      timeline: data.timeline || [],
      interfaceTimelines: data.interfaceTimelines || {}
    }
    renderProcessChart()
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) return
    console.error(e)
  }
}

const loadAll = () => {
  loadStats()
  loadCollectionStats()
  loadProcessStats()
}

watch(collectionView, renderCollectionChart)
watch(processView, renderProcessChart)
watch(collectionTimeRange, () => loadCollectionStats())
watch(processTimeRange, () => loadProcessStats())

onMounted(() => {
  loadAll()
  refreshInterval.value = setInterval(loadAll, 15000)
  window.addEventListener('resize', refreshChartsForTheme)

  themeObserver = new MutationObserver(refreshChartsForTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-app-theme'] })
  if (document.body) {
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-app-theme'] })
  }
})

onUnmounted(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value)
  window.removeEventListener('resize', refreshChartsForTheme)
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  if (collectionChart) {
    collectionChart.dispose()
    collectionChart = null
  }
  if (processChart) {
    processChart.dispose()
    processChart = null
  }
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }

.stat-card,
.data-card {
  background: var(--block-bg) !important;
  border: 0 !important;
  border-radius: var(--ui-radius) !important;
  box-shadow: 0 0 0 1px var(--block-ring), var(--block-shadow) !important;
}

.metric-card {
  min-height: 104px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.metric-card-clickable {
  cursor: pointer;
}

.metric-card-clickable:hover,
.metric-card-clickable:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px var(--ui-border-accented), var(--block-shadow) !important;
  outline: none;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  gap: 2px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-muted);
}

.view-switch-button {
  min-width: 54px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: calc(var(--ui-radius) - 2px);
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.view-switch-button.active {
  background: var(--block-bg);
  color: var(--ui-text-highlighted);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ui-text) 12%, transparent);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.summary-strip > div {
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--ui-radius);
  background: var(--block-bg-subtle);
  box-shadow: inset 0 0 0 1px var(--ui-border-muted);
}

.summary-strip span {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.summary-strip strong {
  display: block;
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chart-panel {
  width: 100%;
  height: 310px;
}

@media (max-width: 768px) {
  .summary-strip {
    grid-template-columns: 1fr;
  }

  .view-switch {
    width: 100%;
  }

  .view-switch-button {
    flex: 1;
  }
}
</style>
