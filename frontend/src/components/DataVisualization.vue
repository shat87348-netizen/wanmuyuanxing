<template>
  <div class="enhanced-viz">
    <!-- 顶部工具栏：试验任务 + 操作按钮 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <label class="toolbar-label">任务来源</label>
        <div class="source-toggle">
          <button :class="['source-btn', taskSource === 'local' ? 'source-btn-active' : '']" @click="taskSource = 'local'">本系统</button>
          <button :class="['source-btn', taskSource === 'external' ? 'source-btn-active' : '']" @click="taskSource = 'external'">外部通知</button>
        </div>
        <label class="toolbar-label">试验任务</label>
        <template v-if="taskSource === 'local'">
          <UiSelect
            v-model:value="selectedExperimentTask"
            class="task-filter-select"
            placeholder="请选择试验任务"
            show-search
            :filter-option="filterTaskOption"
          >
            <UiSelectOption value="">全部试验任务</UiSelectOption>
            <UiSelectOption v-for="task in experimentTaskOptions" :key="task.value" :value="task.value">
              {{ task.label }}
            </UiSelectOption>
          </UiSelect>
        </template>
        <template v-else>
          <div class="external-task-box">
            <span class="ext-dot" :class="externalTask ? 'ext-dot-on' : 'ext-dot-wait'"></span>
            <span class="ext-task-name">{{ externalTask ? externalTask.label : '等待外部通知...' }}</span>
            <span v-if="externalTask" class="ext-task-meta">来自 {{ externalTask.source }} · {{ externalTask.receivedAt }}</span>
          </div>
        </template>
      </div>
      <div class="toolbar-right">
        <button type="button" class="toolbar-btn" @click="exportConfig">导出配置</button>
        <button type="button" class="toolbar-btn" @click="triggerImport">导入配置</button>
        <button type="button" class="toolbar-btn toolbar-btn-primary" @click="addChartWidget">+ 新增曲线</button>
        <button type="button" class="toolbar-btn toolbar-btn-primary" @click="addTableWidget">+ 新增表格</button>
      </div>
    </div>

    <!-- 网格容器 -->
    <div
      ref="gridRef"
      class="grid-container"
      :class="{ 'is-interacting': interacting }"
      :style="{ height: containerHeight + 'px' }"
    >
      <div v-if="interacting" class="grid-bg" :style="gridBgStyle"></div>

      <div
        v-for="widget in widgets"
        :key="widget.id"
        class="widget"
        :class="{ 'widget-active': dragState?.widget?.id === widget.id }"
        :style="widgetStyle(widget)"
      >
        <div class="widget-header" @mousedown="onDragStart(widget, $event)">
          <span class="widget-title">{{ widget.title }}</span>
          <div class="widget-actions">
            <ParamTreeSelect
              v-if="widget.type === 'chart' || widget.type === 'table'"
              v-model="widget.params"
              class="widget-param-select"
              :telemetry-data="vizTelemetryCache"
              :placeholder="widget.type === 'chart' ? '选择设备协议数据' : '选择设备协议数据'"
              :max-tag-count="2"
              @mousedown.stop
              @update:modelValue="onWidgetParamsChange(widget, $event)"
            />
            <button
              type="button"
              class="widget-close"
              aria-label="移除"
              @mousedown.stop
              @click="removeWidget(widget.id)"
            >×</button>
          </div>
        </div>

        <div class="widget-body">
          <TelemetryLineChart v-if="widget.type === 'chart'" :series="chartSeriesFor(widget)" class="widget-chart" />

          <div v-else-if="widget.type === 'table'" class="widget-scroll">
            <UiTable
              :columns="columns"
              :data-source="widget.rows || []"
              size="small"
              :pagination="false"
              row-key="key"
              :locale="{ emptyText: '暂无数据' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'device'">
                  {{ record.serverName || record.satelliteId }}
                </template>
                <template v-if="column.key === 'protocol'">
                  <UiTag :color="getProtocolColor(record.protocol)">{{ record.protocol }}</UiTag>
                </template>
                <template v-if="column.key === 'type'">
                  <UiTag :color="getTypeColor(record.paramType)">{{ record.paramType }}</UiTag>
                </template>
                <template v-if="column.key === 'status'">
                  <UiTag :color="record.status === '正常' ? 'success' : 'error'">{{ record.status }}</UiTag>
                </template>
              </template>
            </UiTable>
          </div>

          <div v-else-if="widget.type === 'alarm'" class="widget-scroll">
            <UiTable
              :columns="alarmColumns"
              :data-source="alarmTableData"
              size="small"
              :pagination="false"
              row-key="key"
              :locale="{ emptyText: '暂无告警' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'time'">
                  <span class="alarm-time">{{ formatAlarmTime(record.alarmTime) }}</span>
                </template>
                <template v-if="column.key === 'currentValue'">
                  <span :class="['alarm-current-value', alarmDirectionClass(record.thresholdType)]">
                    <span class="alarm-direction">{{ alarmDirectionIcon(record.thresholdType) }}</span>
                    {{ formatAlarmValue(record.currentValue, record.unit) }}
                  </span>
                </template>
                <template v-if="column.key === 'threshold'">
                  <span>{{ formatAlarmValue(record.thresholdValue, record.unit) }}</span>
                </template>
              </template>
            </UiTable>
          </div>

          <div v-else-if="widget.type === 'image'" class="widget-image-panel">
            <div class="image-preview-pane">
              <template v-if="selectedImageId[widget.id] != null">
                <div class="image-nodata-preview">
                  <svg class="nodata-svg" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
                    <rect width="120" height="80" fill="none"/>
                    <line x1="0" y1="0" x2="120" y2="80" stroke="currentColor" stroke-width="1" opacity="0.3"/>
                    <line x1="120" y1="0" x2="0" y2="80" stroke="currentColor" stroke-width="1" opacity="0.3"/>
                    <text x="60" y="44" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.6">nodata</text>
                  </svg>
                  <span class="nodata-label">{{ imageList.find(i => i.id === selectedImageId[widget.id])?.label }}</span>
                  <span class="nodata-time">{{ imageList.find(i => i.id === selectedImageId[widget.id])?.time }}</span>
                </div>
              </template>
              <template v-else>
                <div class="image-preview-empty">
                  <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M3 16l4-4 3 3 4-5 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>点击右侧列表选择图像</span>
                </div>
              </template>
            </div>
            <div class="image-table-pane">
              <UiTable
                :columns="imageColumns"
                :data-source="imageList"
                size="small"
                row-key="id"
                :scroll="{ x: 560 }"
                :pagination="{ pageSize: 8, size: 'small', showTotal: total => `共 ${total} 张` }"
                :custom-row="(record) => ({ onClick: () => selectImage(widget.id, record.id), class: selectedImageId[widget.id] === record.id ? 'image-row-active' : 'image-row' })"
                :locale="{ emptyText: '暂无图像' }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'status'">
                    <span :class="['image-status-badge', `image-status-${record.status}`]">{{ imageStatusText(record.status) }}</span>
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <div class="image-action-btns" @click.stop>
                      <button class="img-act-btn" title="预览" @click="selectImage(widget.id, record.id)">预览</button>
                      <button class="img-act-btn img-act-dl" title="下载" @click="downloadImage(record)">下载</button>
                    </div>
                  </template>
                </template>
              </UiTable>
            </div>
          </div>
        </div>

        <div class="widget-resize" @mousedown.stop="onResizeStart(widget, $event)"></div>
      </div>
    </div>

    <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="onImportFile" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { telemetryApi, processTaskApi, alarmApi } from '../api'
