<template>
  <div class="data-process">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="处理中的任务" :value="stats.processing" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><SyncOutlined spin /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="今日处理量" :value="stats.todayProcessed" :value-style="{ color: '#45AD8D' }">
            <template #prefix><CheckCircleOutlined /></template>
            <template #suffix>条</template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="去重数据" :value="stats.deduped" :value-style="{ color: '#ECBE84' }">
            <template #prefix><FilterOutlined /></template>
            <template #suffix>条</template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="处理错误" :value="stats.errors" :value-style="{ color: '#EF443C' }">
            <template #prefix><CloseCircleOutlined /></template>
          </UiStatistic>
          <div class="device-error-hint">来自采集设备上报，共 {{ deviceErrorRows.length }} 台设备</div>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiTabs v-model:activeKey="mainTab">
      <UiTabPane key="task" tab="处理任务">
        <UiRow :gutter="16">
          <UiCol :xs="24" :lg="12">
            <UiCard title="数据处理任务" class="data-card">
              <template #extra>
                <UiButton type="primary" size="small" @click="showNewTaskModal">新建任务</UiButton>
              </template>
              <UiTable :columns="taskColumns" :data-source="tasks" :loading="loading" row-key="id" size="small">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'status'">
                    <UiTag :color="getStatusColor(record.status)">{{ record.status }}</UiTag>
                  </template>
                  <template v-if="column.key === 'processedCount'">
                    {{ formatNumber(record.processedCount) }}
                  </template>
                  <template v-if="column.key === 'action'">
                    <UiSpace>
                      <UiButton type="link" size="small" v-if="record.status === '等待中'" @click="startTask(record.id)">启动</UiButton>
                      <UiButton type="link" size="small" v-if="record.status === '运行中'" disabled :title="taskStopUnsupportedTip">停止</UiButton>
                      <UiPopconfirm title="确定删除?" @confirm="deleteTask(record.id)" ok-text="确定" cancel-text="取消">
                        <UiButton type="link" size="small" danger>删除</UiButton>
                      </UiPopconfirm>
                    </UiSpace>
                  </template>
                </template>
              </UiTable>
            </UiCard>
          </UiCol>

          <UiCol :xs="24" :lg="12">
            <UiCard title="处理规则配置" class="data-card">
              <UiList size="small" :data-source="rules" :loading="rulesLoading">
                <template #renderItem="{ item }">
                  <UiListItem>
                    <UiListItemMeta :title="item.ruleName" :description="item.description" />
                    <template #actions>
                      <UiSwitch :checked="item.enabled" size="small" @change="(checked) => toggleRule(item.id, checked)" />
                    </template>
                  </UiListItem>
                </template>
              </UiList>
            </UiCard>

            <UiCard title="实时处理监控" class="data-card" style="margin-top: 16px;">
              <UiDescriptions :column="2" size="small">
                <UiDescriptionsItem label="处理速率">{{ monitorStats.rate }} 条/秒</UiDescriptionsItem>
                <UiDescriptionsItem label="队列长度">{{ monitorStats.queueLength }}</UiDescriptionsItem>
                <UiDescriptionsItem label="内存使用">{{ monitorStats.memory }}</UiDescriptionsItem>
                <UiDescriptionsItem label="CPU使用率">{{ monitorStats.cpu }}</UiDescriptionsItem>
              </UiDescriptions>
            </UiCard>
          </UiCol>
        </UiRow>

        <UiCard title="处理日志" class="data-card" style="margin-top: 16px;">
          <UiTimeline>
            <UiTimelineItem v-for="log in logEntries" :key="log.id" :color="getLogColor(log.level)">
              <span style="color: rgba(255,255,255,0.6)">{{ formatTime(log.logTime) }}</span>
              <span style="color: rgba(255,255,255,0.8); margin-left: 8px">{{ log.message }}</span>
            </UiTimelineItem>
            <UiTimelineItem v-if="logEntries.length === 0">
              <UiEmpty description="暂无日志" :image="false" />
            </UiTimelineItem>
          </UiTimeline>
        </UiCard>
      </UiTabPane>

      <UiTabPane key="realtimeMonitor" tab="数据实时监控">
        <div class="realtime-screen-grid">
          <UiCard title="实时遥测数据" class="data-card realtime-screen-card">
            <template #extra>
              <UiButton size="small" :loading="paramQueryLoading" @click="loadTelemetry">刷新</UiButton>
            </template>
            <UiTable
              :columns="realtimeCompactColumns"
              :data-source="realtimeOnlyRows"
              row-key="id"
              size="small"
              :pagination="false"
              :locale="{ emptyText: '暂无实时遥测数据' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'timestamp'">{{ formatTime(record.timestamp) || '-' }}</template>
                <template v-if="column.key === 'frame'">
                  <span class="frame-preview" @click="openFrameView(record)">{{ record.framePreview }}</span>
                </template>
              </template>
            </UiTable>
          </UiCard>

          <UiCard title="处理队列状态" class="data-card realtime-screen-card">
            <UiTable
              :columns="monitorStatusColumns"
              :data-source="monitorStatusRows"
              row-key="key"
              size="small"
              :pagination="false"
              :locale="{ emptyText: '暂无处理状态' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'value'"><span class="param-value">{{ record.value }}</span></template>
                <template v-if="column.key === 'status'">
                  <UiTag :color="record.color">{{ record.status }}</UiTag>
                </template>
              </template>
            </UiTable>
          </UiCard>

          <UiCard title="帧检查异常" class="data-card realtime-screen-card">
            <UiTable
              :columns="frameErrorColumns"
              :data-source="frameErrorRows"
              row-key="id"
              size="small"
              :pagination="false"
              :locale="{ emptyText: '暂无帧检查异常' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'timestamp'">{{ formatTime(record.timestamp) || '-' }}</template>
                <template v-if="column.key === 'frameCheck'">
                  <UiTag color="error">{{ getFrameCheckText(record.frameCheck) }}</UiTag>
                </template>
                <template v-if="column.key === 'frame'">
                  <span class="frame-preview" @click="openFrameView(record)">{{ record.framePreview }}</span>
                </template>
              </template>
            </UiTable>
          </UiCard>

          <UiCard title="最新处理日志" class="data-card realtime-screen-card">
            <UiTable
              :columns="realtimeLogColumns"
              :data-source="realtimeLogRows"
              row-key="id"
              size="small"
              :pagination="false"
              :locale="{ emptyText: '暂无处理日志' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'logTime'">{{ formatTime(record.logTime) || '-' }}</template>
                <template v-if="column.key === 'level'">
                  <UiTag :color="getLogColor(record.level)">{{ getLogLevelText(record.level) }}</UiTag>
                </template>
                <template v-if="column.key === 'message'">
                  <span class="realtime-table-message">{{ record.message }}</span>
                </template>
              </template>
            </UiTable>
          </UiCard>
        </div>
      </UiTabPane>

      <UiTabPane key="processed" tab="处理后数据（待确认）">
        <UiCard title="处理后遥测数据" class="data-card">
          <template #extra>
            <div class="processed-extra">
              <div class="column-picker" ref="columnPickerRef">
                <UiButton size="small" @click.stop="columnPickerOpen = !columnPickerOpen">列设置 ▾</UiButton>
                <div v-if="columnPickerOpen" class="column-picker-panel">
                  <label v-for="col in processedColumnDefs" :key="col.key" class="column-picker-item">
                    <input
                      type="checkbox"
                      :checked="visibleProcessedColumnKeys.includes(col.key)"
                      @change="toggleColumnVisible(col.key)"
                    />
                    <span>{{ col.title }}</span>
                  </label>
                </div>
              </div>
              <UiButton size="small" @click="loadProcessedData">刷新</UiButton>
            </div>
          </template>
          <UiTable :columns="processedColumns" :data-source="processedData" :loading="processedLoading" row-key="id" size="small" :pagination="{ pageSize: 15 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'satelliteId'">
                <UiTag color="blue">{{ record.satelliteId }}</UiTag>
              </template>
              <template v-if="column.key === 'paramName'">
                <UiTag :color="getParamColor(record.paramName)">{{ record.paramName }}</UiTag>
              </template>
              <template v-if="column.key === 'paramValue'">
                <span style="font-weight: 500">{{ record.paramValue }}</span>
              </template>
              <template v-if="column.key === 'status'">
                <UiTag :color="record.status === '正常' ? 'success' : 'warning'">{{ record.status }}</UiTag>
              </template>
              <template v-if="column.key === 'deduplicated'">
                <UiTag :color="record.deduplicated ? 'orange' : 'default'">{{ record.deduplicated ? '已去重' : '原始' }}</UiTag>
              </template>
              <template v-if="column.key === 'processTime'">
                {{ formatTime(record.processTime) }}
              </template>
            </template>
          </UiTable>
        </UiCard>
      </UiTabPane>

      <UiTabPane key="telemetry" tab="遥测数据（待确认）">
        <UiRow :gutter="16">
          <UiCol :xs="24" :lg="24">
            <UiCard title="参数查询" class="data-card query-card">
              <UiForm layout="vertical" class="param-query-form">
                <div class="param-query-grid">
                  <UiFormItem label="卫星">
                    <UiSelect v-model:value="paramQuery.satellite" placeholder="全部卫星">
                      <UiSelectOption value="">全部卫星</UiSelectOption>
                      <UiSelectOption v-for="satellite in satelliteOptions" :key="satellite" :value="satellite">{{ satellite }}</UiSelectOption>
                    </UiSelect>
                  </UiFormItem>
                  <UiFormItem label="通道">
                    <UiSelect v-model:value="paramQuery.channel" placeholder="全部通道">
                      <UiSelectOption value="">全部通道</UiSelectOption>
                      <UiSelectOption v-for="channel in channelOptions" :key="channel" :value="channel">{{ channel }}</UiSelectOption>
                    </UiSelect>
                  </UiFormItem>
                  <UiFormItem label="参数（多选）">
                    <ParamTreeSelect
                      v-model="paramQuery.params"
                      class="query-param-select"
                      :telemetry-data="parameterSelectData"
                      placeholder="输入或选择遥测参数"
                    />
                  </UiFormItem>
                  <UiFormItem label="起始时间">
                    <UiInput v-model:value="paramQuery.startTime" type="datetime-local" step="1" />
                  </UiFormItem>
                  <UiFormItem label="结束时间">
                    <UiInput v-model:value="paramQuery.endTime" type="datetime-local" step="1" />
                  </UiFormItem>
                  <UiFormItem label="实时/延时">
                    <UiSelect v-model:value="paramQuery.timeMode">
                      <UiSelectOption value="">全部</UiSelectOption>
                      <UiSelectOption value="REALTIME">实时</UiSelectOption>
                      <UiSelectOption value="DELAYED">延时</UiSelectOption>
                    </UiSelect>
                  </UiFormItem>
                  <UiFormItem label="帧检查结果">
                    <UiSelect v-model:value="paramQuery.frameCheck">
                      <UiSelectOption value="">全部</UiSelectOption>
                      <UiSelectOption value="UNKNOWN">未知</UiSelectOption>
                      <UiSelectOption value="CORRECT">正确</UiSelectOption>
                      <UiSelectOption value="ERROR">错误</UiSelectOption>
                    </UiSelect>
                  </UiFormItem>
                  <div class="param-query-actions">
                    <UiButton type="primary" :loading="paramQueryLoading" @click="queryTelemetryParams">查询</UiButton>
                    <UiButton @click="resetParamQuery">重置</UiButton>
                  </div>
                </div>
              </UiForm>
            </UiCard>

            <UiCard title="查询结果" class="data-card query-result-card">
              <UiTabs v-model:activeKey="queryResultView">
                <UiTabPane key="curve" tab="曲线">
                  <TelemetryLineChart :series="paramQuerySeries" class="param-query-chart" />
                </UiTabPane>
                <UiTabPane key="table" tab="表格">
                  <UiTable
                    :columns="paramQueryColumns"
                    :data-source="paramQueryResults"
                    :loading="paramQueryLoading"
                    row-key="id"
                    size="small"
                    :pagination="{ pageSize: 12 }"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'timestamp'">
                        {{ formatTime(record.timestamp) }}
                      </template>
                      <template v-if="column.key === 'value'">
                        <span class="param-value">{{ record.value }}</span>
                      </template>
                    </template>
                  </UiTable>
                </UiTabPane>
              </UiTabs>
            </UiCard>
          </UiCol>
        </UiRow>
      </UiTabPane>

      <UiTabPane key="paramConfig" tab="参数解析配置（待确认）">
        <UiCard title="遥测参数解析配置" class="data-card">
          <template #extra>
            <UiSpace>
              <UiButton size="small" @click="triggerParamConfigImport">上传配置</UiButton>
              <UiButton type="primary" size="small" @click="openParamModal()">添加参数</UiButton>
            </UiSpace>
          </template>
          <div class="param-config-satellite-filter">
            <label>卫星</label>
            <UiSelect v-model:value="selectedConfigSatellite" placeholder="请选择卫星" style="width: 220px">
              <UiSelectOption v-for="sat in satelliteOptions" :key="sat" :value="sat">{{ sat }}</UiSelectOption>
            </UiSelect>
          </div>
          <UiTable
            :columns="paramConfigColumns"
            :data-source="filteredParamConfigs"
            :loading="paramLoading"
            row-key="id"
            size="small"
            :pagination="{ pageSize: 10 }"
            :scroll="{ x: 2200 }"
            :locale="{ emptyText: selectedConfigSatellite ? '该卫星暂无参数配置' : '请先选择卫星' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'statusInfo'">
                <span class="config-status-text">{{ record.statusInfo || '-' }}</span>
              </template>
              <template v-if="column.key === 'storageTelemetry'">
                <UiTag v-if="record.storageTelemetry" color="blue">{{ record.storageTelemetry }}</UiTag>
                <span v-else>-</span>
              </template>
              <template v-if="column.key === 'action'">
                <UiSpace>
                  <UiButton type="link" size="small" @click="openParamModal(record)">编辑</UiButton>
                  <UiPopconfirm title="确定删除?" @confirm="deleteParam(record.id)" ok-text="确定" cancel-text="取消">
                    <UiButton type="link" size="small" danger>删除</UiButton>
                  </UiPopconfirm>
                </UiSpace>
              </template>
            </template>
          </UiTable>
        </UiCard>
      </UiTabPane>

    </UiTabs>
    <!-- 新建任务弹窗 -->
    <UiModal :visible="newTaskVisible" title="新建处理任务" @ok="createTask" @cancel="newTaskVisible = false" :confirmLoading="submitLoading">
      <UiForm layout="vertical">
        <UiFormItem label="任务名称">
          <UiInput v-model:value="newTask.taskName" placeholder="请输入任务名称" />
        </UiFormItem>
        <UiFormItem label="数据源">
          <UiSelect v-model:value="newTask.source" placeholder="请选择数据源">
            <UiSelectOption value="UDP-遥测">UDP-遥测</UiSelectOption>
            <UiSelectOption value="TCP-数传">TCP-数传</UiSelectOption>
            <UiSelectOption value="HTTP">HTTP</UiSelectOption>
            <UiSelectOption value="文件">文件</UiSelectOption>
          </UiSelect>
        </UiFormItem>
      </UiForm>
    </UiModal>

    <!-- 参数配置弹窗 -->
    <UiModal :visible="paramModalVisible" :title="isEditingParam ? '编辑参数' : '添加参数'" @ok="handleParamSubmit" @cancel="paramModalVisible = false" :confirmLoading="paramSubmitLoading" width="1040px">
      <UiForm layout="vertical" class="param-config-form">
        <UiRow :gutter="16">
          <UiCol v-for="field in paramConfigFormFields" :key="field.key" :span="field.span || 8">
            <UiFormItem :label="field.label" :required="field.required">
              <UiInputNumber
                v-if="field.type === 'number'"
                v-model:value="paramForm[field.key]"
                :min="field.min"
                :precision="field.precision"
                style="width: 100%"
              />
              <UiSelect v-else-if="field.type === 'select'" v-model:value="paramForm[field.key]" allow-clear>
                <UiSelectOption value="">未设置</UiSelectOption>
                <UiSelectOption value="是">是</UiSelectOption>
                <UiSelectOption value="否">否</UiSelectOption>
              </UiSelect>
              <UiSelect v-else-if="field.type === 'satellite'" v-model:value="paramForm[field.key]" placeholder="请选择卫星">
                <UiSelectOption v-for="sat in satelliteOptions" :key="sat" :value="sat">{{ sat }}</UiSelectOption>
              </UiSelect>
              <UiTextarea
                v-else-if="field.type === 'textarea'"
                v-model:value="paramForm[field.key]"
                :rows="2"
                :placeholder="field.placeholder"
              />
              <UiInput
                v-else
                v-model:value="paramForm[field.key]"
                :placeholder="field.placeholder"
              />
            </UiFormItem>
          </UiCol>
        </UiRow>
      </UiForm>
    </UiModal>

    <!-- 原始帧(256字节)查看弹窗 -->
    <UiModal :visible="frameViewVisible" title="原始帧数据（256 字节）" @cancel="frameViewVisible = false" :footer="null" width="760px">
      <div v-if="frameViewRecord" class="frame-view-meta">
        <span>卫星：{{ frameViewRecord.satelliteId }}</span>
        <span>遥测代号：{{ frameViewRecord.telemetryCode }}</span>
        <span>时间：{{ formatTime(frameViewRecord.timestamp) || '-' }}</span>
      </div>
      <pre class="frame-hex-dump">{{ frameHexDump }}</pre>
    </UiModal>

    <input ref="paramConfigFileInputRef" type="file" accept=".csv" style="display:none" @change="onParamConfigFileChange" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { message } from '../utils/feedback'
