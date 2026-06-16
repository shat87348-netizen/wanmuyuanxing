<template>
  <div class="data-collection">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="采集接口总数" :value="stats.total" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><ApiOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="在线接口" :value="stats.online" :value-style="{ color: '#45AD8D' }">
            <template #prefix><CheckCircleOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="异常接口" :value="stats.error" :value-style="{ color: '#EF443C' }">
            <template #prefix><CloseCircleOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="今日采集量" :value="stats.todayCount" :value-style="{ color: '#ECBE84' }">
            <template #prefix><DatabaseOutlined /></template>
            <template #suffix>条</template>
          </UiStatistic>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiTabs v-model:activeKey="mainTab" class="main-tabs">
      <UiTabPane key="interface" tab="接口管理">
        <UiRow :gutter="16">
          <UiCol :xs="24" :lg="16">
            <UiCard title="采集接口管理" class="data-card">
              <template #extra>
                <UiSpace>
                  <UiSelect v-model:value="interfaceTypeFilter" placeholder="接口类型" style="width: 120px" allowClear>
                    <UiSelectOption value="INTERNAL">内部接口</UiSelectOption>
                    <UiSelectOption value="EXTERNAL">外部接口</UiSelectOption>
                  </UiSelect>
                  <UiSelect v-model:value="protocolFilter" placeholder="传输方式" style="width: 120px" allowClear>
                    <UiSelectOption value="http">http</UiSelectOption>
                    <UiSelectOption value="消息中间件">消息中间件</UiSelectOption>
                    <UiSelectOption value="Udp">Udp</UiSelectOption>
                    <UiSelectOption value="TCP">TCP</UiSelectOption>
                  </UiSelect>
                  <UiButton type="primary" @click="handleAddClick">新增接口</UiButton>
                </UiSpace>
              </template>
              <UiTable :columns="columns" :data-source="filteredInterfaces" :loading="loading" row-key="id" size="small">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'interfaceType'">
                    <UiTag :color="record.interfaceType === 'INTERNAL' ? 'blue' : 'purple'">
                      {{ record.interfaceType === 'INTERNAL' ? '内部' : '外部' }}
                    </UiTag>
                  </template>
                  <template v-if="column.key === 'status'">
                    <UiTag :color="getStatusColor(record.status)">{{ record.status }}</UiTag>
                  </template>
                  <template v-if="column.key === 'address'">
                    <span>{{ record.host }}:{{ record.port }}</span>
                  </template>
                  <template v-if="column.key === 'packetCount'">
                    <span>{{ formatNumber(record.packetCount) }}</span>
                  </template>
                  <template v-if="column.key === 'flowRate'">
                    <span>{{ formatFlowRate(record.flowRate) }}</span>
                  </template>
                  <template v-if="column.key === 'enabled'">
                    <UiSwitch :checked="record.enabled" size="small" @change="(checked) => handleEnabledChange(record.id, checked)" />
                  </template>
                  <template v-if="column.key === 'action'">
                    <div class="action-icons">
                      <UiTooltip title="编辑">
                        <UiButton class="icon-action-btn" size="small" aria-label="编辑" title="编辑" @click="handleEditClick(record)">
                          <EditOutlined class="action-icon" />
                        </UiButton>
                      </UiTooltip>
                      <UiTooltip title="删除">
                        <UiPopconfirm title="确定删除?" @confirm="deleteInterface(record.id)" ok-text="确定" cancel-text="取消">
                          <UiButton class="icon-action-btn danger" size="small" aria-label="删除" title="删除">
                            <DeleteOutlined class="action-icon" />
                          </UiButton>
                        </UiPopconfirm>
                      </UiTooltip>
                      <UiTooltip title="停止">
                        <UiButton class="icon-action-btn" size="small" aria-label="停止" title="停止" :disabled="record.status !== '在线'" @click="handleStopClick(record)">
                          <StopOutlined class="action-icon" />
                        </UiButton>
                      </UiTooltip>
                      <UiTooltip title="带宽">
                        <UiButton class="icon-action-btn" size="small" aria-label="带宽" title="带宽" @click="handleBandwidthClick(record)">
                          <GaugeOutlined class="action-icon" />
                        </UiButton>
                      </UiTooltip>
                      <UiTooltip title="重启">
                        <UiButton class="icon-action-btn" size="small" aria-label="重启" title="重启" @click="handleRestartClick(record)">
                          <ReloadOutlined class="action-icon" />
                        </UiButton>
                      </UiTooltip>
                    </div>
                  </template>
                </template>
              </UiTable>
            </UiCard>

          </UiCol>

          <UiCol :xs="24" :lg="8">
            <UiCard title="接口事件监控" class="data-card event-card">
              <template #extra>
                <UiBadge :count="eventStats.error + eventStats.critical" :offset="[-5, 0]">
                  <UiButton size="small" @click="loadEvents">刷新</UiButton>
                </UiBadge>
              </template>
              <UiRow :gutter="8" class="event-stats">
                <UiCol :span="6"><UiStatistic title="信息" :value="eventStats.info" :value-style="{ color: '#8ABBDB', fontSize: '16px' }" /></UiCol>
                <UiCol :span="6"><UiStatistic title="警告" :value="eventStats.warning" :value-style="{ color: '#ECBE84', fontSize: '16px' }" /></UiCol>
                <UiCol :span="6"><UiStatistic title="错误" :value="eventStats.error" :value-style="{ color: '#EF443C', fontSize: '16px' }" /></UiCol>
                <UiCol :span="6"><UiStatistic title="严重" :value="eventStats.critical" :value-style="{ color: '#FF0000', fontSize: '16px' }" /></UiCol>
              </UiRow>
              <div class="event-timeline-wrapper">
                <UiTimeline class="event-timeline">
                  <UiTimelineItem v-for="event in events" :key="event.id" :color="getEventColor(event.severity)">
                  <div class="event-item">
                    <div class="event-header">
                      <UiTag :color="getEventColor(event.severity)" size="small">{{ event.severity }}</UiTag>
                      <span class="event-time">{{ formatTime(event.eventTime) }}</span>
                    </div>
                    <div class="event-message">{{ event.message }}</div>
                  </div>
                  </UiTimelineItem>
                  <UiTimelineItem v-if="events.length === 0">
                    <UiEmpty description="暂无事件" :image="false" />
                  </UiTimelineItem>
                </UiTimeline>
              </div>
            </UiCard>
          </UiCol>
        </UiRow>
      </UiTabPane>

      <UiTabPane key="protocol" tab="协议配置">
        <UiCard title="协议解析配置" class="data-card">
          <template #extra>
            <UiButton type="primary" @click="openProtocolModal()">新增配置</UiButton>
          </template>
          <UiTable :columns="protocolColumns" :data-source="protocolConfigs" row-key="id" size="small">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'protocolType'">
                <UiTag :color="getProtocolColor(record.protocolType)">{{ record.protocolType }}</UiTag>
              </template>
              <template v-if="column.key === 'enabled'">
                <UiSwitch :checked="record.enabled" size="small" @change="(checked) => toggleProtocolEnabled(record.id, checked)" />
              </template>
              <template v-if="column.key === 'action'">
                <UiSpace>
                  <UiButton type="link" size="small" @click="openProtocolModal(record)">编辑</UiButton>
                  <UiPopconfirm title="确定删除?" @confirm="deleteProtocol(record.id)" ok-text="确定" cancel-text="取消">
                    <UiButton type="link" size="small" danger>删除</UiButton>
                  </UiPopconfirm>
                </UiSpace>
              </template>
            </template>
          </UiTable>
        </UiCard>
      </UiTabPane>

    </UiTabs>

    <!-- 接口弹窗 -->
    <UiModal :visible="modalVisible" :title="isEditing ? '编辑接口' : '新增接口'" @ok="handleSubmit" @cancel="closeModal" :confirmLoading="submitLoading">
      <UiForm :model="form" layout="vertical">
        <UiFormItem label="接口名称" required><UiInput v-model:value="form.interfaceName" placeholder="请输入接口名称" /></UiFormItem>
        <UiFormItem label="接口类型" required>
          <UiSelect v-model:value="form.interfaceType" placeholder="请选择接口类型">
            <UiSelectOption value="INTERNAL">内部接口</UiSelectOption>
            <UiSelectOption value="EXTERNAL">外部接口</UiSelectOption>
          </UiSelect>
        </UiFormItem>
        <UiFormItem label="发送方"><UiInput v-model:value="form.sender" placeholder="请输入发送方" /></UiFormItem>
        <UiFormItem label="消息内容"><UiInput v-model:value="form.messageType" placeholder="请输入消息内容" /></UiFormItem>
        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="传输方式" required>
              <UiSelect v-model:value="form.protocol" placeholder="请选择传输方式">
                <UiSelectOption value="http">http</UiSelectOption>
                <UiSelectOption value="消息中间件">消息中间件</UiSelectOption>
                <UiSelectOption value="Udp">Udp</UiSelectOption>
                <UiSelectOption value="TCP">TCP</UiSelectOption>
              </UiSelect>
            </UiFormItem>
          </UiCol>
          <UiCol :span="12">
            <UiFormItem label="传输协议">
              <UiInput v-model:value="form.transportProtocol" placeholder="如: json / protobuf / pdxp" />
            </UiFormItem>
          </UiCol>
        </UiRow>
        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="协议配置">
              <UiSelect v-model:value="form.protocolConfigId" placeholder="请选择协议配置" allow-clear show-search :filter-option="filterOption">
                <UiSelectOption v-for="config in protocolConfigs" :key="config.id" :value="config.id">
                  {{ config.configName }} ({{ config.protocolType }})
                </UiSelectOption>
              </UiSelect>
            </UiFormItem>
          </UiCol>
        </UiRow>
        <UiRow :gutter="16">
          <UiCol :span="16">
            <UiFormItem label="主机" required><UiInput v-model:value="form.host" placeholder="如: 192.168.1.100" /></UiFormItem>
          </UiCol>
          <UiCol :span="8">
            <UiFormItem label="端口" required><UiInputNumber v-model:value="form.port" :min="1" :max="65535" style="width: 100%" /></UiFormItem>
          </UiCol>
        </UiRow>
        <UiFormItem label="状态">
          <UiSelect v-model:value="form.status">
            <UiSelectOption value="在线">在线</UiSelectOption>
            <UiSelectOption value="离线">离线</UiSelectOption>
            <UiSelectOption value="异常">异常</UiSelectOption>
          </UiSelect>
        </UiFormItem>
        <UiFormItem label="备注"><UiTextarea v-model:value="form.remark" :rows="2" placeholder="请输入备注" /></UiFormItem>
      </UiForm>
    </UiModal>

    <!-- 带宽弹窗 -->
    <UiModal :visible="bandwidthModalVisible" title="设置带宽限制" @ok="handleBandwidthSubmit" @cancel="bandwidthModalVisible = false">
      <UiForm layout="vertical">
        <UiFormItem label="带宽限制 (Mbps)">
          <UiInputNumber v-model:value="bandwidthValue" :min="1" :max="10000" style="width: 100%" />
        </UiFormItem>
      </UiForm>
    </UiModal>

    <!-- 协议配置弹窗 -->
    <UiModal :visible="protocolModalVisible" :title="isProtocolEditing ? '编辑协议配置' : '新增协议配置'" @ok="handleProtocolSubmit" @cancel="protocolModalVisible = false" :confirmLoading="protocolLoading" width="800px">
      <UiForm :model="protocolForm" layout="vertical">
        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="配置名称" required>
              <UiInput v-model:value="protocolForm.configName" placeholder="请输入配置名称" />
            </UiFormItem>
          </UiCol>
          <UiCol :span="12">
            <UiFormItem label="协议类型" required>
              <UiSelect v-model:value="protocolForm.protocolType" placeholder="请选择协议类型" @change="handleProtocolTypeChange">
                <UiSelectOption value="JSON">JSON</UiSelectOption>
                <UiSelectOption value="PDXP">PDXP</UiSelectOption>
                <UiSelectOption value="Protobuf">Protobuf</UiSelectOption>
              </UiSelect>
            </UiFormItem>
          </UiCol>
        </UiRow>
        <UiRow :gutter="16">
          <UiCol :span="12">
            <UiFormItem label="数据类型">
              <UiSelect v-model:value="protocolForm.dataType" placeholder="请选择数据类型">
                <UiSelectOption value="遥测">遥测</UiSelectOption>
                <UiSelectOption value="遥感">遥感</UiSelectOption>
                <UiSelectOption value="设备">设备</UiSelectOption>
                <UiSelectOption value="环境">环境</UiSelectOption>
              </UiSelect>
            </UiFormItem>
          </UiCol>
          <UiCol :span="12">
            <UiFormItem label="描述">
              <UiInput v-model:value="protocolForm.description" placeholder="请输入描述" />
            </UiFormItem>
          </UiCol>
        </UiRow>

        <div v-if="protocolForm.protocolType === 'JSON'">
          <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">JSON 字段映射</UiDivider>
          <UiTable :columns="jsonFieldColumns" :data-source="protocolForm.jsonFields" size="small" :pagination="false" row-key="(item, index) => index">
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'jsonPath'">
                <UiInput v-model:value="record.jsonPath" placeholder="如: $.satellite.id" />
              </template>
              <template v-if="column.key === 'fieldName'">
                <UiInput v-model:value="record.fieldName" placeholder="字段名" />
              </template>
              <template v-if="column.key === 'dataType'">
                <UiSelect v-model:value="record.dataType" style="width: 100%">
                  <UiSelectOption value="string">string</UiSelectOption>
                  <UiSelectOption value="int">int</UiSelectOption>
                  <UiSelectOption value="float">float</UiSelectOption>
                  <UiSelectOption value="double">double</UiSelectOption>
                  <UiSelectOption value="boolean">boolean</UiSelectOption>
                </UiSelect>
              </template>
              <template v-if="column.key === 'action'">
                <UiButton type="link" danger size="small" @click="removeJsonField(index)">删除</UiButton>
              </template>
            </template>
          </UiTable>
          <UiButton type="dashed" block style="margin-top: 8px" @click="addJsonField">+ 添加字段</UiButton>
        </div>

        <div v-if="protocolForm.protocolType === 'PDXP'">
          <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">帧头配置</UiDivider>
          <UiTable :columns="frameHeaderColumns" :data-source="protocolForm.frameHeaderFields" size="small" :pagination="false" row-key="identifier">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'fieldName'">
                <span>{{ record.fieldName }}</span>
              </template>
              <template v-if="column.key === 'identifier'">
                <UiTag color="blue">{{ record.identifier }}</UiTag>
              </template>
              <template v-if="column.key === 'value'">
                <UiInput v-model:value="record.value" placeholder="请输入值" />
              </template>
            </template>
          </UiTable>

          <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">字段定义</UiDivider>
          <UiTable :columns="pdxpFieldColumns" :data-source="protocolForm.pdxpFields" size="small" :pagination="false" row-key="(item, index) => index">
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'fieldName'">
                <UiInput v-model:value="record.fieldName" placeholder="字段名" />
              </template>
              <template v-if="column.key === 'offset'">
                <UiInputNumber v-model:value="record.offset" :min="0" style="width: 100%" />
              </template>
              <template v-if="column.key === 'length'">
                <UiInputNumber v-model:value="record.length" :min="1" style="width: 100%" />
              </template>
              <template v-if="column.key === 'dataType'">
                <UiSelect v-model:value="record.dataType" style="width: 100%">
                  <UiSelectOption value="uint8">uint8</UiSelectOption>
                  <UiSelectOption value="uint16">uint16</UiSelectOption>
                  <UiSelectOption value="uint32">uint32</UiSelectOption>
                  <UiSelectOption value="int8">int8</UiSelectOption>
                  <UiSelectOption value="int16">int16</UiSelectOption>
                  <UiSelectOption value="int32">int32</UiSelectOption>
                  <UiSelectOption value="float">float</UiSelectOption>
                  <UiSelectOption value="double">double</UiSelectOption>
                  <UiSelectOption value="string">string</UiSelectOption>
                </UiSelect>
              </template>
              <template v-if="column.key === 'byteOrder'">
                <UiSelect v-model:value="record.byteOrder" style="width: 100%">
                  <UiSelectOption value="LittleEndian">小端</UiSelectOption>
                  <UiSelectOption value="BigEndian">大端</UiSelectOption>
                </UiSelect>
              </template>
              <template v-if="column.key === 'action'">
                <UiButton type="link" danger size="small" @click="removePdxpField(index)">删除</UiButton>
              </template>
            </template>
          </UiTable>
          <UiButton type="dashed" block style="margin-top: 8px" @click="addPdxpField">+ 添加字段</UiButton>
        </div>

        <div v-if="protocolForm.protocolType === 'Protobuf'">
          <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">Proto 定义</UiDivider>
          <UiFormItem label="消息定义">
            <UiTextarea v-model:value="protocolForm.protoDefinition" :rows="6" placeholder="请输入 Protobuf 消息定义" />
            <UiButton type="link" size="small" @click="loadProtoTemplate" style="padding: 0; margin-top: 4px">加载示例模板</UiButton>
          </UiFormItem>

          <UiDivider style="border-color: #8ABBDB; color: #8ABBDB;">字段映射</UiDivider>
          <UiTable :columns="protoFieldColumns" :data-source="protocolForm.protoFields" size="small" :pagination="false" row-key="(item, index) => index">
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'protoField'">
                <UiInput v-model:value="record.protoField" placeholder="如: temperature" />
              </template>
              <template v-if="column.key === 'fieldName'">
                <UiInput v-model:value="record.fieldName" placeholder="字段名" />
              </template>
              <template v-if="column.key === 'dataType'">
                <UiSelect v-model:value="record.dataType" style="width: 100%">
                  <UiSelectOption value="string">string</UiSelectOption>
                  <UiSelectOption value="int32">int32</UiSelectOption>
                  <UiSelectOption value="int64">int64</UiSelectOption>
                  <UiSelectOption value="float">float</UiSelectOption>
                  <UiSelectOption value="double">double</UiSelectOption>
                  <UiSelectOption value="bool">bool</UiSelectOption>
                </UiSelect>
              </template>
              <template v-if="column.key === 'transform'">
                <UiInput v-model:value="record.transform" placeholder="转换公式，如: value*0.1" />
              </template>
              <template v-if="column.key === 'action'">
                <UiButton type="link" danger size="small" @click="removeProtoField(index)">删除</UiButton>
              </template>
            </template>
          </UiTable>
          <UiButton type="dashed" block style="margin-top: 8px" @click="addProtoField">+ 添加字段</UiButton>
        </div>
      </UiForm>
    </UiModal>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { interfaceApi, interfaceEventApi, protocolConfigApi } from '../api'