import { getRuntimeConfig, isMockEnabled } from '../config/runtime'
import ParamTreeSelect from './ParamTreeSelect.vue'
import TelemetryLineChart from './TelemetryLineChart.vue'

const COLS = 24
const ROW_H = 30
const GAP = 8
const LAYOUT_STORAGE_KEY = 'viz.layout.v1'

const selectedExperimentTask = ref('')
const tasks = ref([])

const taskSource = ref('local')
const externalTask = ref(null)

const externalTaskCandidates = [
  { value: 'ext-001', label: '星地联合测试任务-2026A', source: '任务规划模块' },
  { value: 'ext-002', label: '载荷定标试验-夜间段', source: '调度系统' },
  { value: 'ext-003', label: '轨道机动验证任务', source: '飞行控制模块' },
  { value: 'ext-004', label: '多星协同观测任务', source: '指挥控制模块' },
]

let externalNotifyTimer = null

const startExternalNotify = () => {
  externalTask.value = null
  externalNotifyTimer = setTimeout(() => {
    const candidate = externalTaskCandidates[Math.floor(Math.random() * externalTaskCandidates.length)]
    const pad = n => String(n).padStart(2, '0')
    const now = new Date()
    externalTask.value = {
      ...candidate,
      receivedAt: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    }
  }, 1800)
}

watch(taskSource, (v) => {
  if (v === 'external') {
    startExternalNotify()
  } else {
    clearTimeout(externalNotifyTimer)
    externalTask.value = null
  }
})

const filterTaskOption = (input, option) => {
  const label = String(option?.children?.[0] ?? option?.label ?? '').toLowerCase()
  return label.includes(input.toLowerCase())
}
const alarms = ref([])
const vizTelemetryCache = ref([])

const IMG_SATELLITES = ['SAT-001', 'SAT-002', 'SAT-003']
const IMG_RESOLUTIONS = ['1024×768', '2048×1536', '4096×3072', '512×512']
const IMG_BANDS = ['可见光', '红外', '多光谱', '高光谱']
const IMG_STATUSES = ['nodata', 'nodata', 'nodata', 'pending', 'done', 'done']

