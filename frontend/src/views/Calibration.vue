<template>
  <div class="calibration">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="8">
        <UiCard class="stat-card">
          <UiStatistic title="今日校准数据" :value="stats.calibrated" :value-style="{ color: '#45AD8D' }">
            <template #prefix><CheckCircleOutlined /></template>
            <template #suffix>条</template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="8">
        <UiCard class="stat-card">
          <UiStatistic title="检测野值" :value="stats.outliers" :value-style="{ color: '#EF443C' }">
            <template #prefix><WarningOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="8">
        <UiCard class="stat-card">
          <UiStatistic title="清洗数据" :value="stats.cleaned" :value-style="{ color: '#ECBE84' }">
            <template #prefix><DeleteOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiRow :gutter="16">
      <UiCol :xs="24" :lg="12">
        <UiCard title="校准通道配置" class="data-card">
          <template #extra>
            <UiButton type="primary" size="small" @click="showAddChannelModal">添加通道</UiButton>
          </template>
          <UiTable :columns="channelColumns" :data-source="channels" :loading="loading" row-key="id" size="small">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'formula'">
                <span class="cal-formula">{{ getFormula(record.channelType) }}</span>
              </template>
              <template v-if="column.key === 'algorithm'">
                <UiTag>{{ getMethodName(record.outlierMethod) }}</UiTag>
              </template>
              <template v-if="column.key === 'status'">
                <UiTag :color="record.status === '正常' ? 'success' : 'error'">{{ record.status }}</UiTag>
              </template>
              <template v-if="column.key === 'action'">
                <UiSpace>
                  <UiButton type="link" size="small" @click="editChannel(record)">配置</UiButton>
                  <UiButton type="link" size="small" danger @click="deleteChannel(record.id)">删除</UiButton>
                </UiSpace>
              </template>
            </template>
          </UiTable>
        </UiCard>
      </UiCol>

      <UiCol :xs="24" :lg="12">
        <UiCard :title="logView === 'chart' ? `校准曲线 · ${detailRecord?.channelName || ''}` : '校准记录'" class="data-card">
          <template #extra>
            <div v-if="logView === 'chart'" class="cal-chart-toolbar">
              <div class="cal-range-group">
                <button
                  v-for="opt in calRangeOptions"
                  :key="opt.value"
                  type="button"
                  :class="['cal-range-btn', { active: detailTimeRange === opt.value }]"
                  @click="detailTimeRange = opt.value"
                >{{ opt.label }}</button>
              </div>
              <UiButton size="small" @click="backToLogTable">返回</UiButton>
            </div>
          </template>

          <UiTable
            v-if="logView === 'table'"
            :columns="logColumns"
            :data-source="calibrationLogs"
            :loading="logsLoading"
            row-key="(record) => record.date + record.channelName"
            size="small"
            :pagination="{ pageSize: 8 }"
            :locale="{ emptyText: '暂无数据' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <UiButton type="link" size="small" @click="viewLogDetail(record)">详情</UiButton>
              </template>
            </template>
          </UiTable>

          <div v-else class="cal-chart-wrap">
            <div ref="calChartRef" class="cal-chart"></div>
            <div class="cal-chart-legend">
              <span class="cal-legend-item"><i class="dot dot-line"></i>参数值<template v-if="detailRecord?.unit">（{{ detailRecord.unit }}）</template></span>
              <span class="cal-legend-item"><i class="dot dot-outlier"></i>野值</span>
              <span class="cal-legend-item"><i class="dot dot-range"></i>正常范围</span>
            </div>
          </div>
        </UiCard>
      </UiCol>
    </UiRow>

    <!-- 添加/编辑通道弹窗 -->
    <UiModal :visible="channelModalVisible" :title="isEditingChannel ? '编辑通道' : '添加通道'" @ok="saveChannel" @cancel="closeChannelModal" ok-text="确定" cancel-text="取消" width="700px">
      <UiForm :model="channelForm" layout="vertical">
        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="通道名称" required>
              <UiInput v-model:value="channelForm.channelName" placeholder="请输入通道名称" />
            </UiFormItem>
          </UiCol>
          <UiCol :span="12">
            <UiFormItem label="数据类型" required>
              <UiSelect v-model:value="channelForm.channelType" placeholder="请选择类型">
                <UiSelectOption value="温度传感器">温度传感器</UiSelectOption>
                <UiSelectOption value="电压传感器">电压传感器</UiSelectOption>
                <UiSelectOption value="电流传感器">电流传感器</UiSelectOption>
                <UiSelectOption value="姿态传感器">姿态传感器</UiSelectOption>
              </UiSelect>
            </UiFormItem>
          </UiCol>
        </UiRow>
        <UiFormItem label="正常范围" required>
          <UiInput v-model:value="channelForm.range" placeholder="如: 0~36V" />
        </UiFormItem>

        <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">野值检测算法配置</UiDivider>

        <UiFormItem label="野值检测方法">
          <UiSelect v-model:value="channelForm.outlierMethod" style="width: 100%">
            <UiSelectOption value="threshold">阈值法</UiSelectOption>
            <UiSelectOption value="3sigma">莱特准则(3σ准则)</UiSelectOption>
            <UiSelectOption value="chauvener">肖维涅法</UiSelectOption>
          </UiSelect>
        </UiFormItem>

        <!-- 阈值法配置 -->
        <template v-if="channelForm.outlierMethod === 'threshold'">
          <UiFormItem label="阈值百分比 (%)">
            <UiInputNumber v-model:value="channelForm.thresholdPercent" :min="0" :max="100" style="width: 100%" />
          </UiFormItem>
        </template>

        <!-- 莱特准则配置 -->
        <template v-if="channelForm.outlierMethod === '3sigma'">
          <UiFormItem label="σ倍数">
            <UiSlider v-model:value="channelForm.sigmaMultiplier" :marks="{ 1: '1σ', 2: '2σ', 3: '3σ', 4: '4σ', 5: '5σ' }" :min="1" :max="5" :step="0.5" />
          </UiFormItem>
          <UiRow :gutter="16">
            <UiCol :span="12">
              <UiFormItem label="样本窗口">
                <UiInputNumber v-model:value="channelForm.sampleWindow" :min="10" :max="1000" style="width: 100%" />
              </UiFormItem>
            </UiCol>
            <UiCol :span="12">
              <UiFormItem label="动态更新">
                <UiSwitch v-model:checked="channelForm.dynamicUpdate" /> 随新数据更新
              </UiFormItem>
            </UiCol>
          </UiRow>
        </template>

        <!-- 肖维涅法配置 -->
        <template v-if="channelForm.outlierMethod === 'chauvener'">
          <UiRow :gutter="16">
            <UiCol :span="12">
              <UiFormItem label="肖维涅系数">
                <UiInputNumber v-model:value="channelForm.chauvenerCoeff" :min="0.1" :max="1" :step="0.1" style="width: 100%" />
              </UiFormItem>
            </UiCol>
            <UiCol :span="12">
              <UiFormItem label="最小样本数">
                <UiInputNumber v-model:value="channelForm.minSampleSize" :min="5" :max="100" style="width: 100%" />
              </UiFormItem>
            </UiCol>
          </UiRow>
          <UiFormItem label="迭代次数">
            <UiRadioGroup v-model:value="channelForm.iterations">
              <UiRadio :value="1">1次</UiRadio>
              <UiRadio :value="2">2次</UiRadio>
              <UiRadio :value="3">3次</UiRadio>
            </UiRadioGroup>
          </UiFormItem>
        </template>

        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="自动清洗">
              <UiSwitch v-model:checked="channelForm.autoClean" /> 自动剔除异常数据
            </UiFormItem>
          </UiCol>
          <UiCol :span="12">
            <UiFormItem label="启用">
              <UiSwitch v-model:checked="channelForm.enabled" /> 启用该通道
            </UiFormItem>
          </UiCol>
        </UiRow>
      </UiForm>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { message } from '../utils/feedback'