import { message } from '../utils/feedback'

const mainTab = ref('interface')
const loading = ref(false)
const interfaceList = ref([])
const interfaceTypeFilter = ref(null)
const protocolFilter = ref(null)
const modalVisible = ref(false)
const bandwidthModalVisible = ref(false)
const protocolModalVisible = ref(false)
const submitLoading = ref(false)
const protocolLoading = ref(false)
const isEditing = ref(false)
const isProtocolEditing = ref(false)
const activeTab = ref('UDP')
let refreshInterval = null
let eventRefreshInterval = null
// Telemetry state
const events = ref([])
const eventStats = ref({ info: 0, warning: 0, error: 0, critical: 0 })
const protocolConfigs = ref([])

const currentInterfaceId = ref(null)
const bandwidthValue = ref(100)

const form = reactive({
  id: null, interfaceName: '', interfaceType: 'INTERNAL', sender: '', messageType: '',
  protocol: 'Udp', transportProtocol: 'pdxp', protocolConfigId: null, host: '', port: 8080, status: '在线', remark: ''
})

// 协议配置表单
const protocolForm = reactive({
  id: null, configName: '', protocolType: 'JSON', dataType: '遥测', description: '',
  enabled: true,
  // JSON fields
  jsonFields: [],
  // PDXP fields
  frameHeaderFields: [
    { fieldName: '版本', identifier: 'VER', value: '' },
    { fieldName: '任务标志', identifier: 'MID', value: '' },
    { fieldName: '信源地址', identifier: 'SID', value: '' },
    { fieldName: '信宿地址', identifier: 'DID', value: '' },
    { fieldName: '数据标志', identifier: 'BID', value: '' },
    { fieldName: '数据处理标志', identifier: 'BID', value: '' },
    { fieldName: '保留', identifier: 'RES', value: '' }
  ],
  pdxpFields: [],
  // Protobuf fields
  protoDefinition: '', protoFields: []
})