const imageList = (() => {
  const now = Date.now()
  const pad = n => String(n).padStart(2, '0')
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now - i * 37000)
    const status = IMG_STATUSES[i % IMG_STATUSES.length]
    const kb = 800 + Math.round(Math.sin(i * 1.3) * 600 + Math.random() * 400)
    return {
      id: `img-${i}`,
      label: `IMG-${pad(i + 1)}`,
      satellite: IMG_SATELLITES[i % IMG_SATELLITES.length],
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      resolution: IMG_RESOLUTIONS[i % IMG_RESOLUTIONS.length],
      band: IMG_BANDS[i % IMG_BANDS.length],
      size: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`,
      status,
    }
  })
})()

const imageColumns = [
  { title: '编号', dataIndex: 'label', key: 'label', width: 82 },
  { title: '卫星', dataIndex: 'satellite', key: 'satellite', width: 74 },
  { title: '波段', dataIndex: 'band', key: 'band', width: 64 },
  { title: '分辨率', dataIndex: 'resolution', key: 'resolution', width: 88 },
  { title: '大小', dataIndex: 'size', key: 'size', width: 72 },
  { title: '状态', key: 'status', width: 70 },
  { title: '操作', key: 'action', width: 88 },
]

const imageStatusText = (status) => ({ nodata: 'nodata', pending: '待下传', done: '已下传' }[status] || status)

const downloadImage = (record) => {
  message.success(`${record.label} 下载指令已下发`)
}

const selectedImageId = reactive({})

const selectImage = (widgetId, imgId) => {
  selectedImageId[widgetId] = imgId
}

const maxDataPoints = 50

let simTimer = null
let alarmTimer = null
let alarmSocket = null

const gridRef = ref(null)
const fileInputRef = ref(null)
const colWidth = ref(0)
const dragState = ref(null)
const interacting = computed(() => dragState.value !== null)
let resizeObserver = null

const widgets = ref(loadLayout() || defaultWidgets())

function defaultWidgets() {
  return [
    {
      id: 'chart-default',
      type: 'chart',
      title: '实时曲线',
      x: 0, y: 0, w: 12, h: 11,
      params: [],
      dataMap: {},
    },
    {
      id: 'table-default',
      type: 'table',
      title: '实时数据',
      x: 12, y: 0, w: 12, h: 11,
      params: [],
      rows: [],
    },
    {
      id: 'alarm-default',
      type: 'alarm',
      title: '实时告警',
      x: 0, y: 11, w: 12, h: 9,
    },
    {
      id: 'image-default',
      type: 'image',
      title: '载荷图像',
      x: 12, y: 11, w: 12, h: 9,
    },
  ]
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.map(w => ({
      ...w,
      params: w.params || [],
      dataMap: w.type === 'chart' ? {} : undefined,
      rows: w.type === 'table' ? [] : undefined,
    }))
  } catch {
    return null
  }
}

function saveLayout() {
  try {
    const serialized = widgets.value.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      x: w.x, y: w.y, w: w.w, h: w.h,
      params: w.params || [],
    }))
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(serialized))
  } catch (e) {
    console.warn('[viz] saveLayout error', e)
  }
}

const containerHeight = computed(() => {
  const maxY = widgets.value.reduce((m, w) => Math.max(m, w.y + w.h), 0)
  return Math.max(560, maxY * (ROW_H + GAP) + 40)
})

const gridBgStyle = computed(() => {
  const cw = colWidth.value
  if (cw <= 0) return {}
  return {
    backgroundSize: `${cw + GAP}px ${ROW_H + GAP}px`,
    backgroundPosition: `0 0`,
  }
})

const widgetStyle = (w) => {
  const cw = colWidth.value
  return {
    left: `${w.x * (cw + GAP)}px`,
    top: `${w.y * (ROW_H + GAP)}px`,
    width: `${w.w * cw + (w.w - 1) * GAP}px`,
    height: `${w.h * ROW_H + (w.h - 1) * GAP}px`,
  }
}

const recomputeColWidth = () => {
  const el = gridRef.value
  if (!el) return
  const totalGap = (COLS - 1) * GAP
  colWidth.value = Math.max(20, (el.clientWidth - totalGap) / COLS)
}

const onDragStart = (widget, event) => {
  if (event.button !== 0) return
  event.preventDefault()
  dragState.value = {
    widget,
    mode: 'move',
    startX: event.clientX,
    startY: event.clientY,
    origX: widget.x,
    origY: widget.y,
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const onResizeStart = (widget, event) => {
  if (event.button !== 0) return
  event.preventDefault()
  dragState.value = {
    widget,
    mode: 'resize',
    startX: event.clientX,
    startY: event.clientY,
    origW: widget.w,
    origH: widget.h,
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (event) => {
  const s = dragState.value
  if (!s) return
  const cw = colWidth.value
  if (cw <= 0) return
  const colStep = cw + GAP
  const rowStep = ROW_H + GAP
  const dx = event.clientX - s.startX
  const dy = event.clientY - s.startY
  const colDelta = Math.round(dx / colStep)
  const rowDelta = Math.round(dy / rowStep)

  if (s.mode === 'move') {
    s.widget.x = Math.max(0, Math.min(COLS - s.widget.w, s.origX + colDelta))
    s.widget.y = Math.max(0, s.origY + rowDelta)
  } else {
    s.widget.w = Math.max(3, Math.min(COLS - s.widget.x, s.origW + colDelta))
    s.widget.h = Math.max(4, s.origH + rowDelta)
  }
}

const onDragEnd = () => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  dragState.value = null
  saveLayout()
}

const addChartWidget = () => {
  const id = `chart-${Date.now()}`
  const w = 12
  const h = 11
  const y = nextRowAvailable(w, h)
  const widget = {
    id,
    type: 'chart',
    title: '实时曲线',
    x: 0, y, w, h,
    params: vizTelemetryCache.value.length > 0 ? pickDefaultParams() : [],
    dataMap: {},
  }
  widgets.value.push(widget)
  generateInitialData(widget)
  syncSimulationTimer()
  saveLayout()
}

const addTableWidget = () => {
  const id = `table-${Date.now()}`
  const w = 12
  const h = 11
  const y = nextRowAvailable(w, h)
  widgets.value.push({
    id,
    type: 'table',
    title: '实时数据',
    x: 0, y, w, h,
    params: [],
    rows: [],
  })
  saveLayout()
}

function nextRowAvailable() {
  return widgets.value.reduce((m, w) => Math.max(m, w.y + w.h), 0)
}

const removeWidget = (id) => {
  const idx = widgets.value.findIndex(w => w.id === id)
  if (idx < 0) return
  widgets.value.splice(idx, 1)
  saveLayout()
  syncSimulationTimer()
}

const onWidgetParamsChange = (widget, params) => {
  widget.params = params
  if (widget.type === 'chart') {
    widget.dataMap = {}
    params.forEach(p => { widget.dataMap[p] = [] })
    generateInitialData(widget)
  } else if (widget.type === 'table') {
    widget.rows = makeTableRows(params, Date.now())
  }
  syncSimulationTimer()
  saveLayout()
}

const exportConfig = () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    widgets: widgets.value.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      x: w.x, y: w.y, w: w.w, h: w.h,
      params: w.params || [],
    })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `viz-config-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const triggerImport = () => fileInputRef.value?.click()

const onImportFile = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      const incoming = Array.isArray(data?.widgets) ? data.widgets : (Array.isArray(data) ? data : null)
      if (!incoming) throw new Error('配置文件格式不正确')
      widgets.value = incoming.map(w => ({
        ...w,
        params: w.params || [],
        dataMap: w.type === 'chart' ? {} : undefined,
        rows: w.type === 'table' ? [] : undefined,
      }))
      saveLayout()
      nextTick(() => {
        widgets.value.forEach(widget => {
          if (widget.type === 'chart') {
            generateInitialData(widget)
          } else if (widget.type === 'table') {
            widget.rows = makeTableRows(widget.params, Date.now())
          }
        })
        syncSimulationTimer()
      })
    } catch (err) {
      console.error('导入失败', err)
      window.alert('导入失败：' + err.message)
    } finally {
      event.target.value = ''
    }
  }
  reader.readAsText(file)
}