import { processTaskApi, processRuleApi, processLogApi, processedTelemetryApi, telemetryApi, agentApi } from '../api'
import ParamTreeSelect from '../components/ParamTreeSelect.vue'
import TelemetryLineChart from '../components/TelemetryLineChart.vue'

const mainTab = ref('task')
const loading = ref(false)
const rulesLoading = ref(false)
const submitLoading = ref(false)
const processedLoading = ref(false)
const newTaskVisible = ref(false)
let refreshInterval = null
let realtimeMockInterval = null
let realtimeMockSeq = 0

const newTask = reactive({
  taskName: '',
  source: ''
})
const taskStopUnsupportedTip = '当前后端 /api/task 只支持激活任务，暂未提供停止任务接口'

const stats = ref({
  processing: 0,
  todayProcessed: 0,
  deduped: 0,
  errors: 0
})

// 处理错误：软件层暂无法统计，改为汇总采集设备(Agent)上报的接口错误数
const deviceErrorRows = ref([])

const loadDeviceErrors = async () => {
  try {
    const res = await agentApi.getAll()
    const list = res.data || []
    const rows = list
      .map(agent => {
        const instances = agent.instances || []
        const errorCount = instances.reduce((sum, inst) => sum + (Number(inst.errorCount) || 0), 0)
        return {
          agentId: agent.agentId || agent.id || '-',
          agentName: agent.agentName || agent.name || '',
          host: agent.host || agent.ipAddress || agent.ip || '-',
          errorCount
        }
      })
      .filter(row => row.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount)
    deviceErrorRows.value = rows
    stats.value.errors = rows.reduce((sum, row) => sum + row.errorCount, 0)
  } catch (e) {
    console.error(e)
  }
}