// JSON 字段列定义
const jsonFieldColumns = [
  { title: 'JSONPath', key: 'jsonPath', width: '35%' },
  { title: '字段名', key: 'fieldName', width: '25%' },
  { title: '数据类型', key: 'dataType', width: '25%' },
  { title: '操作', key: 'action', width: '15%' }
]

// PDXP 字段列定义
const pdxpFieldColumns = [
  { title: '字段名', key: 'fieldName', width: '15%' },
  { title: '偏移量', key: 'offset', width: '12%' },
  { title: '长度', key: 'length', width: '10%' },
  { title: '数据类型', key: 'dataType', width: '15%' },
  { title: '字节序', key: 'byteOrder', width: '15%' },
  { title: '操作', key: 'action', width: '13%' }
]

// 帧头字段列定义
const frameHeaderColumns = [
  { title: '字段名', key: 'fieldName', width: '25%' },
  { title: '标识', key: 'identifier', width: '20%' },
  { title: '值', key: 'value', width: '55%' }
]

// Protobuf 字段列定义
const protoFieldColumns = [
  { title: 'Proto字段', key: 'protoField', width: '20%' },
  { title: '字段名', key: 'fieldName', width: '20%' },
  { title: '数据类型', key: 'dataType', width: '15%' },
  { title: '转换公式', key: 'transform', width: '20%' },
  { title: '操作', key: 'action', width: '15%' }
]