const fallbackExperimentTasks = [
  { value: 'telemetry-joint-test', label: '综合遥测试验任务' },
  { value: 'link-stability-test', label: '链路稳定性试验任务' },
  { value: 'payload-parameter-test', label: '载荷参数试验任务' },
]

const taskOptionLabel = (task) => task?.taskName || task?.name || task?.title || `试验任务 ${task?.id || ''}`.trim()
const taskOptionValue = (task) => String(task?.id ?? task?.taskId ?? task?.taskName ?? task?.name ?? '')

const experimentTaskOptions = computed(() => {
  const source = Array.isArray(tasks.value) ? tasks.value : []
  const options = source.map(t => ({ value: taskOptionValue(t), label: taskOptionLabel(t) })).filter(o => o.value && o.label)
  return options.length ? options : fallbackExperimentTasks
})

const alarmTableData = computed(() => alarms.value.map((item, index) => ({ ...item, key: item.id || index })))

const columns = [
  { title: '设备/星', key: 'device', dataIndex: 'serverName', width: 150 },
  { title: '协议', key: 'protocol', width: 90 },
  { title: '类型', key: 'type', width: 70 },
  { title: '数据项', dataIndex: 'paramName', width: 100 },
  { title: '值', dataIndex: 'paramValue', width: 90 },
  { title: '状态', key: 'status', width: 55 },
]

const alarmColumns = [
  { title: '时间', key: 'time', width: 115 },
  { title: '代号', dataIndex: 'paramCode', width: 70 },
  { title: '参数名称', dataIndex: 'paramName', width: 100 },
  { title: '当前值', key: 'currentValue', width: 100 },
  { title: '阈值', key: 'threshold', width: 90 },
]

const getProtocolColor = (protocol) => ({ Protobuf: 'purple', PDXP: 'cyan', JSON: 'green' }[protocol] || 'default')
const getTypeColor = (t) => ({ 遥测: 'cyan', 遥感: 'green', 设备: 'gold', 环境: 'red', 任务: 'blue', 态势: 'orange', 状态: 'lime' }[t] || 'default')

const getTimestamp = (item) => {
  const value = item.timestamp || item.collectTime || item.time || item.createdAt
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime()
}