const monitorStats = ref({
  rate: 0,
  queueLength: 0,
  memory: '0 GB',
  cpu: '0%'
})

const tasks = ref([])
const rules = ref([])
const logEntries = ref([])
const processedData = ref([])

// 遥测数据 state
const telemetryStats = ref({ totalCount: 0, realtimeCount: 0 })
const telemetryCache = ref([])
// 数据实时监控四分屏用的是处理后的遥测数据，与下方"遥测数据"查询用的原始遥测分开
const processedRealtimeCache = ref([])
const paramQueryLoading = ref(false)
const paramQueryResults = ref([])
const queryResultView = ref('curve')

const paramQuerySeries = computed(() => {
  const grouped = new Map()
  paramQueryResults.value.forEach(item => {
    if (!item.timestamp || item.numericValue === null) return
    if (!grouped.has(item.telemetryCode)) grouped.set(item.telemetryCode, [])
    grouped.get(item.telemetryCode).push(item)
  })
  return Array.from(grouped.entries()).map(([code, items]) => ({
    name: code,
    data: items
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(item => [item.timestamp, item.numericValue])
  }))
})

const paramQuery = reactive({
  satellite: '',
  channel: '',
  params: [],
  startTime: '',
  endTime: '',
  timeMode: '',
  frameCheck: ''
})

// 原始帧(256字节)查看 state
const frameViewVisible = ref(false)
const frameViewRecord = ref(null)

const openFrameView = (record) => {
  frameViewRecord.value = record
  frameViewVisible.value = true
}

const frameHexDump = computed(() => {
  const bytes = frameViewRecord.value?.frameBytes
  if (!bytes) return ''
  const hex = toHexPairs(bytes)
  const lines = []
  for (let offset = 0; offset < hex.length; offset += 16) {
    const chunk = hex.slice(offset, offset + 16)
    lines.push(`${offset.toString(16).padStart(4, '0').toUpperCase()}  ${chunk.join(' ')}`)
  }
  return lines.join('\n')
})

// 参数解析配置 state
const paramConfigs = ref([])
const paramLoading = ref(false)
const paramModalVisible = ref(false)
const paramSubmitLoading = ref(false)
const selectedConfigSatellite = ref('')
const filteredParamConfigs = computed(() =>
  selectedConfigSatellite.value
    ? paramConfigs.value.filter(item => item.satelliteId === selectedConfigSatellite.value)
    : []
)
const isEditingParam = ref(false)