// 协议类型切换处理
const handleProtocolTypeChange = (type) => {
  if (type === 'JSON') {
    if (protocolForm.jsonFields.length === 0) addJsonField()
  } else if (type === 'PDXP') {
    if (protocolForm.pdxpFields.length === 0) addPdxpField()
  } else if (type === 'Protobuf') {
    if (protocolForm.protoFields.length === 0) addProtoField()
  }
}

// JSON 字段操作
const addJsonField = () => {
  protocolForm.jsonFields.push({ jsonPath: '', fieldName: '', dataType: 'string' })
}

const removeJsonField = (index) => {
  protocolForm.jsonFields.splice(index, 1)
}

// PDXP 字段操作
const addPdxpField = () => {
  protocolForm.pdxpFields.push({ fieldName: '', offset: 0, length: 4, dataType: 'float', byteOrder: 'LittleEndian' })
}

const removePdxpField = (index) => {
  protocolForm.pdxpFields.splice(index, 1)
}

// Protobuf 字段操作
const addProtoField = () => {
  protocolForm.protoFields.push({ protoField: '', fieldName: '', dataType: 'string', transform: '' })
}

const removeProtoField = (index) => {
  protocolForm.protoFields.splice(index, 1)
}

const loadProtoTemplate = () => {
  protocolForm.protoDefinition = `message Telemetry {
  optional string satellite_id = 1;
  optional float temperature = 2;
  optional float voltage = 3;
  optional float current = 4;
}`
}