const parseValue = (value) => {
  if (typeof value === 'number') return value
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

const lanServers = [
  { id: 'srv-a', name: '采集设备-A', ip: '192.168.10.21' },
  { id: 'srv-b', name: '采集设备-B', ip: '192.168.10.22' },
  { id: 'srv-c', name: '处理设备-C', ip: '192.168.10.31' },
  { id: 'srv-d', name: '转发设备-D', ip: '192.168.10.41' },
]

const runtimeProtocols = ['Protobuf', 'PDXP', 'JSON']

const serverLabel = (server) => `${server.name} (${server.ip})`

const detectProtocol = (item, index = 0) => {
  const raw = String(item?.protocol || item?.protocolType || item?.channel || item?.sourceInterface || '').toUpperCase()
  if (raw.includes('PROTO')) return 'Protobuf'
  if (raw.includes('PDXP')) return 'PDXP'
  if (raw.includes('JSON')) return 'JSON'
  return runtimeProtocols[index % runtimeProtocols.length]
}

const normalizeRuntimeData = (item = {}, index = 0) => {
  const isSatelliteSource = !!item.satelliteId && !item.serverId && !item.serverName
  if (isSatelliteSource) {
    const protocol = detectProtocol(item, index)
    const sourceCode = item.sourceCode || item.telemetryCode || item.paramCode || item.code || `S${String(index + 1).padStart(3, '0')}`
    const paramName = item.paramName || item.name || item.telemetryName || '卫星遥测'
    const value = item.paramValue ?? item.value ?? item.telemetryValue ?? (Math.random() * 90 + 10).toFixed(2)
    return {
      ...item,
      id: item.id || `${item.satelliteId}-${protocol}-${sourceCode}-${index}`,
      protocol,
      channel: protocol,
      satelliteId: item.satelliteId,
      sourceCode,
      telemetryCode: item.telemetryCode || `${item.satelliteId}-${protocol}-${sourceCode}`,
      displayCode: sourceCode,
      optionLabel: item.optionLabel || `${sourceCode} / ${paramName}`,
      paramName,
      paramType: item.paramType || '遥测',
      paramValue: value,
      status: item.status || '正常',
      timestamp: item.timestamp || item.collectTime || new Date().toISOString(),
    }
  }
  const server = lanServers.find(s =>
    s.id === item.serverId ||
    s.ip === item.serverIp ||
    serverLabel(s) === item.serverName ||
    item.serverName?.includes(s.ip)
  ) || lanServers[index % lanServers.length]
  const serverId = item.serverId || server.id
  const protocol = detectProtocol(item, index)
  const sourceCode = item.sourceCode || item.telemetryCode || item.paramCode || item.code || `D${String(index + 1).padStart(3, '0')}`
  const paramName = item.paramName || item.name || item.telemetryName || protocolRuntimeItems[protocol]?.[index % protocolRuntimeItems[protocol].length]?.name || '实时数据'
  const value = item.paramValue ?? item.value ?? item.telemetryValue ?? (Math.random() * 90 + 10).toFixed(2)
  return {
    ...item,
    id: item.id || `${serverId}-${protocol}-${sourceCode}-${index}`,
    serverId,
    serverIp: item.serverIp || server.ip,
    serverName: item.serverName || serverLabel(server),
    protocol,
    channel: protocol,
    satelliteId: item.satelliteId || item.serverName || serverLabel(server),
    sourceCode,
    telemetryCode: item.telemetryCode?.includes(`${serverId}-`) ? item.telemetryCode : `${serverId}-${protocol}-${sourceCode}`,
    displayCode: sourceCode,
    optionLabel: `${sourceCode} / ${paramName}`,
    paramName,
    paramType: item.paramType || protocolRuntimeItems[protocol]?.[index % protocolRuntimeItems[protocol].length]?.type || '状态',
    paramValue: value,
    status: item.status || '正常',
    timestamp: item.timestamp || item.collectTime || new Date().toISOString(),
  }
}

const latestTelemetryRows = (rows, limit = 24) =>
  [...rows]
    .sort((a, b) => getTimestamp(b) - getTimestamp(a))
    .slice(0, limit)
    .map(normalizeRuntimeData)

let fallbackTelemetryCache = null
const getFallbackTelemetryCache = () => {
  if (!fallbackTelemetryCache) fallbackTelemetryCache = generateFallbackTelemetryCache()
  return fallbackTelemetryCache
}

const defaultParamNames = ['实验调度信息', '卫星遥测帧', '实验实施方案', '目标位置数据']
const pickDefaultParams = () => {
  const rows = vizTelemetryCache.value.length ? vizTelemetryCache.value : getFallbackTelemetryCache()
  const uniqueByCode = new Map()
  rows.forEach(item => {
    const key = item.telemetryCode || item.paramCode || item.paramName
    if (key && !uniqueByCode.has(key)) uniqueByCode.set(key, item)
  })
  const preferred = defaultParamNames
    .map(name => Array.from(uniqueByCode.values()).find(item => item.paramName === name))
    .filter(Boolean)
  const fallback = Array.from(uniqueByCode.values()).slice(0, 4)
  return (preferred.length ? preferred : fallback).slice(0, 4).map(item => item.telemetryCode || item.paramCode || item.paramName)
}

const paramDisplayName = (key) => {
  const info = findParamInfo(key)
  return info ? `${info.protocol} ${info.paramName}` : key
}

const findParamInfo = (key) =>
  vizTelemetryCache.value.find(d => d.telemetryCode === key || d.paramName === key || d.sourceCode === key) ||
  getFallbackTelemetryCache().find(d => d.telemetryCode === key || d.paramName === key || d.sourceCode === key)

const matchesParamKey = (item, key) => item.telemetryCode === key || item.paramName === key || item.sourceCode === key

const protocolRuntimeItems = {
  Protobuf: [
    { code: 'PB001', name: '实验调度信息', type: '任务' },
    { code: 'PB002', name: '任务过程数据', type: '状态' },
    { code: 'PB003', name: '资源状态信息', type: '状态' },
    { code: 'PB004', name: '告警事件流', type: '状态' },
  ],
  PDXP: [
    { code: 'PX001', name: '卫星遥测帧', type: '遥测' },
    { code: 'PX002', name: '目标位置数据', type: '态势' },
    { code: 'PX003', name: '场景状态字', type: '态势' },
    { code: 'PX004', name: '下行链路速率', type: '遥测' },
  ],
  JSON: [
    { code: 'JS001', name: '实验实施方案', type: '任务' },
    { code: 'JS002', name: '评估结果数据', type: '状态' },
    { code: 'JS003', name: '接口健康状态', type: '状态' },
    { code: 'JS004', name: '配置参数变更', type: '状态' },
  ],
}

const generateFallbackTelemetryCache = () => {
  const list = []
  lanServers.forEach(server => {
    runtimeProtocols.forEach(protocol => {
      protocolRuntimeItems[protocol].forEach((item, itemIndex) => {
        list.push(normalizeRuntimeData({
          serverId: server.id,
          serverIp: server.ip,
          serverName: serverLabel(server),
          protocol,
          sourceCode: item.code,
          telemetryCode: `${server.id}-${protocol}-${item.code}`,
          displayCode: item.code,
          optionLabel: `${item.code} / ${item.name}`,
          paramName: item.name,
          paramType: item.type,
          paramValue: (Math.random() * 80 + 10).toFixed(2),
          status: '正常',
          timestamp: new Date(Date.now() - itemIndex * 1000).toISOString(),
        }, list.length))
      })
    })
  })
  return list
}

const simValue = (info, t) => {
  const seed = (info.telemetryCode || info.paramName || 'X').charCodeAt(0)
  const baseMap = { '实验调度信息': 42, '任务过程数据': 65, '资源状态信息': 58, '告警事件流': 12, '卫星遥测帧': 78, '目标位置数据': 120, '场景状态字': 32, '下行链路速率': 150, '实验实施方案': 24, '评估结果数据': 88, '接口健康状态': 96, '配置参数变更': 18 }
  const ampMap = { '实验调度信息': 8, '任务过程数据': 16, '资源状态信息': 12, '告警事件流': 6, '卫星遥测帧': 24, '目标位置数据': 36, '场景状态字': 10, '下行链路速率': 45, '实验实施方案': 7, '评估结果数据': 14, '接口健康状态': 3, '配置参数变更': 5 }
  const b = baseMap[info.paramName] || 50
  const a = ampMap[info.paramName] || 10
  return +(b + Math.sin(t / 10000 + seed) * a + (Math.random() - 0.5) * a * 0.3).toFixed(2)
}

const generateInitialData = (widget) => {
  if (widget.type !== 'chart') return
  const now = Date.now()
  widget.params.forEach((param) => {
    const rows = vizTelemetryCache.value
      .filter(item => matchesParamKey(item, param))
      .sort((a, b) => getTimestamp(a) - getTimestamp(b))
      .slice(-maxDataPoints)
    const info = rows[rows.length - 1] || findParamInfo(param)
    const points = rows.map(row => [getTimestamp(row), parseValue(row.paramValue)])
    if (points.length === 0 && info) {
      for (let i = maxDataPoints - 1; i >= 0; i--) {
        const t = now - i * 1000
        points.push([t, simValue(info, t)])
      }
    }
    widget.dataMap[param] = points
  })
}

const chartSeriesFor = (widget) => widget.params.map(param => ({
  name: paramDisplayName(param),
  data: widget.dataMap?.[param] || []
}))

const makeTableRows = (params, now) => {
  const source = vizTelemetryCache.value.length ? vizTelemetryCache.value : getFallbackTelemetryCache()
  if (!params || params.length === 0) {
    return latestTelemetryRows(source, 24).map((row, i) => ({ ...row, key: row.id || `${row.telemetryCode}-${i}` }))
  }
  const rows = params.map((param, paramIndex) => {
    const info = findParamInfo(param)
    if (!info) return null
    const v = simValue(info, now)
    return normalizeRuntimeData({
      ...info,
      id: `${param}-${now}`,
      paramType: info.paramType || '状态',
      paramName: info.paramName || param,
      telemetryCode: info.telemetryCode || param,
      paramValue: v.toFixed(2),
      status: Math.random() > 0.92 ? '异常' : '正常',
    }, paramIndex)
  }).filter(Boolean)
  return rows.map((r, i) => ({ ...r, key: r.id || `${r.telemetryCode}-${i}` }))
}

const hasActiveDataWidgets = () =>
  widgets.value.some(w => (w.type === 'chart' || w.type === 'table') && w.params && w.params.length > 0)

const syncSimulationTimer = () => {
  if (hasActiveDataWidgets()) {
    if (!simTimer) simTimer = setInterval(simulateTick, 1000)
  } else if (simTimer) {
    clearInterval(simTimer)
    simTimer = null
  }
}

const simulateTick = () => {
  const now = Date.now()
  widgets.value.forEach(widget => {
    if (widget.type === 'chart') {
      widget.params.forEach((param) => {
        const info = findParamInfo(param)
        if (!info) return
        const v = simValue(info, now)
        if (!widget.dataMap[param]) widget.dataMap[param] = []
        widget.dataMap[param].push([now, v])
        if (widget.dataMap[param].length > maxDataPoints) widget.dataMap[param].shift()
      })
    } else if (widget.type === 'table') {
      widget.rows = makeTableRows(widget.params, now)
    }
  })
}

const loadTelemetryCache = async () => {
  // 设备（地面站/服务器）遥测是本地模拟数据源，与接口返回的卫星遥测数据平级展示
  const deviceRows = getFallbackTelemetryCache()
  try {
    const res = await telemetryApi.getRecent(500)
    const data = res.data || []
    const satelliteRows = data.map((item, index) => normalizeRuntimeData(item, index))
    vizTelemetryCache.value = [...deviceRows, ...satelliteRows]
  } catch (e) {
    console.error('loadTelemetryCache error:', e)
    vizTelemetryCache.value = deviceRows
  }
  const validParamSet = new Set(vizTelemetryCache.value.map(item => item.telemetryCode))
  const defaultParams = pickDefaultParams()
  // Initialize default params for widgets that have none, and migrate stale saved params.
  widgets.value.forEach(widget => {
    if (widget.type === 'chart' || widget.type === 'table') {
      widget.params = (widget.params || []).filter(param => validParamSet.has(param))
      if (widget.params.length === 0) widget.params = [...defaultParams]
      if (widget.type === 'chart') {
        widget.dataMap = {}
        generateInitialData(widget)
      } else if (widget.type === 'table') {
        widget.rows = makeTableRows(widget.params, Date.now())
      }
    }
  })
  saveLayout()
  syncSimulationTimer()
}

const loadExperimentTasks = async () => {
  try {
    const res = await processTaskApi.getAll()
    tasks.value = res.data || []
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e)
  }
}