import { calibrationChannelApi, calibrationLogApi, calibratedTelemetryApi } from '../api'

const loading = ref(false)
const logsLoading = ref(false)
const channelModalVisible = ref(false)
const isEditingChannel = ref(false)
let refreshInterval = null

const channelForm = reactive({
  id: null,
  channelName: '',
  channelType: '',
  range: '',
  // 算法配置
  outlierMethod: 'threshold',
  thresholdPercent: 10,
  sigmaMultiplier: 3,
  sampleWindow: 100,
  dynamicUpdate: true,
  chauvenerCoeff: 0.5,
  minSampleSize: 10,
  iterations: 1,
  autoClean: true,
  enabled: true
})


const stats = ref({
  calibrated: 0,
  outliers: 0,
  cleaned: 0,
  channels: 0
})

const channels = ref([])
const calibrationLogs = ref([])

const channelColumns = [
  { title: '通道名称', dataIndex: 'channelName' },
  { title: '公式', key: 'formula', width: 100 },
  { title: '类型', dataIndex: 'channelType' },
  { title: '范围', dataIndex: 'range' },
  { title: '算法', key: 'algorithm', width: 100 },
  { title: '状态', key: 'status' },
  { title: '操作', key: 'action', width: 150 }
]

// 校准通道类型 → 公式类型编号（取值风格参考数据处理·参数解析配置的“公式类型”列）
const typeFormulaMap = {
  温度传感器: '109',
  电压传感器: '109',
  电流传感器: '100',
  功率传感器: '114',
  姿态传感器: '106'
}
const getFormula = (channelType) => typeFormulaMap[channelType] || '-'