const stats = ref({ total: 0, online: 0, offline: 0, error: 0, todayCount: 0 })

const columns = [
  { title: '发送方', dataIndex: 'sender', key: 'sender', width: 150 },
  { title: '信息内容', dataIndex: 'messageType', key: 'messageType', width: 170 },
  { title: '接口名称', dataIndex: 'interfaceName', key: 'interfaceName', width: 150 },
  { title: '类型', key: 'interfaceType', width: 60 },
  { title: '传输方式', dataIndex: 'protocol', key: 'protocol', width: 90 },
  { title: '传输协议', dataIndex: 'transportProtocol', key: 'transportProtocol', width: 110 },
  { title: '地址', key: 'address', customRender: ({ record }) => `${record.host}:${record.port}`, width: 130 },
  { title: '状态', key: 'status', width: 60 },
  { title: '数据包', key: 'packetCount', width: 80 },
  { title: '流量', key: 'flowRate', width: 80 },
  { title: '启用', key: 'enabled', width: 50 },
  { title: '操作', key: 'action', width: 150 }
]

const protocolColumns = [
  { title: '配置名称', dataIndex: 'configName', key: 'configName' },
  { title: '协议类型', key: 'protocolType', width: 100 },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '启用', key: 'enabled', width: 60 },
  { title: '操作', key: 'action', width: 100 }
]