const createEmptyParamForm = () => ({
  id: null,
  satelliteId: selectedConfigSatellite.value || '',
  sequence: null,
  bitWidth: 32,
  telemetryName: '',
  telemetryCode: '',
  formulaType: '106',
  formulaDescription: '',
  processParam: '',
  decimalPlaces: 0,
  paramCode: '0',
  normalValue: '',
  warningValue: '',
  statusInfo: '',
  relatedCommand: '',
  system: '',
  controlChannel: '',
  mergeChannelCount: 0,
  delayChannel: '',
  storageTelemetry: ''
})

const paramForm = reactive(createEmptyParamForm())

const paramConfigFormFields = [
  { label: '卫星', key: 'satelliteId', type: 'satellite', required: true },
  { label: '序号', key: 'sequence', type: 'number', min: 1, precision: 0 },
  { label: '位宽', key: 'bitWidth', type: 'number', min: 1, precision: 0 },
  { label: '遥测名称', key: 'telemetryName', required: true, placeholder: '如: 系统时间' },
  { label: '遥测代号', key: 'telemetryCode', required: true, placeholder: '如: TMS8300' },
  { label: '公式类型', key: 'formulaType', placeholder: '如: 106' },
  { label: '公式描述', key: 'formulaDescription', type: 'textarea', span: 12, placeholder: '请输入公式描述' },
  { label: '处理参数', key: 'processParam', span: 12, placeholder: '如: 1/0/' },
  { label: '小数位数', key: 'decimalPlaces', type: 'number', min: 0, precision: 0 },
  { label: '参数代号', key: 'paramCode', placeholder: '如: 1' },
  { label: '正常值', key: 'normalValue', span: 12, placeholder: '如: 正常:[0,255]' },
  { label: '预警值', key: 'warningValue', span: 12, placeholder: '如: 预警:[200,255]' },
  { label: '状态信息', key: 'statusInfo', type: 'textarea', span: 12, placeholder: '请输入状态说明' },
  { label: '相关指令', key: 'relatedCommand', span: 12, placeholder: '请输入相关指令' },
  { label: '所属系统', key: 'system', span: 12, placeholder: '如: S01综合电子分系统' },
  { label: '控制波道', key: 'controlChannel', placeholder: '请输入控制波道' },
  { label: '合并处理波道数', key: 'mergeChannelCount', type: 'number', min: 0, precision: 0 },
  { label: '延时波道', key: 'delayChannel', placeholder: '请输入延时波道' },
  { label: '存储遥测', key: 'storageTelemetry', type: 'select' }
]

// 计算阈值区间条各段宽度比例
const paramConfigColumns = [
  { title: '卫星', dataIndex: 'satelliteId', key: 'satelliteId', width: 90 },
  { title: '序号', dataIndex: 'sequence', key: 'sequence', width: 70 },
  { title: '位宽', dataIndex: 'bitWidth', key: 'bitWidth', width: 70 },
  { title: '遥测名称', dataIndex: 'telemetryName', key: 'telemetryName', width: 160 },
  { title: '遥测代号', dataIndex: 'telemetryCode', key: 'telemetryCode', width: 110 },
  { title: '公式类型', dataIndex: 'formulaType', key: 'formulaType', width: 90 },
  { title: '公式描述', dataIndex: 'formulaDescription', key: 'formulaDescription', width: 120 },
  { title: '处理参数', dataIndex: 'processParam', key: 'processParam', width: 140 },
  { title: '小数位数', dataIndex: 'decimalPlaces', key: 'decimalPlaces', width: 90 },
  { title: '参数代号', dataIndex: 'paramCode', key: 'paramCode', width: 90 },
  { title: '正常值', dataIndex: 'normalValue', key: 'normalValue', width: 180 },
  { title: '预警值', dataIndex: 'warningValue', key: 'warningValue', width: 140 },
  { title: '状态信息', key: 'statusInfo', width: 220 },
  { title: '相关指令', dataIndex: 'relatedCommand', key: 'relatedCommand', width: 120 },
  { title: '所属系统', dataIndex: 'system', key: 'system', width: 180 },
  { title: '控制波道', dataIndex: 'controlChannel', key: 'controlChannel', width: 100 },
  { title: '合并处理波道数', dataIndex: 'mergeChannelCount', key: 'mergeChannelCount', width: 130 },
  { title: '延时波道', dataIndex: 'delayChannel', key: 'delayChannel', width: 100 },
  { title: '存储遥测', key: 'storageTelemetry', width: 90 },
  { title: '操作', key: 'action', width: 120 }
]

// 参数配置函数
const loadParamConfigs = async () => {
  paramLoading.value = true
  try {
    paramConfigs.value = [
      {
        id: 1, satelliteId: 'SAT-001', sequence: 152, bitWidth: 32, telemetryName: '30V母线电压', telemetryCode: 'FKT001',
        formulaType: '109', formulaDescription: '', processParam: '', decimalPlaces: 2, paramCode: '0',
        normalValue: '', warningValue: '', statusInfo: '', relatedCommand: '', system: '发控台',
        controlChannel: '', mergeChannelCount: 0, delayChannel: '', storageTelemetry: ''
      },
      {
        id: 2, satelliteId: 'SAT-001', sequence: 153, bitWidth: 32, telemetryName: '蓄电池A电压', telemetryCode: 'FKT002',
        formulaType: '109', formulaDescription: '', processParam: '', decimalPlaces: 2, paramCode: '0',
        normalValue: '', warningValue: '', statusInfo: '', relatedCommand: '', system: '发控台',
        controlChannel: '', mergeChannelCount: 0, delayChannel: '', storageTelemetry: ''
      },
      {
        id: 3, satelliteId: 'SAT-002', sequence: 470, bitWidth: 32, telemetryName: '同步标识', telemetryCode: 'TMF001',
        formulaType: '106', formulaDescription: '', processParam: '', decimalPlaces: 2, paramCode: '0',
        normalValue: '', warningValue: '', statusInfo: '', relatedCommand: '', system: '帧头',
        controlChannel: '', mergeChannelCount: 0, delayChannel: '', storageTelemetry: ''
      },
      {
        id: 4, satelliteId: 'SAT-002', sequence: 478, bitWidth: 48, telemetryName: '系统时间', telemetryCode: 'TMS8300',
        formulaType: '114', formulaDescription: '', processParam: '2000/1/1/12/0/0/1/', decimalPlaces: 3, paramCode: '1',
        normalValue: '正确:[0,281474976710655]', warningValue: '', statusInfo: '', relatedCommand: '',
        system: 'S01综合电子分系统', controlChannel: '', mergeChannelCount: 0, delayChannel: '', storageTelemetry: ''
      },
      {
        id: 5, satelliteId: 'SAT-003', sequence: 479, bitWidth: 8, telemetryName: '信道关口A机指令符合计数', telemetryCode: 'TMS0127',
        formulaType: '100', formulaDescription: '', processParam: '1/0/', decimalPlaces: 0, paramCode: '1',
        normalValue: '正常:[0,255]', warningValue: '', statusInfo: '', relatedCommand: '',
        system: 'S01综合电子分系统\\管理单元', controlChannel: '', mergeChannelCount: 0, delayChannel: '', storageTelemetry: ''
      },
      {
        id: 6, satelliteId: 'SAT-004', sequence: 482, bitWidth: 1, telemetryName: '信道关口A机遥控帧CRC效验状态', telemetryCode: 'TMS0130',
        formulaType: '106', formulaDescription: '', processParam: '', decimalPlaces: 0, paramCode: '1',
        normalValue: '正确:[0,0]/错误:[1,1]', warningValue: '', statusInfo: '0 表示正确，1 表示错误',
        relatedCommand: '', system: 'S01综合电子分系统\\管理单元', controlChannel: '', mergeChannelCount: 0,
        delayChannel: '', storageTelemetry: ''
      }
    ]
  } catch (e) {
    console.error(e)
  }
  finally { paramLoading.value = false }
}