const getMethodName = (method) => {
  const map = { 'threshold': '阈值法', '3sigma': '莱特准则', 'chauvener': '肖维涅法' }
  return map[method] || method
}

const logColumns = [
  { title: '日期', dataIndex: 'date', width: 110 },
  { title: '数据', dataIndex: 'channelName' },
  { title: '检出野值', dataIndex: 'outlierCount', width: 88 },
  { title: '清洗数量', dataIndex: 'cleanedCount', width: 88 },
  { title: '操作', key: 'action', width: 64 }
]

// ── 校准曲线详情 ──────────────────────────────────────────────
const logView = ref('table')
const detailRecord = ref(null)
const detailTimeRange = ref('6h')
const calChartRef = ref(null)
let calChart = null

const calRangeOptions = [
  { label: '近1小时', value: '1h' },
  { label: '近6小时', value: '6h' },
  { label: '近1天', value: '1d' },
  { label: '近7天', value: '7d' }
]

const calRangeConfig = {
  '1h': { count: 60, intervalMs: 60 * 1000 },
  '6h': { count: 72, intervalMs: 5 * 60 * 1000 },
  '1d': { count: 96, intervalMs: 15 * 60 * 1000 },
  '7d': { count: 84, intervalMs: 2 * 60 * 60 * 1000 }
}

const getChannelMeta = (record) => {
  const found = channels.value.find(c => c.channelName === record?.channelName)
  const base = found || {}
  return {
    baseValue: base.baseValue ?? 50,
    amplitude: base.amplitude ?? 20,
    lower: base.lower ?? 0,
    upper: base.upper ?? 100,
    unit: base.unit || record?.unit || ''
  }
}

const buildCalSeries = (record, range) => {
  const meta = getChannelMeta(record)
  const { count, intervalMs } = calRangeConfig[range] || calRangeConfig['6h']
  const now = Date.now()
  const startMs = now - (count - 1) * intervalMs
  const seedStr = `${record?.channelName || ''}-${record?.date || ''}-${range}`
  let seed = seedStr.split('').reduce((s, c) => s + c.charCodeAt(0), 0) || 1
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const span = Math.max(1, meta.upper - meta.lower)
  const points = []
  const outliers = []
  for (let i = 0; i < count; i++) {
    const t = startMs + i * intervalMs
    let v = meta.baseValue + meta.amplitude * Math.sin(i / 6 + seed * 0.01) + (rand() - 0.5) * meta.amplitude * 0.4
    if (rand() < 0.045) {
      v = rand() > 0.5 ? meta.upper + span * (0.12 + rand() * 0.35) : meta.lower - span * (0.12 + rand() * 0.35)
      outliers.push([t, +v.toFixed(2)])
    }
    points.push([t, +v.toFixed(2)])
  }
  return { meta, points, outliers }
}