const filteredInterfaces = computed(() => {
  let result = interfaceList.value
  if (interfaceTypeFilter.value) result = result.filter(i => i.interfaceType === interfaceTypeFilter.value)
  if (protocolFilter.value) result = result.filter(i => i.protocol === protocolFilter.value)
  return result
})

const getStatusColor = (status) => ({ '在线': 'success', '离线': 'default', '异常': 'error' }[status] || 'default')
const getEventColor = (severity) => ({ 'INFO': 'blue', 'WARNING': 'orange', 'ERROR': 'red', 'CRITICAL': 'red' }[severity] || 'gray')
const getProtocolColor = (type) => ({ 'PDXP': 'cyan', 'Protobuf': 'purple', 'JSON': 'green' }[type] || 'default')
const getParamColor = (param) => {
  const colors = {
    '温度': 'orange', '电压': 'green', '电流': 'blue', '功率': 'red',
    '姿态角': 'purple', '下行速率': 'cyan', '上行速率': 'geekblue',
    '存储容量': 'gold', '电池温度': 'orange', 'CPU温度': 'volcano'
  }
  return colors[param] || 'default'
}

const formatFlowRate = (bytes) => {
  if (!bytes) return '0 B/s'
  if (bytes < 1024) return bytes + ' B/s'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB/s'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB/s'
}

const formatNumber = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'
const formatTime = (time) => time ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : ''

const filterOption = (input, option) => {
  return option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
}

const manualOverrides = new Map()

const loadInterfaces = async () => {
  try {
    const res = await interfaceApi.getAll()
    const rows = (res.data || []).map(item => {
      const override = manualOverrides.get(item.id)
      return override ? { ...item, ...override } : item
    })
    interfaceList.value = rows
    stats.value.total = rows.length
    stats.value.online = rows.filter(i => i.status === '在线').length
    stats.value.offline = rows.filter(i => i.status === '离线').length
    stats.value.error = rows.filter(i => i.status === '异常').length
  } catch (e) {
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e)
  }
}