const loadFallbackAlarms = () => {
  const now = Date.now()
  alarms.value = [
    { id: 'fb-1', paramCode: 'T001', paramName: '温度', currentValue: 72.5, thresholdValue: 70, thresholdType: 'UPPER', unit: '°C', alarmTime: new Date(now - 2000).toISOString() },
    { id: 'fb-2', paramCode: 'V001', paramName: '母线电压', currentValue: 21.3, thresholdValue: 22, thresholdType: 'LOWER', unit: 'V', alarmTime: new Date(now - 6000).toISOString() },
    { id: 'fb-3', paramCode: 'M001', paramName: '存储容量', currentValue: 92.1, thresholdValue: 90, thresholdType: 'UPPER', unit: '%', alarmTime: new Date(now - 9000).toISOString() },
  ]
}

const alarmSourceCodeMap = {
  '温度监控': 'T001',
  '电压监控': 'V001',
  '通信链路': 'S001',
  '存储系统': 'M001',
  '电源系统': 'B001',
  '姿态控制': 'A001',
  '载荷设备': 'P001',
}

const normalizeAlarm = (payload) => {
  const ts = payload.timestampMs || payload.timestamp || payload.time || Date.now()
  const paramName = payload.paramName || payload.paramCode || payload.source || '遥测参数'
  const source = payload.source || payload.alarmSource || ''
  const paramCode = payload.paramCode || payload.telemetryCode || payload.code || payload.sourceCode || alarmSourceCodeMap[source] || ''
  const currentValue = parseValue(payload.currentValue ?? payload.value ?? payload.paramValue)
  const thresholdValue = parseValue(payload.thresholdValue ?? payload.threshold ?? payload.upperLimit ?? payload.lowerLimit)
  const thresholdType = normalizeThresholdType(payload.thresholdType || payload.direction || payload.comparison, currentValue, thresholdValue)
  return {
    id: payload.id || `${paramName}-${ts}-${Math.random().toString(16).slice(2)}`,
    alarmTime: payload.alarmTime || payload.timestamp || payload.time || new Date(ts).toISOString(),
    paramCode,
    paramName,
    currentValue,
    thresholdValue,
    thresholdType,
    unit: payload.unit || '',
    level: payload.level || payload.severity || 'WARNING',
  }
}