const renderCalChart = async () => {
  if (logView.value !== 'chart' || !detailRecord.value) return
  await nextTick()
  const el = calChartRef.value
  if (!el) return
  if (!calChart) calChart = echarts.init(el)

  const rootStyle = getComputedStyle(document.documentElement)
  const textColor = rootStyle.getPropertyValue('--ui-text-muted').trim() || '#9ca3af'
  const borderColor = rootStyle.getPropertyValue('--ui-border-muted').trim() || 'rgba(148,163,184,0.25)'
  const primaryColor = rootStyle.getPropertyValue('--ui-primary').trim() || '#38bdf8'

  const { meta, points, outliers } = buildCalSeries(detailRecord.value, detailTimeRange.value)
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (value) => {
    const dd = new Date(value)
    return `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())} ${pad(dd.getHours())}:${pad(dd.getMinutes())}:${pad(dd.getSeconds())}`
  }

  calChart.setOption({
    color: [primaryColor],
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        if (!params || !params.length) return ''
        const time = fmt(params[0].value[0])
        const lines = params.map(p => `${p.marker}${p.seriesName}: ${p.value[1]} ${meta.unit}`).join('<br/>')
        return `${time}<br/>${lines}`
      }
    },
    grid: { left: 52, right: 20, top: 16, bottom: 52 },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: textColor,
        formatter: (value) => {
          const dd = new Date(value)
          return `${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}\n${pad(dd.getHours())}:${pad(dd.getMinutes())}:${pad(dd.getSeconds())}`
        }
      },
      axisLine: { lineStyle: { color: borderColor } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: meta.unit,
      nameTextStyle: { color: textColor },
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: borderColor } },
      splitLine: { lineStyle: { color: borderColor } }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: false, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: false, filterMode: 'none' }
    ],
    series: [
      {
        name: '参数值',
        type: 'line',
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        data: points,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#ECBE84' },
          label: { color: textColor, fontSize: 11, formatter: '{b}' },
          data: [
            { yAxis: meta.upper, name: '上限' },
            { yAxis: meta.lower, name: '下限' }
          ]
        }
      },
      {
        name: '野值',
        type: 'scatter',
        symbolSize: 9,
        itemStyle: { color: '#EF443C' },
        data: outliers
      }
    ]
  }, true)
  calChart.resize()
}

const viewLogDetail = (record) => {
  detailRecord.value = record
  logView.value = 'chart'
  renderCalChart()
}

const backToLogTable = () => {
  logView.value = 'table'
}

const handleCalResize = () => { if (calChart) calChart.resize() }

watch(detailTimeRange, () => renderCalChart())
watch(logView, (v) => { if (v === 'chart') renderCalChart() })

const formatTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

const loadChannels = async () => {
  loading.value = true
  try {
    const res = await calibrationChannelApi.getAll()
    channels.value = res.data || []
    stats.value.channels = channels.value.length
  } catch (e) { 
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e) 
  }
  finally { loading.value = false }
}

const loadStats = async () => {
  try {
    const [channelStats, calibratedStats, logStats] = await Promise.all([
      calibrationChannelApi.getStats(),
      calibratedTelemetryApi.getStats(),
      calibrationLogApi.getStats()
    ])
    stats.value.channels = channelStats.data?.total || 0
    stats.value.calibrated = calibratedStats.data?.todayCalibrated || 0
    stats.value.outliers = calibratedStats.data?.todayOutliers || 0
    stats.value.cleaned = calibratedStats.data?.todayCleaned || 0
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e) 
  }
}

const loadLogs = async () => {
  logsLoading.value = true
  try {
    // 按天统计的校准记录
    const res = await calibrationLogApi.getDailyStats()
    calibrationLogs.value = res.data || []
  } catch (e) { 
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) {
      logsLoading.value = false
      return
    }
    console.error(e)
    // 模拟数据
    const today = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    calibrationLogs.value = [
      { date: days[6], channelName: '温度传感器', outlierCount: 1250, cleanedCount: 980, accuracy: 98.2 },
      { date: days[6], channelName: '电压传感器', outlierCount: 890, cleanedCount: 850, accuracy: 99.1 },
      { date: days[6], channelName: '电流传感器', outlierCount: 560, cleanedCount: 520, accuracy: 97.8 },
      { date: days[5], channelName: '温度传感器', outlierCount: 1380, cleanedCount: 1050, accuracy: 97.5 },
      { date: days[5], channelName: '电压传感器', outlierCount: 920, cleanedCount: 880, accuracy: 98.9 },
      { date: days[5], channelName: '电流传感器', outlierCount: 480, cleanedCount: 450, accuracy: 98.1 },
      { date: days[4], channelName: '温度传感器', outlierCount: 1100, cleanedCount: 920, accuracy: 98.8 },
      { date: days[4], channelName: '电压传感器', outlierCount: 780, cleanedCount: 760, accuracy: 99.3 },
      { date: days[4], channelName: '电流传感器', outlierCount: 620, cleanedCount: 580, accuracy: 97.2 },
      { date: days[3], channelName: '温度传感器', outlierCount: 1450, cleanedCount: 1200, accuracy: 97.1 },
      { date: days[3], channelName: '电压传感器', outlierCount: 850, cleanedCount: 820, accuracy: 99.0 },
      { date: days[3], channelName: '电流传感器', outlierCount: 520, cleanedCount: 490, accuracy: 98.5 },
      { date: days[2], channelName: '温度传感器', outlierCount: 980, cleanedCount: 850, accuracy: 99.2 },
      { date: days[2], channelName: '电压传感器', outlierCount: 720, cleanedCount: 700, accuracy: 99.4 },
      { date: days[2], channelName: '电流传感器', outlierCount: 580, cleanedCount: 540, accuracy: 97.9 },
      { date: days[1], channelName: '温度传感器', outlierCount: 1200, cleanedCount: 1000, accuracy: 98.0 },
      { date: days[1], channelName: '电压传感器', outlierCount: 880, cleanedCount: 850, accuracy: 99.1 },
      { date: days[1], channelName: '电流传感器', outlierCount: 640, cleanedCount: 600, accuracy: 97.5 },
      { date: days[0], channelName: '温度传感器', outlierCount: 350, cleanedCount: 280, accuracy: 97.5 },
      { date: days[0], channelName: '电压传感器', outlierCount: 210, cleanedCount: 200, accuracy: 99.2 },
      { date: days[0], channelName: '电流传感器', outlierCount: 180, cleanedCount: 165, accuracy: 98.0 },
    ]
  }
  finally { logsLoading.value = false }
}