const loadStats = async () => {
  try {
    const res = await interfaceApi.getStats()
    stats.value = { ...stats.value, ...res.data }
  } catch (e) { 
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e) 
  }
}

const loadEvents = async () => {
  try {
    const [eventsRes, statsRes] = await Promise.all([interfaceEventApi.getRecent(20), interfaceEventApi.getStats()])
    events.value = eventsRes.data || []
    eventStats.value = statsRes.data || {}
  } catch (e) { 
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e) 
  }
}

const loadProtocolConfigs = async () => {
  try {
    const res = await protocolConfigApi.getAll()
    protocolConfigs.value = res.data || []
  } catch (e) { 
    if (e.code === 'ERR_CANCELED' || e.message?.includes('aborted')) return
    console.error(e) 
  }
}

const loadData = async (showLoading = true) => {
  if (showLoading) loading.value = true
  await Promise.all([loadInterfaces(), loadStats()])
  if (showLoading) loading.value = false
}

const handleAddClick = () => {
  isEditing.value = false
  Object.assign(form, { id: null, interfaceName: '', interfaceType: 'INTERNAL', sender: '', messageType: '', protocol: 'Udp', transportProtocol: 'pdxp', protocolConfigId: null, host: '', port: 8080, status: '在线', remark: '' })
  modalVisible.value = true
}

const handleEditClick = (record) => {
  isEditing.value = true
  Object.assign(form, record)
  modalVisible.value = true
}

const handleBandwidthClick = (record) => {
  currentInterfaceId.value = record.id
  bandwidthValue.value = record.bandwidth || 100
  bandwidthModalVisible.value = true
}

const closeModal = () => { modalVisible.value = false }

const handleSubmit = async () => {
  if (!form.interfaceName || !form.host || !form.port) {
    message.error('请填写完整信息')
    return
  }
  submitLoading.value = true
  try {
    if (isEditing.value) {
      await interfaceApi.update({ ...form })
      message.success('更新成功')
    } else {
      await interfaceApi.add({ ...form })
      message.success('添加成功')
    }
    closeModal()
    loadData()
  } catch (e) { message.error('操作失败') }
  finally { submitLoading.value = false }
}

const handleBandwidthSubmit = async () => {
  try {
    await interfaceApi.setBandwidth(currentInterfaceId.value, bandwidthValue.value)
    message.success('带宽限制已设置')
    bandwidthModalVisible.value = false
  } catch (e) { message.error('设置失败') }
}

const deleteInterface = async (id) => {
  try {
    await interfaceApi.delete(id)
    message.success('删除成功')
    loadData()
  } catch (e) { message.error('删除失败') }
}

const updateInterfaceStats = () => {
  stats.value.total = interfaceList.value.length
  stats.value.online = interfaceList.value.filter(i => i.status === '在线').length
  stats.value.offline = interfaceList.value.filter(i => i.status === '离线').length
  stats.value.error = interfaceList.value.filter(i => i.status === '异常').length
}

const applyOverride = (id, changes) => {
  const prev = manualOverrides.get(id) || {}
  manualOverrides.set(id, { ...prev, ...changes })
  const idx = interfaceList.value.findIndex(i => i.id === id)
  if (idx >= 0) {
    interfaceList.value[idx] = { ...interfaceList.value[idx], ...changes }
    updateInterfaceStats()
  }
}

const handleEnabledChange = async (id, enabled) => {
  applyOverride(id, { enabled, status: enabled ? '在线' : '离线' })
  try {
    await interfaceApi.setEnabled(id, enabled)
  } catch (e) {
    if (e?.code !== 'ERR_UNSUPPORTED_API') {
      message.error('操作失败')
      manualOverrides.delete(id)
      loadInterfaces()
      return
    }
  }
  message.success(enabled ? '接口已启用' : '接口已禁用')
}

const handleStopClick = async (record) => {
  applyOverride(record.id, { status: '离线', enabled: false })
  try {
    await interfaceApi.setEnabled(record.id, false)
  } catch (e) {
    if (e?.code !== 'ERR_UNSUPPORTED_API') {
      message.error('停止失败')
      manualOverrides.delete(record.id)
      loadInterfaces()
      return
    }
  }
  message.success('接口已停止')
}

const handleRestartClick = async (record) => {
  applyOverride(record.id, { status: '离线', enabled: false })
  message.success('接口正在重启...')

  try { await interfaceApi.setEnabled(record.id, false) } catch (e) { /* mock 模式忽略 */ }

  setTimeout(async () => {
    applyOverride(record.id, { status: '在线', enabled: true })
    try { await interfaceApi.setEnabled(record.id, true) } catch (e) { /* mock 模式忽略 */ }
    message.success('接口已重启完成')
  }, 800)
}