const normalizeThresholdType = (raw, currentValue, thresholdValue) => {
  const value = String(raw || '').toUpperCase()
  if (value.includes('LOW') || value.includes('BELOW') || value.includes('LT') || value.includes('DOWN') || value.includes('下限')) return 'LOWER'
  if (value.includes('UP') || value.includes('HIGH') || value.includes('GT') || value.includes('OVER') || value.includes('上限')) return 'UPPER'
  return Number(currentValue) < Number(thresholdValue) ? 'LOWER' : 'UPPER'
}

const alarmDirectionIcon = (type) => type === 'LOWER' ? '↓' : '↑'
const alarmDirectionClass = (type) => type === 'LOWER' ? 'alarm-lower' : 'alarm-upper'

const formatAlarmValue = (value, unit = '') => {
  const num = Number(value)
  const text = Number.isFinite(num) ? num.toFixed(2).replace(/\.00$/, '') : '-'
  return `${text}${unit || ''}`
}

const formatAlarmTime = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const loadRecentAlarms = async () => {
  try {
    const res = await alarmApi.getList(20)
    const rows = (res.data || []).map(normalizeAlarm)
    if (rows.length > 0) {
      alarms.value = rows.slice(0, 12)
      return
    }
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.warn('[alarm] 加载最近告警失败，使用演示告警', e)
  }
  loadFallbackAlarms()
}