const paramConfigFileInputRef = ref(null)
const triggerParamConfigImport = () => paramConfigFileInputRef.value?.click()

const paramConfigCsvFieldMap = {
  '卫星': 'satelliteId',
  '序号': 'sequence',
  '位宽': 'bitWidth',
  '遥测名称': 'telemetryName',
  '遥测代号': 'telemetryCode',
  '公式类型': 'formulaType',
  '公式描述': 'formulaDescription',
  '处理参数': 'processParam',
  '小数位数': 'decimalPlaces',
  '参数代号': 'paramCode',
  '正常值': 'normalValue',
  '预警值': 'warningValue',
  '状态信息': 'statusInfo',
  '相关指令': 'relatedCommand',
  '所属系统': 'system',
  '控制波道': 'controlChannel',
  '合并处理波道数': 'mergeChannelCount',
  '延时波道': 'delayChannel',
  '存储遥测': 'storageTelemetry'
}

// 简单 CSV 行解析，支持双引号包裹的字段（含逗号/转义双引号）
const parseCsvLine = (line) => {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += char
    }
  }
  cells.push(cur)
  return cells
}

const onParamConfigFileChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const lines = String(e.target.result).split(/\r\n|\n|\r/).filter(line => line.trim() !== '')
      if (lines.length < 2) throw new Error('文件内容为空')
      const headers = parseCsvLine(lines[0]).map(h => h.trim())
      const hasSatelliteColumn = headers.includes('卫星')
      if (!hasSatelliteColumn && !selectedConfigSatellite.value) {
        throw new Error('请先在上方选择卫星，或在 CSV 中提供"卫星"列')
      }
      const rows = lines.slice(1).map((line, index) => {
        const cells = parseCsvLine(line)
        const row = { id: Date.now() + index, satelliteId: selectedConfigSatellite.value }
        headers.forEach((header, colIndex) => {
          const key = paramConfigCsvFieldMap[header]
          if (key) row[key] = (cells[colIndex] ?? '').trim()
        })
        return row
      })
      // 按卫星合并：替换掉本次上传涉及到的卫星的原有配置，其余卫星的配置保留不动
      const touchedSatellites = new Set(rows.map(row => row.satelliteId))
      paramConfigs.value = [
        ...paramConfigs.value.filter(item => !touchedSatellites.has(item.satelliteId)),
        ...rows
      ]
      message.success(`已导入 ${rows.length} 条参数配置`)
    } catch (err) {
      console.error('参数配置导入失败', err)
      message.error(err.message?.includes('卫星') ? err.message : '导入失败：文件格式不正确')
    } finally {
      event.target.value = ''
    }
  }
  reader.readAsText(file, 'UTF-8')
}

const openParamModal = (record) => {
  if (record) {
    isEditingParam.value = true
    Object.assign(paramForm, createEmptyParamForm(), record)
  } else {
    isEditingParam.value = false
    Object.assign(paramForm, createEmptyParamForm(), {
      sequence: Math.max(0, ...paramConfigs.value.map(item => Number(item.sequence) || 0)) + 1
    })
  }
  paramModalVisible.value = true
}

const handleParamSubmit = async () => {
  if (!paramForm.satelliteId) {
    message.error('请选择卫星')
    return
  }
  if (!paramForm.telemetryName || !paramForm.telemetryCode) {
    message.error('请填写完整信息')
    return
  }
  paramSubmitLoading.value = true
  try {
    const payload = { ...paramForm }
    if (isEditingParam.value) {
      const idx = paramConfigs.value.findIndex(p => p.id === paramForm.id)
      if (idx !== -1) paramConfigs.value[idx] = payload
      message.success('参数更新成功')
    } else {
      payload.id = Date.now()
      paramConfigs.value.push(payload)
      message.success('参数添加成功')
    }
    paramModalVisible.value = false
  } catch (e) {
    message.error('操作失败')
  }
  finally { paramSubmitLoading.value = false }
}

const deleteParam = async (id) => {
  try {
    paramConfigs.value = paramConfigs.value.filter(p => p.id !== id)
    message.success('参数已删除')
  } catch (e) {
    message.error('删除失败')
  }
}

const taskColumns = [
  { title: '任务名称', dataIndex: 'taskName' },
  { title: '数据源', dataIndex: 'source' },
  { title: '已处理', key: 'processedCount', width: 100 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 150 }
]

const processedColumnDefs = [
  { title: '卫星ID', key: 'satelliteId', width: 100 },
  { title: '参数', key: 'paramName', width: 100 },
  { title: '参数值', key: 'paramValue', width: 120 },
  { title: '状态', key: 'status', width: 70 },
  { title: '数据源', dataIndex: 'sourceInterface', width: 120 },
  { title: '去重', key: 'deduplicated', width: 70 },
  { title: '处理时间', key: 'processTime', width: 150 }
]

const visibleProcessedColumnKeys = ref(processedColumnDefs.map(col => col.key))
const processedColumns = computed(() =>
  processedColumnDefs.filter(col => visibleProcessedColumnKeys.value.includes(col.key))
)

const columnPickerOpen = ref(false)
const columnPickerRef = ref(null)

const toggleColumnVisible = (key) => {
  if (visibleProcessedColumnKeys.value.includes(key)) {
    if (visibleProcessedColumnKeys.value.length === 1) return
    visibleProcessedColumnKeys.value = visibleProcessedColumnKeys.value.filter(k => k !== key)
  } else {
    visibleProcessedColumnKeys.value = [...visibleProcessedColumnKeys.value, key]
  }
}

const onColumnPickerOutsideClick = (event) => {
  if (columnPickerOpen.value && columnPickerRef.value && !columnPickerRef.value.contains(event.target)) {
    columnPickerOpen.value = false
  }
}

const paramQueryColumns = [
  { title: '遥测代号', dataIndex: 'telemetryCode', width: 160 },
  { title: '时间戳', key: 'timestamp', width: 190 },
  { title: '值', key: 'value', width: 140 }
]

const realtimeCompactColumns = [
  { title: '时间', key: 'timestamp', width: 132 },
  { title: '卫星', dataIndex: 'satelliteId', width: 68 },
  { title: '通道', dataIndex: 'channel', width: 58 },
  { title: '原始帧(256B)', key: 'frame', width: 220 }
]

const frameErrorColumns = [
  { title: '时间', key: 'timestamp', width: 132 },
  { title: '卫星', dataIndex: 'satelliteId', width: 68 },
  { title: '遥测', dataIndex: 'telemetryCode', width: 76 },
  { title: '帧检', key: 'frameCheck', width: 62 },
  { title: '原始帧(256B)', key: 'frame', width: 220 }
]

const monitorStatusColumns = [
  { title: '监控项', dataIndex: 'name', width: 92 },
  { title: '当前值', key: 'value', width: 104 },
  { title: '状态', key: 'status', width: 70 },
  { title: '说明', dataIndex: 'description' }
]

const realtimeLogColumns = [
  { title: '时间', key: 'logTime', width: 132 },
  { title: '级别', key: 'level', width: 62 },
  { title: '信息', key: 'message' }
]

const uniqueValues = (items) => Array.from(new Set(items.filter(Boolean)))