const openProtocolModal = (record = null) => {
  if (record) {
    isProtocolEditing.value = true
    Object.assign(protocolForm, record)
  } else {
    isProtocolEditing.value = false
    Object.assign(protocolForm, {
      id: null, configName: '', protocolType: 'JSON', dataType: '遥测', description: '',
      enabled: true, jsonFields: [{ jsonPath: '', fieldName: '', dataType: 'string' }],
      frameHeaderFields: [
        { fieldName: '版本', identifier: 'VER', value: '' },
        { fieldName: '任务标志', identifier: 'MID', value: '' },
        { fieldName: '信源地址', identifier: 'SID', value: '' },
        { fieldName: '信宿地址', identifier: 'DID', value: '' },
        { fieldName: '数据标志', identifier: 'BID', value: '' },
        { fieldName: '数据处理标志', identifier: 'BID', value: '' },
        { fieldName: '保留', identifier: 'RES', value: '' }
      ], pdxpFields: [],
      protoDefinition: '', protoFields: []
    })
  }
  protocolModalVisible.value = true
}

const handleProtocolSubmit = async () => {
  if (!protocolForm.configName || !protocolForm.protocolType) {
    message.error('请填写完整信息')
    return
  }
  protocolLoading.value = true
  try {
    if (isProtocolEditing.value) {
      await protocolConfigApi.update({ ...protocolForm })
      message.success('更新成功')
    } else {
      await protocolConfigApi.add({ ...protocolForm })
      message.success('添加成功')
    }
    protocolModalVisible.value = false
    loadProtocolConfigs()
  } catch (e) { message.error('操作失败') }
  finally { protocolLoading.value = false }
}

const deleteProtocol = async (id) => {
  try {
    await protocolConfigApi.delete(id)
    message.success('删除成功')
    loadProtocolConfigs()
  } catch (e) { message.error('删除失败') }
}

const toggleProtocolEnabled = async (id, enabled) => {
  try {
    const config = protocolConfigs.value.find(c => c.id === id)
    if (config) {
      config.enabled = enabled
      await protocolConfigApi.update(config)
      message.success(enabled ? '已启用' : '已禁用')
      loadProtocolConfigs()
    }
  } catch (e) { message.error('操作失败'); loadProtocolConfigs() }
}

onMounted(() => {
  loadData()
  loadEvents()
  loadProtocolConfigs()
  refreshInterval = setInterval(() => loadData(false), 15000)
  eventRefreshInterval = setInterval(loadEvents, 5000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  if (eventRefreshInterval) clearInterval(eventRefreshInterval)
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }
.stat-card, .data-card { background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 4px !important; }
.event-stats {
  margin-bottom: 8px;
  padding: 6px;
  background: color-mix(in srgb, var(--ui-bg-muted) 65%, transparent);
  border-radius: 4px;
}
.event-timeline { max-height: 350px; overflow-y: auto; }
.event-timeline-wrapper {
  padding-top: 8px;
  position: relative;
  z-index: 1;
}
.event-card { padding-top: 8px; }
.event-timeline .ui-timeline-item { margin-top: 4px; }
.event-timeline::before {
  content: "";
  display: block;
  height: 8px;
}
.event-item { font-size: 12px; }
.event-header { display: flex; align-items: center; gap: 8px; }
.event-time { color: var(--ui-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.event-message {
  margin-top: 4px;
  color: var(--ui-text);
  word-break: break-all;
  line-height: 1.5;
}
.action-icons {
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 24px;
  white-space: nowrap;
}

.action-icons :deep(.ui-tooltip),
.action-icons :deep(.ui-popconfirm) {
  display: inline-flex;
  line-height: 1;
}

.icon-action-btn {
  width: 24px;
  height: 24px;
  min-height: 24px !important;
  padding: 0 !important;
  border-color: transparent !important;
  background: transparent !important;
  color: var(--ui-text-muted);
  line-height: 1;
}

.icon-action-btn .action-icon {
  display: inline-flex;
  width: 14px;
  height: 14px;
  font-size: 14px;
  line-height: 1;
  flex: none;
}
.icon-action-btn:hover {
  color: var(--ui-primary);
}
.icon-action-btn.danger {
  color: var(--ui-error);
}

.data-card :deep(.ui-table td) {
  padding-top: 6px;
  padding-bottom: 6px;
  vertical-align: middle;
}
</style>