const wsBaseUrl = () => {
  const base = getRuntimeConfig().apiBaseUrl || '/api'
  if (/^https?:\/\//.test(base)) {
    const url = new URL(base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/ws/alarm'
    url.search = ''
    return url.toString()
  }
  if (import.meta.env.DEV && base === '/api') return 'ws://localhost:8082/ws/alarm'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/alarm`
}

const connectAlarmSocket = () => {
  if (isMockEnabled() || typeof WebSocket === 'undefined') return
  try {
    alarmSocket = new WebSocket(wsBaseUrl())
    alarmSocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const incoming = Array.isArray(payload) ? payload : [payload]
        alarms.value = [...incoming.map(normalizeAlarm), ...alarms.value].slice(0, 8)
      } catch (e) {
        console.warn('[alarm-ws] 无法解析告警消息', e)
      }
    }
    alarmSocket.onerror = () => {
      if (alarms.value.length === 0) loadFallbackAlarms()
    }
  } catch (e) {
    console.warn('[alarm-ws] 连接失败，使用演示告警', e)
  }
}

const onWindowResize = () => {
  recomputeColWidth()
}

onMounted(async () => {
  await nextTick()
  recomputeColWidth()
  if (typeof ResizeObserver !== 'undefined' && gridRef.value) {
    resizeObserver = new ResizeObserver(() => {
      recomputeColWidth()
    })
    resizeObserver.observe(gridRef.value)
  }
  window.addEventListener('resize', onWindowResize)

  loadTelemetryCache()
  loadExperimentTasks()
  loadRecentAlarms()
  connectAlarmSocket()
  alarmTimer = setInterval(() => {
    if (alarms.value.length === 0 || isMockEnabled()) loadRecentAlarms()
  }, 3000)
})

onUnmounted(() => {
  if (simTimer) clearInterval(simTimer)
  if (alarmTimer) clearInterval(alarmTimer)
  if (alarmSocket) alarmSocket.close()
  if (resizeObserver) resizeObserver.disconnect()
  if (externalNotifyTimer) clearTimeout(externalNotifyTimer)
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.enhanced-viz {
  padding: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ui-text) 8%, transparent);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.toolbar-label {
  flex: none;
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 500;
}

.task-filter-select {
  width: min(260px, 100%);
}

.source-toggle {
  display: flex;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
  flex: none;
}

.source-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  white-space: nowrap;
  line-height: 22px;
}

.source-btn:hover {
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-primary) 8%, transparent);
}

.source-btn-active {
  background: var(--ui-primary);
  color: #fff;
}

.source-btn-active:hover {
  background: color-mix(in srgb, var(--ui-primary) 90%, black);
  color: #fff;
}

.external-task-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg);
  min-width: 260px;
  max-width: 420px;
}

.ext-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
  transition: background 0.3s, box-shadow 0.3s;
}

.ext-dot-wait {
  background: var(--ui-text-muted);
  opacity: 0.4;
}

.ext-dot-on {
  background: var(--ui-success, #22c55e);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-success, #22c55e) 25%, transparent);
}

.ext-task-name {
  font-size: 13px;
  color: var(--ui-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ext-task-meta {
  font-size: 11px;
  color: var(--ui-text-muted);
  flex: none;
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-btn {
  min-height: 30px;
  padding: 4px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.toolbar-btn:hover {
  color: var(--ui-primary);
  border-color: var(--ui-primary);
}

.toolbar-btn-primary {
  border-color: var(--ui-primary);
  background: var(--ui-primary);
  color: var(--ui-bg-elevated);
}

.toolbar-btn-primary:hover {
  background: color-mix(in srgb, var(--ui-primary) 88%, black);
  color: var(--ui-bg-elevated);
}

.grid-container {
  position: relative;
  width: 100%;
  min-height: 560px;
}

.grid-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--ui-primary) 18%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--ui-primary) 18%, transparent) 1px, transparent 1px);
}

.widget {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--block-bg);
  border-radius: var(--ui-radius);
  box-shadow: 0 0 0 1px var(--block-ring), var(--block-shadow);
  transition: box-shadow 0.15s ease;
}

.widget-active {
  z-index: 2;
  box-shadow: 0 0 0 2px var(--ui-primary), 0 12px 28px rgba(0, 0, 0, 0.18);
}

.widget:focus-within {
  z-index: 3;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-border-muted);
  cursor: move;
  user-select: none;
}

.widget-title {
  flex: none;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  justify-content: flex-end;
  cursor: default;
}

.widget-param-select {
  width: min(280px, 70%);
}

.widget-close {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.widget-close:hover {
  background: color-mix(in srgb, var(--ui-error) 18%, transparent);
  color: var(--ui-error);
}

.widget-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.widget-chart {
  width: 100%;
  height: 100%;
}

.widget-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 0 4px;
}

.widget-image-panel {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.image-preview-pane {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ui-bg-muted) 55%, transparent);
  border-right: 1px solid var(--ui-border-muted);
}

.image-nodata-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 80%;
  color: var(--ui-text-muted);
}

.nodata-svg {
  width: 100%;
  max-width: 280px;
  border: 1px dashed var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
}

.nodata-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-text);
}

.nodata-time {
  font-size: 11px;
  color: var(--ui-text-dimmed);
}

.image-preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--ui-text-dimmed);
}

.image-table-pane {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--ui-border-muted);
}

.image-table-pane :deep(.ui-table-body) {
  overflow-x: auto !important;
}

.image-table-pane :deep(.ui-table) {
  font-size: 12px;
}

.image-table-pane :deep(.ui-table th),
.image-table-pane :deep(.ui-table td) {
  padding: 5px 8px !important;
  font-size: 12px;
}

.image-table-pane :deep(.image-row) {
  cursor: pointer;
}

.image-table-pane :deep(.image-row:hover td) {
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg-elevated)) !important;
}

.image-table-pane :deep(.image-row-active td) {
  background: color-mix(in srgb, var(--ui-primary) 14%, var(--ui-bg-elevated)) !important;
  cursor: pointer;
}

.image-table-pane :deep(.image-row-active td:first-child) {
  box-shadow: inset 3px 0 0 var(--ui-primary);
}

.image-table-pane :deep(.ui-pagination) {
  padding: 6px 8px;
  margin: 0 !important;
  border-top: 1px solid var(--ui-border-muted);
  font-size: 11px;
}

.image-status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border-muted);
}

.image-status-done {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 12%, transparent);
  border-color: color-mix(in srgb, var(--ui-success) 30%, transparent);
}

.image-status-pending {
  color: var(--ui-warning, #f59e0b);
  background: color-mix(in srgb, var(--ui-warning, #f59e0b) 12%, transparent);
  border-color: color-mix(in srgb, var(--ui-warning, #f59e0b) 30%, transparent);
}

.image-action-btns {
  display: flex;
  gap: 4px;
}

.img-act-btn {
  padding: 1px 7px;
  font-size: 11px;
  line-height: 18px;
  border-radius: var(--ui-radius);
  border: 1px solid var(--ui-border);
  background: transparent;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.img-act-btn:hover {
  color: var(--ui-primary);
  border-color: var(--ui-primary);
}

.img-act-dl:hover {
  color: var(--ui-success);
  border-color: var(--ui-success);
}

.widget-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background:
    linear-gradient(135deg, transparent 50%, var(--ui-border) 50%, var(--ui-border) 60%, transparent 60%, transparent 75%, var(--ui-border) 75%, var(--ui-border) 85%, transparent 85%);
  border-bottom-right-radius: var(--ui-radius);
}

.widget-resize:hover {
  background:
    linear-gradient(135deg, transparent 50%, var(--ui-primary) 50%, var(--ui-primary) 60%, transparent 60%, transparent 75%, var(--ui-primary) 75%, var(--ui-primary) 85%, transparent 85%);
}

.alarm-time {
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}

.alarm-current-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.alarm-current-value.alarm-upper,
.alarm-current-value.alarm-lower {
  color: #EF443C;
}

.alarm-direction {
  display: inline-block;
  width: 12px;
  font-size: 14px;
  line-height: 1;
  text-align: center;
}
</style>