const satelliteOptions = computed(() => uniqueValues(telemetryCache.value.map(item => item.satelliteId)).sort())

const channelOptions = computed(() => uniqueValues(telemetryCache.value.map(item => item.channel)).sort())

const realtimeTelemetryRows = computed(() => {
  return [...processedRealtimeCache.value]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 60)
})

const realtimeOnlyRows = computed(() => realtimeTelemetryRows.value
  .filter(item => item.timeMode === 'REALTIME')
  .slice(0, 22))

const frameErrorRows = computed(() => realtimeTelemetryRows.value
  .filter(item => item.frameCheck === 'ERROR')
  .slice(0, 22))

const monitorStatusRows = computed(() => [
  {
    key: 'rate',
    name: '处理速率',
    value: `${formatNumber(monitorStats.value.rate)} 条/秒`,
    status: '正常',
    color: 'success',
    description: '实时处理吞吐'
  },
  {
    key: 'queue',
    name: '队列长度',
    value: formatNumber(monitorStats.value.queueLength),
    status: monitorStats.value.queueLength > 120 ? '关注' : '正常',
    color: monitorStats.value.queueLength > 120 ? 'warning' : 'success',
    description: '待处理数据积压'
  },
  {
    key: 'memory',
    name: '内存使用',
    value: monitorStats.value.memory,
    status: '正常',
    color: 'success',
    description: '处理服务内存占用'
  },
  {
    key: 'cpu',
    name: 'CPU使用率',
    value: monitorStats.value.cpu,
    status: '正常',
    color: 'success',
    description: '处理服务计算负载'
  }
])

const realtimeLogRows = computed(() => (logEntries.value || []).slice(0, 22))

const parameterSelectData = computed(() => {
  const scopedTelemetry = telemetryCache.value
    .filter(item => {
      if (paramQuery.satellite && item.satelliteId !== paramQuery.satellite) return false
      if (paramQuery.channel && item.channel !== paramQuery.channel) return false
      return true
    })
    .map(item => ({
      ...item,
      telemetryCode: item.telemetryCode || item.paramName,
      channel: item.channel || '默认通道',
    }))

  const fromConfigs = paramConfigs.value.map(item => ({
    satelliteId: '参数配置',
    channel: '默认参数',
    telemetryCode: item.telemetryCode || item.paramCode || item.telemetryName,
    paramName: item.telemetryName || item.telemetryCode || item.paramCode,
  }))

  const map = new Map()
  ;[...scopedTelemetry, ...fromConfigs].forEach(item => {
    const key = item.telemetryCode || item.paramName
    if (key && !map.has(key)) map.set(key, item)
  })
  return Array.from(map.values())
})

const normalizeTaskStatus = (status) => {
  const map = {
    RUNNING: '运行中', ACTIVE: '运行中', 运行中: '运行中',
    COMPLETED: '已完成', DONE: '已完成', 已完成: '已完成',
    PENDING: '等待中', WAITING: '等待中', 等待中: '等待中',
    STOPPED: '已停止', 已停止: '已停止',
    FAILED: '失败', ERROR: '失败', 失败: '失败'
  }
  return map[String(status || '').toUpperCase()] || map[status] || status || '-'
}

const getStatusColor = (status) => {
  const colors = { '运行中': 'processing', '已完成': 'success', '等待中': 'default', '已停止': 'default', '失败': 'error' }
  return colors[status] || 'default'
}

const getLogColor = (level) => {
  const colors = { 'INFO': 'blue', 'WARN': 'orange', 'ERROR': 'red', 'DEBUG': 'gray' }
  return colors[level] || 'blue'
}

const getLogLevelText = (level) => {
  const map = { INFO: '信息', WARN: '警告', WARNING: '警告', ERROR: '错误', DEBUG: '调试' }
  return map[String(level || '').toUpperCase()] || level || '-'
}

const getParamColor = (param) => {
  const colors = {
    '温度': 'orange', '电压': 'green', '电流': 'blue', '功率': 'red',
    '姿态角': 'purple', '下行速率': 'cyan', '上行速率': 'geekblue',
    '存储容量': 'gold', '电池温度': 'orange', 'CPU温度': 'volcano'
  }
  return colors[param] || 'default'
}

const getFrameCheckText = (value) => {
  const texts = { CORRECT: '正确', ERROR: '错误', UNKNOWN: '未知' }
  return texts[value] || value || '未知'
}

const formatTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

const formatNumber = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'

const valueFrom = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const parseNumericValue = (value) => {
  if (typeof value === 'number') return value
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

const normalizeFrameCheck = (value) => {
  if (!value) return 'UNKNOWN'
  const text = String(value).toUpperCase()
  if (['CORRECT', 'RIGHT', 'OK', 'TRUE', '正常', '正确'].some(item => text.includes(item))) return 'CORRECT'
  if (['ERROR', 'FALSE', 'FAIL', '错误', '异常'].some(item => text.includes(item))) return 'ERROR'
  return 'UNKNOWN'
}

const normalizeTimeMode = (item) => {
  const raw = valueFrom(item, ['timeMode', 'realtimeMode', 'dataMode', 'mode', 'delayType'])
  if (raw) {
    const text = String(raw).toUpperCase()
    if (text.includes('DELAY') || text.includes('延时')) return 'DELAYED'
    if (text.includes('REAL') || text.includes('实时')) return 'REALTIME'
  }
  if (item.realtime === false || item.isRealtime === false || item.delayed === true) return 'DELAYED'
  return 'REALTIME'
}

const FRAME_BYTE_LENGTH = 256

// 帧字节数据目前后端未下发，这里按遥测代号+时间戳做确定性生成，仅用于演示原始帧编码内容
const hashSeed = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0
  }
  return h || 1
}

const buildFrameBytes = (seedStr, length = FRAME_BYTE_LENGTH) => {
  let state = hashSeed(seedStr)
  const bytes = new Array(length)
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) >>> 0
    bytes[i] = (state >>> 16) % 256
  }
  return bytes
}

const toHexPairs = (bytes) => bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase())

const framePreviewText = (bytes, count = 8) =>
  `${toHexPairs(bytes.slice(0, count)).join(' ')} …`

const normalizeTelemetry = (item, index) => {
  const timestamp = valueFrom(item, ['timestamp', 'collectTime', 'processTime', 'time', 'createdAt'])
  const paramName = valueFrom(item, ['paramName', 'name', 'telemetryName']) || '-'
  const telemetryCode = valueFrom(item, ['telemetryCode', 'paramCode', 'code', 'tmCode']) || paramName
  const value = valueFrom(item, ['value', 'paramValue', 'telemetryValue']) ?? '-'
  const id = valueFrom(item, ['id', 'key']) || `${telemetryCode}-${timestamp || index}-${index}`
  const frameBytes = valueFrom(item, ['frameBytes']) || buildFrameBytes(`${id}`)

  return {
    raw: item,
    id,
    satelliteId: valueFrom(item, ['satelliteId', 'satellite_id']) || '-',
    channel: valueFrom(item, ['channel', 'channelName', 'sourceInterface', 'interfaceInstanceId', 'protocol']) || '-',
    paramName,
    telemetryCode,
    timestamp,
    value,
    numericValue: parseNumericValue(value),
    timeMode: normalizeTimeMode(item),
    frameBytes,
    framePreview: framePreviewText(frameBytes),
    frameCheck: normalizeFrameCheck(valueFrom(item, ['frameCheckResult', 'frameCheck', 'checkResult', 'frameStatus', 'status']))
  }
}