const loadData = async () => {
  await Promise.all([loadChannels(), loadStats(), loadLogs()])
}

const showAddChannelModal = () => {
  isEditingChannel.value = false
  channelForm.id = null
  channelForm.channelName = ''
  channelForm.channelType = ''
  channelForm.range = ''
  channelModalVisible.value = true
}

const editChannel = (record) => {
  isEditingChannel.value = true
  channelForm.id = record.id
  channelForm.channelName = record.channelName
  channelForm.channelType = record.channelType
  channelForm.range = record.range
  // 算法配置
  channelForm.outlierMethod = record.outlierMethod || 'threshold'
  channelForm.thresholdPercent = record.thresholdPercent ?? 10
  channelForm.sigmaMultiplier = record.sigmaMultiplier ?? 3
  channelForm.sampleWindow = record.sampleWindow ?? 100
  channelForm.dynamicUpdate = record.dynamicUpdate !== false
  channelForm.chauvenerCoeff = record.chauvenerCoeff ?? 0.5
  channelForm.minSampleSize = record.minSampleSize ?? 10
  channelForm.iterations = record.iterations ?? 1
  channelForm.autoClean = record.autoClean !== false
  channelForm.enabled = record.enabled !== false
  channelModalVisible.value = true
}

const closeChannelModal = () => {
  channelModalVisible.value = false
}

const saveChannel = async () => {
  if (!channelForm.channelName || !channelForm.channelType || !channelForm.range) {
    message.error('请填写完整信息')
    return
  }

  try {
    if (isEditingChannel.value) {
      await calibrationChannelApi.update({ ...channelForm })
      message.success('通道更新成功')
    } else {
      await calibrationChannelApi.add({ ...channelForm })
      message.success('通道添加成功')
    }
    closeChannelModal()
    loadChannels()
  } catch (e) { message.error('操作失败') }
}

const deleteChannel = async (id) => {
  try {
    await calibrationChannelApi.delete(id)
    message.success('删除成功')
    loadChannels()
  } catch (e) { message.error('删除失败') }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleCalResize)
  refreshInterval = setInterval(() => {
    loadStats()
    loadLogs()
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  window.removeEventListener('resize', handleCalResize)
  if (calChart) { calChart.dispose(); calChart = null }
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }
.stat-card, .data-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 4px !important;
}

.cal-formula {
  color: var(--ui-text-highlighted);
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 13px;
}

.cal-chart-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cal-range-group {
  display: inline-flex;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
}

.cal-range-btn {
  padding: 3px 10px;
  font-size: 12px;
  line-height: 18px;
  background: transparent;
  color: var(--ui-text-muted);
  border: 0;
  border-right: 1px solid var(--ui-border);
  cursor: pointer;
}

.cal-range-btn:last-child { border-right: 0; }

.cal-range-btn:hover {
  background: var(--ui-bg-muted);
  color: var(--ui-text);
}

.cal-range-btn.active {
  background: var(--ui-primary);
  color: #fff;
}

.cal-chart-wrap {
  display: flex;
  flex-direction: column;
}

.cal-chart {
  width: 100%;
  height: 320px;
}

.cal-chart-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 6px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.cal-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cal-legend-item .dot {
  display: inline-block;
  width: 12px;
  height: 4px;
  border-radius: 2px;
}

.dot-line { background: var(--ui-primary); }

.dot-outlier {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #EF443C;
}

.dot-range {
  height: 0;
  border-top: 2px dashed #ECBE84;
}
</style>