const matchesParamQuery = (item) => {
  if (paramQuery.satellite && item.satelliteId !== paramQuery.satellite) return false
  if (paramQuery.channel && item.channel !== paramQuery.channel) return false
  if (paramQuery.params.length > 0 && !paramQuery.params.includes(item.telemetryCode)) return false
  if (paramQuery.timeMode && item.timeMode !== paramQuery.timeMode) return false
  if (paramQuery.frameCheck && item.frameCheck !== paramQuery.frameCheck) return false

  const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : null
  if (paramQuery.startTime && (!timestamp || timestamp < new Date(paramQuery.startTime).getTime())) return false
  if (paramQuery.endTime && (!timestamp || timestamp > new Date(paramQuery.endTime).getTime())) return false

  return true
}

const updateTelemetryStats = (stats = {}, list = telemetryCache.value) => {
  telemetryStats.value = {
    totalCount: stats.totalCount ?? stats.total_count ?? list.length,
    realtimeCount: stats.realtimeCount ?? stats.realtime_count ?? list.filter(item => item.timeMode === 'REALTIME').length
  }
}

const realtimeMockSatellites = ['SAT-001', 'SAT-002', 'SAT-003', 'SAT-004']
const realtimeMockChannels = ['CH-A', 'CH-B', 'CH-C', 'CH-D']
const realtimeMockParams = [
  { name: '温度', code: 'P001', base: 22, span: 62, unit: '' },
  { name: '电压', code: 'P002', base: 24, span: 5, unit: '' },
  { name: '电流', code: 'P003', base: 4, span: 10, unit: '' },
  { name: '功率', code: 'P004', base: 80, span: 120, unit: '' },
  { name: '姿态角X', code: 'P005', base: -180, span: 360, unit: '' },
  { name: '信号强度', code: 'P006', base: -96, span: 38, unit: '' },
  { name: '下行速率', code: 'P007', base: 48, span: 86, unit: '' },
  { name: '存储容量', code: 'P008', base: 28, span: 70, unit: '' }
]
const realtimeMockMessages = ['遥测帧接收', '协议解析完成', '参数入库完成', '异常帧复核', '队列调度完成']

const createRealtimeMockRows = (count) => {
  const now = Date.now()
  return Array.from({ length: count }, (_, index) => {
    const param = realtimeMockParams[(realtimeMockSeq + index) % realtimeMockParams.length]
    const numericValue = Number((param.base + Math.random() * param.span).toFixed(2))
    const isFrameError = Math.random() > 0.78
    const sequence = realtimeMockSeq++
    return {
      id: `mock-live-${now}-${sequence}`,
      satelliteId: realtimeMockSatellites[sequence % realtimeMockSatellites.length],
      channel: realtimeMockChannels[(sequence + index) % realtimeMockChannels.length],
      paramName: param.name,
      telemetryCode: param.code,
      timestamp: new Date(now - index * 60).toISOString(),
      value: `${numericValue}${param.unit}`,
      numericValue,
      timeMode: 'REALTIME',
      frameCheck: isFrameError ? 'ERROR' : 'CORRECT'
    }
  })
}

const appendRealtimeMockLog = (batchSize) => {
  const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR']
  const level = levels[Math.floor(Math.random() * levels.length)]
  const messagePrefix = realtimeMockMessages[Math.floor(Math.random() * realtimeMockMessages.length)]
  logEntries.value = [{
    id: `mock-log-${Date.now()}-${realtimeMockSeq}`,
    level,
    logTime: new Date().toISOString(),
    message: `${messagePrefix}，刷新 ${batchSize} 条数据`
  }, ...logEntries.value].slice(0, 90)
}

const updateRealtimeMockStats = (batchSize) => {
  monitorStats.value.rate = Math.floor(Math.random() * 5200 + 3600)
  monitorStats.value.queueLength = Math.max(0, Math.floor(Math.random() * 160 + 20 - batchSize))
  monitorStats.value.memory = (Math.random() * 1.8 + 0.7).toFixed(1) + ' GB'
  monitorStats.value.cpu = Math.floor(Math.random() * 58 + 18) + '%'
  stats.value.todayProcessed += batchSize
  stats.value.processing = Math.max(stats.value.processing, 1)
}

const tickRealtimeMockFeed = () => {
  const batchSize = Math.floor(Math.random() * 9) + 12
  const rows = createRealtimeMockRows(batchSize)
  telemetryCache.value = [...rows, ...telemetryCache.value].slice(0, 280)
  updateTelemetryStats({}, telemetryCache.value)
  updateRealtimeMockStats(batchSize)
  appendRealtimeMockLog(batchSize)
}

const startRealtimeMockFeed = () => {
  if (realtimeMockInterval) return
  tickRealtimeMockFeed()
  realtimeMockInterval = setInterval(tickRealtimeMockFeed, 600)
}

const stopRealtimeMockFeed = () => {
  if (!realtimeMockInterval) return
  clearInterval(realtimeMockInterval)
  realtimeMockInterval = null
}

const loadTelemetry = async () => {
  try {
    const [dataRes, statsRes, processedRes] = await Promise.all([
      telemetryApi.getRecent(500),
      telemetryApi.getStats(),
      processedTelemetryApi.getRecent(500)
    ])
    const telemetryList = dataRes.data || []
    telemetryCache.value = telemetryList.map(normalizeTelemetry)
    updateTelemetryStats(statsRes.data || {}, telemetryCache.value)
    processedRealtimeCache.value = (processedRes.data || []).map(normalizeTelemetry)
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e)
  }
}

const queryTelemetryParams = async () => {
  paramQueryLoading.value = true
  try {
    const res = await telemetryApi.query({
      satellite: paramQuery.satellite,
      channel: paramQuery.channel,
      params: paramQuery.params,
      startTime: paramQuery.startTime,
      endTime: paramQuery.endTime,
      timeMode: paramQuery.timeMode,
      frameCheck: paramQuery.frameCheck,
      limit: 1000,
    })
    const rows = (res.data || []).map(normalizeTelemetry)
    paramQueryResults.value = rows
      .filter(matchesParamQuery)
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    if (rows.length > 0) telemetryCache.value = rows
  } catch (e) {
    console.error(e)
    message.error('查询失败')
  } finally {
    paramQueryLoading.value = false
  }
}

const resetParamQuery = () => {
  paramQuery.satellite = ''
  paramQuery.channel = ''
  paramQuery.params = []
  paramQuery.startTime = ''
  paramQuery.endTime = ''
  paramQuery.timeMode = ''
  paramQuery.frameCheck = ''
  queryTelemetryParams()
}

const loadTasks = async () => {
  try {
    const res = await processTaskApi.getAll()
    tasks.value = (res.data || []).map((t) => ({ ...t, status: normalizeTaskStatus(t.status) }))
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) return
    console.error(e)
  }
}

const loadRules = async () => {
  rulesLoading.value = true
  try {
    const res = await processRuleApi.getAll()
    rules.value = res.data || []
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      rulesLoading.value = false
      return
    }
    console.error(e)
  }
  finally { rulesLoading.value = false }
}

const loadStats = async () => {
  try {
    const [taskStats, processedStats] = await Promise.all([
      processTaskApi.getStats(),
      processedTelemetryApi.getStats()
    ])
    stats.value.processing = taskStats.data?.running || 0
    stats.value.todayProcessed = processedStats.data?.todayProcessed || 0
    stats.value.deduped = processedStats.data?.todayDeduped || 0
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      // Request was aborted or timed out, ignore
      return
    }
    console.error(e)
  }
}

const loadMonitorStats = async () => {
  try {
    const res = await processedTelemetryApi.getMonitor()
    const data = res.data || {}
    monitorStats.value.rate = data.rate || Math.floor(Math.random() * 2000 + 1000)
    monitorStats.value.queueLength = data.queueLength || Math.floor(Math.random() * 100 + 50)
    monitorStats.value.memory = (Math.random() * 2 + 0.5).toFixed(1) + ' GB'
    monitorStats.value.cpu = Math.floor(Math.random() * 40 + 20) + '%'
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      return
    }
    monitorStats.value.rate = Math.floor(Math.random() * 2000 + 1000)
    monitorStats.value.queueLength = Math.floor(Math.random() * 100 + 50)
    monitorStats.value.memory = (Math.random() * 2 + 0.5).toFixed(1) + ' GB'
    monitorStats.value.cpu = Math.floor(Math.random() * 40 + 20) + '%'
  }
}

const loadLogs = async () => {
  try {
    const res = await processLogApi.getRecent(20)
    logEntries.value = res.data || []
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) return
    console.error(e)
}
}

const loadProcessedData = async () => {
  processedLoading.value = true
  try {
    const res = await processedTelemetryApi.getRecent(100)
    processedData.value = res.data || []
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted') || e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      processedLoading.value = false
      return
    }
    console.error(e)
  }
  finally { processedLoading.value = false }
}

const loadData = async () => {
  loading.value = true
  await Promise.all([loadTasks(), loadRules(), loadStats(), loadLogs()])
  loading.value = false
}

const showNewTaskModal = () => {
  newTask.taskName = ''
  newTask.source = ''
  newTaskVisible.value = true
}

const createTask = async () => {
  if (!newTask.taskName || !newTask.source) {
    message.error('请填写完整信息')
    return
  }
  submitLoading.value = true
  try {
    await processTaskApi.add({
      taskName: newTask.taskName,
      source: newTask.source,
      progress: 0,
      status: '等待中'
    })
    message.success('任务创建成功')
    newTaskVisible.value = false
    loadTasks()
  } catch (e) { message.error('创建失败') }
  finally { submitLoading.value = false }
}

const startTask = async (id) => {
  try {
    await processTaskApi.start(id)
    message.success('任务已启动')
    loadTasks()
  } catch (e) { message.error('操作失败') }
}

const stopTask = async (id) => {
  try {
    await processTaskApi.stop(id)
    message.success('任务已停止')
    loadTasks()
  } catch (e) { message.error('操作失败') }
}

const deleteTask = async (id) => {
  try {
    await processTaskApi.delete(id)
    message.success('任务已删除')
    loadTasks()
  } catch (e) { message.error('删除失败') }
}

const toggleRule = async (id, enabled) => {
  try {
    await processRuleApi.setEnabled(id, enabled)
    message.success(enabled ? '规则已启用' : '规则已禁用')
    loadRules()
  } catch (e) { message.error('操作失败'); loadRules() }
}

onMounted(() => {
  loadData()
  loadProcessedData()
  loadMonitorStats()
  loadTelemetry().then(queryTelemetryParams)
  loadParamConfigs()
  loadDeviceErrors()
  refreshInterval = setInterval(() => {
    loadStats()
    loadMonitorStats()
    loadLogs()
    loadDeviceErrors()
    if (mainTab.value === 'realtimeMonitor') loadTelemetry()
  }, 15000)
  if (mainTab.value === 'realtimeMonitor') startRealtimeMockFeed()
  document.addEventListener('click', onColumnPickerOutsideClick)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  stopRealtimeMockFeed()
  document.removeEventListener('click', onColumnPickerOutsideClick)
})

watch(mainTab, (activeTab) => {
  if (activeTab === 'realtimeMonitor') {
    startRealtimeMockFeed()
  } else {
    stopRealtimeMockFeed()
  }
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }
.stat-card, .data-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 4px !important;
}
/* 阈值区间可视化条 */
.state-bar-container {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
.state-bar {
  display: flex;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
}
.state-segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 60px;
}
.state-name {
  color: white;
  font-size: 12px;
  font-weight: 500;
}
.state-range {
  color: rgba(255,255,255,0.7);
  font-size: 10px;
}
.threshold-card {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
}
.threshold-disabled {
  opacity: 0.5;
}

.query-card,
.query-result-card {
  margin-top: 16px;
}

.realtime-screen-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(250px, calc((100vh - 246px) / 2));
  gap: 10px;
}

.realtime-screen-card {
  min-width: 0;
  min-height: 0;
}

.realtime-screen-card :deep(.ui-card-header),
.realtime-screen-card :deep(.ui-card-head) {
  align-items: center;
  display: flex;
  min-height: 30px;
  padding: 3px 10px;
}

.realtime-screen-card :deep(.ui-card-title),
.realtime-screen-card :deep(.ui-card-head-title) {
  padding: 0;
  font-size: 13px;
  line-height: 18px;
}

.realtime-screen-card :deep(.ui-card-extra) {
  padding: 0;
}

.realtime-screen-card :deep(.ui-card-extra .ui-button) {
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
}

.realtime-screen-card :deep(.ui-card-body) {
  height: calc(100% - 32px);
  min-height: 0;
  overflow: auto;
  padding: 6px 10px 8px;
}

.realtime-screen-card :deep(.ui-table th),
.realtime-screen-card :deep(.ui-table td) {
  padding: 4px 8px;
  font-size: 11px;
  line-height: 16px;
}

.realtime-screen-card :deep(.ui-tag) {
  min-height: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 16px;
}

.realtime-table-message {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
  white-space: nowrap;
}

.query-card {
  z-index: 5;
  overflow: visible !important;
}

.query-card :deep(.ui-card-body) {
  overflow: visible;
}

.param-query-form {
  width: 100%;
}

.param-query-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.param-query-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
}

.param-config-satellite-filter {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.param-config-satellite-filter label {
  color: var(--ui-text-muted);
  font-size: 13px;
}

.query-param-select {
  width: 100%;
}

.param-query-chart {
  width: 100%;
  height: 360px;
}

.param-value {
  color: var(--ui-text-highlighted);
  font-weight: 600;
}

.frame-preview {
  color: var(--ui-primary);
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.frame-preview:hover {
  text-decoration: underline;
}

.frame-view-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  color: var(--ui-text-muted);
  font-size: 13px;
}

.frame-hex-dump {
  max-height: 480px;
  overflow: auto;
  padding: 12px 14px;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-muted);
  color: var(--ui-text-highlighted);
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

.processed-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column-picker {
  position: relative;
}

.column-picker-panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 150px;
  max-height: 280px;
  overflow: auto;
  padding: 8px;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.22),
    0 0 0 1px var(--ui-border);
}

.column-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  font-size: 13px;
  cursor: pointer;
}

.column-picker-item:hover {
  background: var(--ui-bg-muted);
}

.column-picker-item input {
  accent-color: var(--ui-primary);
}

.device-error-hint {
  margin-top: 6px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.config-status-text {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  color: var(--ui-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.param-config-form :deep(.ui-form-item) {
  margin-bottom: 12px;
}

@media (max-width: 1400px) {
  .param-query-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .param-query-grid {
    grid-template-columns: 1fr;
  }
}
</style>
