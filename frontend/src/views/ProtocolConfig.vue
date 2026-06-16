<template>
  <div class="protocol-config">
    <UiRow :gutter="16" class="stats-row">
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="协议模板" :value="protocolCount" :value-style="{ color: '#8ABBDB' }">
            <template #prefix><ApiOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="启用中" :value="enabledCount" :value-style="{ color: '#45AD8D' }">
            <template #prefix><CheckCircleOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="JSON协议" :value="jsonCount" :value-style="{ color: '#ECBE84' }">
            <template #prefix><FileTextOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
      <UiCol :xs="24" :sm="12" :md="6">
        <UiCard class="stat-card">
          <UiStatistic title="二进制协议" :value="binaryCount" :value-style="{ color: '#EF443C' }">
            <template #prefix><BlockOutlined /></template>
          </UiStatistic>
        </UiCard>
      </UiCol>
    </UiRow>

    <UiRow :gutter="16">
      <UiCol :xs="24" :lg="10">
        <UiCard title="协议模板列表" class="data-card">
          <template #extra>
            <UiButton type="primary" @click="showAddModal">新建协议</UiButton>
          </template>
          <UiTable :columns="columns" :data-source="protocolList" :loading="loading" row-key="id" size="small">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <UiTag :color="getTypeColor(record.protocolType)">{{ record.protocolType }}</UiTag>
              </template>
              <template v-if="column.key === 'enabled'">
                <UiSwitch :checked="record.enabled" size="small" @change="toggleEnabled(record)" />
              </template>
              <template v-if="column.key === 'action'">
                <UiSpace>
                  <UiButton type="link" size="small" @click="editProtocol(record)">配置</UiButton>
                  <UiButton type="link" size="small" @click="testProtocol(record)">测试</UiButton>
                  <UiPopconfirm title="确定删除?" @confirm="deleteProtocol(record.id)" ok-text="确定" cancel-text="取消">
                    <UiButton type="link" size="small" danger>删除</UiButton>
                  </UiPopconfirm>
                </UiSpace>
              </template>
            </template>
          </UiTable>
        </UiCard>
      </UiCol>

      <UiCol :xs="24" :lg="14">
        <UiCard :title="configTitle" class="data-card">
          <template #extra>
            <UiSpace>
              <UiButton type="primary" size="small" @click="saveConfig" :disabled="!editingProtocol">保存配置</UiButton>
              <UiButton size="small" @click="testConfig" :disabled="!editingProtocol">测试解析</UiButton>
            </UiSpace>
          </template>

          <UiTabs v-model:activeTab="activeTab" v-if="editingProtocol">
            <UiTabPane key="fields" tab="字段配置">
              <div class="field-config-container">
                <div class="field-toolbar">
                  <UiButton type="primary" size="small" @click="addField">添加字段</UiButton>
                  <UiSelect v-model:value="addFieldType" style="width: 120px; margin-left: 8px" size="small">
                    <UiSelectOption value="string">字符串</UiSelectOption>
                    <UiSelectOption value="number">数字</UiSelectOption>
                    <UiSelectOption value="boolean">布尔</UiSelectOption>
                    <UiSelectOption value="datetime">时间</UiSelectOption>
                  </UiSelect>
                </div>
                <UiTable :columns="fieldColumns" :data-source="fieldConfigs" :pagination="false" size="small" bordered>
                  <template #bodyCell="{ column, record, index }">
                    <template v-if="column.key === 'sourceField'">
                      <UiInput v-model:value="record.sourceField" placeholder="源字段名" size="small" />
                    </template>
                    <template v-if="column.key === 'targetField'">
                      <UiInput v-model:value="record.targetField" placeholder="目标字段名" size="small" />
                    </template>
                    <template v-if="column.key === 'mapping'">
                      <UiInput v-model:value="record.mapping" placeholder="中文映射" size="small" />
                    </template>
                    <template v-if="column.key === 'type'">
                      <UiSelect v-model:value="record.type" size="small" style="width: 80px">
                        <UiSelectOption value="string">字符串</UiSelectOption>
                        <UiSelectOption value="number">数字</UiSelectOption>
                        <UiSelectOption value="boolean">布尔</UiSelectOption>
                        <UiSelectOption value="datetime">时间</UiSelectOption>
                      </UiSelect>
                    </template>
                    <template v-if="column.key === 'required'">
                      <UiCheckbox v-model:checked="record.required" />
                    </template>
                    <template v-if="column.key === 'action'">
                      <UiButton type="link" size="small" danger @click="removeField(index)">删除</UiButton>
                    </template>
                  </template>
                </UiTable>
              </div>
            </UiTabPane>

            <UiTabPane key="parse" tab="解析规则">
              <UiForm layout="vertical">
                <UiRow :gutter="16">
                  <UiCol :span="12">
                    <UiFormItem label="数据格式">
                      <UiSelect v-model:value="parseRulesConfig.dataFormat">
                        <UiSelectOption value="json">JSON</UiSelectOption>
                        <UiSelectOption value="binary">二进制</UiSelectOption>
                        <UiSelectOption value="text">文本/CSV</UiSelectOption>
                        <UiSelectOption value="delimited">分隔符文本</UiSelectOption>
                      </UiSelect>
                    </UiFormItem>
                  </UiCol>
                  <UiCol :span="12">
                    <UiFormItem label="字符编码">
                      <UiSelect v-model:value="parseRulesConfig.encoding">
                        <UiSelectOption value="utf-8">UTF-8</UiSelectOption>
                        <UiSelectOption value="gbk">GBK</UiSelectOption>
                        <UiSelectOption value="gb2312">GB2312</UiSelectOption>
                      </UiSelect>
                    </UiFormItem>
                  </UiCol>
                </UiRow>

                <UiRow :gutter="16" v-if="parseRulesConfig.dataFormat === 'delimited'">
                  <UiCol :span="12">
                    <UiFormItem label="分隔符">
                      <UiInput v-model:value="parseRulesConfig.delimiter" placeholder="如: ," />
                    </UiFormItem>
                  </UiCol>
                  <UiCol :span="12">
                    <UiFormItem label="是否有表头">
                      <UiSwitch v-model:checked="parseRulesConfig.hasHeader" /> 是
                    </UiFormItem>
                  </UiCol>
                </UiRow>

                <UiRow :gutter="16" v-if="parseRulesConfig.dataFormat === 'binary'">
                  <UiCol :span="8">
                    <UiFormItem label="头部长度">
                      <UiInputNumber v-model:value="parseRulesConfig.headerLen" :min="0" style="width: 100%" />
                    </UiFormItem>
                  </UiCol>
                  <UiCol :span="8">
                    <UiFormItem label="字节序">
                      <UiSelect v-model:value="parseRulesConfig.endian">
                        <UiSelectOption value="little">小端</UiSelectOption>
                        <UiSelectOption value="big">大端</UiSelectOption>
                      </UiSelect>
                    </UiFormItem>
                  </UiCol>
                  <UiCol :span="8">
                    <UiFormItem label="数据区域起始">
                      <UiInputNumber v-model:value="parseRulesConfig.dataStart" :min="0" style="width: 100%" />
                    </UiFormItem>
                  </UiCol>
                </UiRow>

                <UiFormItem label="时间格式" v-if="parseRulesConfig.dataFormat === 'text' || parseRulesConfig.dataFormat === 'delimited'">
                  <UiInput v-model:value="parseRulesConfig.timeFormat" placeholder="如: yyyy-MM-dd HH:mm:ss" />
                </UiFormItem>
              </UiForm>
            </UiTabPane>

            <UiTabPane key="validation" tab="验证规则">
              <div class="validation-config">
                <UiCheckbox v-model:checked="validationConfig.enabled">启用验证</UiCheckbox>
                <UiDivider />

                <UiCollapse v-model:activeKey="validationActive">
                  <UiCollapsePanel key="ranges" header="数值范围验证">
                    <div v-for="(range, field) in validationConfig.ranges" :key="field" class="range-item">
                      <UiTag>{{ field }}</UiTag>
                      <UiInputNumber v-model:value="range.min" :min="-99999" placeholder="最小值" style="width: 80px" size="small" />
                      ~
                      <UiInputNumber v-model:value="range.max" :min="-99999" placeholder="最大值" style="width: 80px" size="small" />
                      <UiButton type="link" size="small" danger @click="delete validationConfig.ranges[field]">删除</UiButton>
                    </div>
                    <UiButton type="dashed" block @click="addRangeValidation">添加范围验证</UiButton>
                  </UiCollapsePanel>

                  <UiCollapsePanel key="required" header="必填字段验证">
                    <UiSelect
                      v-model:value="validationConfig.requiredFields"
                      mode="tags"
                      style="width: 100%"
                      placeholder="选择必填字段"
                    >
                      <UiSelectOption v-for="field in fieldConfigs" :key="field.targetField">
                        {{ field.mapping || field.targetField }}
                      </UiSelectOption>
                    </UiSelect>
                  </UiCollapsePanel>

                  <UiCollapsePanel key="regex" header="正则表达式验证">
                    <div v-for="(regex, field) in validationConfig.regexPatterns" :key="field" class="regex-item">
                      <UiTag>{{ field }}</UiTag>
                      <UiInput v-model:value="regex.pattern" placeholder="正则表达式" style="width: 150px" size="small" />
                      <UiInput v-model:value="regex.message" placeholder="错误提示" style="width: 120px" size="small" />
                      <UiButton type="link" size="small" danger @click="delete validationConfig.regexPatterns[field]">删除</UiButton>
                    </div>
                    <UiButton type="dashed" block @click="addRegexValidation">添加正则验证</UiButton>
                  </UiCollapsePanel>
                </UiCollapse>
              </div>
            </UiTabPane>

            <UiTabPane key="transform" tab="转换规则">
              <UiForm layout="vertical">
                <UiCheckbox v-model:checked="transformConfig.enabled">启用数据转换</UiCheckbox>
                <UiDivider />

                <div v-for="(rule, index) in transformConfig.rules" :key="index" class="transform-rule">
                  <UiTag>规则 {{ index + 1 }}</UiTag>
                  <UiSelect v-model:value="rule.field" style="width: 120px" size="small">
                    <UiSelectOption v-for="field in fieldConfigs" :key="field.targetField">
                      {{ field.mapping || field.targetField }}
                    </UiSelectOption>
                  </UiSelect>
                  <UiSelect v-model:value="rule.type" style="width: 100px" size="small">
                    <UiSelectOption value="multiply">乘系数</UiSelectOption>
                    <UiSelectOption value="divide">除系数</UiSelectOption>
                    <UiSelectOption value="add">加常量</UiSelectOption>
                    <UiSelectOption value="subtract">减常量</UiSelectOption>
                    <UiSelectOption value="round">四舍五入</UiSelectOption>
                    <UiSelectOption value="substring">截取字符串</UiSelectOption>
                  </UiSelect>
                  <UiInput v-model:value="rule.value" placeholder="值" style="width: 80px" size="small" />
                  <UiButton type="link" size="small" danger @click="removeTransformRule(index)">删除</UiButton>
                </div>
                <UiButton type="dashed" block @click="addTransformRule" style="margin-top: 8px">添加转换规则</UiButton>
              </UiForm>
            </UiTabPane>

            <UiTabPane key="preview" tab="测试预览">
              <UiForm layout="vertical">
                <UiFormItem label="输入测试数据">
                  <UiTextarea v-model:value="testData" :rows="6" placeholder="输入原始数据 JSON 或文本..." />
                </UiFormItem>
                <UiFormItem>
                  <UiSpace>
                    <UiButton type="primary" @click="runTest">解析测试</UiButton>
                    <UiButton @click="testData = ''">清空</UiButton>
                  </UiSpace>
                </UiFormItem>
                <UiFormItem label="解析结果">
                  <UiInput v-model:value="testResult" :rows="6" type="textarea" readonly />
                </UiFormItem>
              </UiForm>
            </UiTabPane>
          </UiTabs>

          <div v-else class="empty-config">
            <FileTextOutlined style="font-size: 48px; color: #8ABBDB;" />
            <p>选择左侧协议进行配置</p>
          </div>
        </UiCard>
      </UiCol>
    </UiRow>

    <!-- 添加/编辑弹窗 -->
    <UiModal :visible="modalVisible" :title="isEditing ? '编辑协议' : '新建协议'" @ok="saveProtocol" @cancel="closeModal">
      <UiForm :model="protocolForm" layout="vertical">
        <UiFormItem label="协议名称" required>
          <UiInput v-model:value="protocolForm.configName" placeholder="如: 新一代遥测协议" />
        </UiFormItem>
        <UiFormItem label="协议类型" required>
          <UiSelect v-model:value="protocolForm.protocolType" placeholder="选择协议类型">
            <UiSelectOption value="JSON">JSON</UiSelectOption>
            <UiSelectOption value="BINARY">二进制</UiSelectOption>
            <UiSelectOption value="TEXT">文本</UiSelectOption>
            <UiSelectOption value="PDXP">PDXP</UiSelectOption>
            <UiSelectOption value="Protobuf">Protobuf</UiSelectOption>
          </UiSelect>
        </UiFormItem>
        <UiFormItem label="描述">
          <UiTextarea v-model:value="protocolForm.description" placeholder="协议描述..." :rows="2" />
        </UiFormItem>
      </UiForm>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { protocolConfigApi } from '../api'
import { message } from '../utils/feedback'

const loading = ref(false)
const protocolList = ref([])
const editingProtocol = ref(null)
const modalVisible = ref(false)
const isEditing = ref(false)
const activeTab = ref('fields')
const addFieldType = ref('string')
const validationActive = ref(['ranges'])

const protocolForm = reactive({
  id: null,
  configName: '',
  protocolType: '',
  description: ''
})

const fieldConfigs = ref([])
const parseRulesConfig = reactive({
  dataFormat: 'json',
  encoding: 'utf-8',
  delimiter: ',',
  hasHeader: true,
  headerLen: 4,
  endian: 'little',
  dataStart: 0,
  timeFormat: 'yyyy-MM-dd HH:mm:ss'
})

const validationConfig = reactive({
  enabled: true,
  ranges: {},
  requiredFields: [],
  regexPatterns: {}
})

const transformConfig = reactive({
  enabled: false,
  rules: []
})

const testData = ref('')
const testResult = ref('')

const columns = [
  { title: '协议名称', dataIndex: 'configName' },
  { title: '类型', key: 'type', width: 80 },
  { title: '启用', key: 'enabled', width: 60 },
  { title: '操作', key: 'action', width: 180 }
]

const fieldColumns = [
  { title: '源字段', key: 'sourceField', width: 120 },
  { title: '目标字段', key: 'targetField', width: 120 },
  { title: '中文映射', key: 'mapping', width: 100 },
  { title: '类型', key: 'type', width: 80 },
  { title: '必填', key: 'required', width: 50 },
  { title: '操作', key: 'action', width: 60 }
]

const protocolCount = computed(() => protocolList.value.length)
const enabledCount = computed(() => protocolList.value.filter(p => p.enabled).length)
const jsonCount = computed(() => protocolList.value.filter(p => p.protocolType === 'JSON').length)
const binaryCount = computed(() => protocolList.value.filter(p => p.protocolType === 'BINARY').length)
const configTitle = computed(() => editingProtocol.value ? `配置: ${editingProtocol.value.configName}` : '协议配置')

const getTypeColor = (type) => {
  const colors = { 'JSON': 'green', 'BINARY': 'blue', 'TEXT': 'orange', 'PDXP': 'purple', 'Protobuf': 'cyan' }
  return colors[type] || 'default'
}

const loadProtocols = async () => {
  loading.value = true
  try {
    const res = await protocolConfigApi.getAll()
    protocolList.value = res.data || []
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

const showAddModal = () => {
  isEditing.value = false
  protocolForm.id = null
  protocolForm.configName = ''
  protocolForm.protocolType = 'JSON'
  protocolForm.description = ''
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveProtocol = async () => {
  if (!protocolForm.configName || !protocolForm.protocolType) {
    message.error('请填写完整信息')
    return
  }

  try {
    if (isEditing.value) {
      await protocolConfigApi.update({ ...protocolForm, id: editingProtocol.value.id })
      message.success('协议更新成功')
    } else {
      await protocolConfigApi.add({ ...protocolForm, enabled: true })
      message.success('协议创建成功')
    }
    closeModal()
    loadProtocols()
  } catch (e) { message.error('操作失败') }
}

const editProtocol = (record) => {
  isEditing.value = true
  editingProtocol.value = record
  protocolForm.id = record.id
  protocolForm.configName = record.configName
  protocolForm.protocolType = record.protocolType
  protocolForm.description = record.description

  // 加载配置
  try {
    fieldConfigs.value = record.fieldConfigs ? JSON.parse(record.fieldConfigs) : []
  } catch { fieldConfigs.value = [] }

  try {
    Object.assign(parseRulesConfig, record.parseRules ? JSON.parse(record.parseRules) : {})
  } catch { Object.assign(parseRulesConfig, { dataFormat: 'json', encoding: 'utf-8' }) }

  try {
    Object.assign(validationConfig, record.validationRules ? JSON.parse(record.validationRules) : { enabled: true, ranges: {}, requiredFields: [], regexPatterns: {} })
  } catch { Object.assign(validationConfig, { enabled: true, ranges: {}, requiredFields: [], regexPatterns: {} }) }

  try {
    Object.assign(transformConfig, record.transformRules ? JSON.parse(record.transformRules) : { enabled: false, rules: [] })
  } catch { Object.assign(transformConfig, { enabled: false, rules: [] }) }

  activeTab.value = 'fields'
}

const toggleEnabled = async (record) => {
  try {
    await protocolConfigApi.update({ ...record, enabled: !record.enabled })
    loadProtocols()
  } catch (e) { message.error('操作失败') }
}

const deleteProtocol = async (id) => {
  try {
    await protocolConfigApi.delete(id)
    message.success('删除成功')
    if (editingProtocol.value?.id === id) {
      editingProtocol.value = null
      fieldConfigs.value = []
    }
    loadProtocols()
  } catch (e) { message.error('删除失败') }
}

const testProtocol = (record) => {
  editProtocol(record)
  activeTab.value = 'preview'
}

const addField = () => {
  fieldConfigs.value.push({
    sourceField: '',
    targetField: '',
    mapping: '',
    type: addFieldType.value,
    required: false
  })
}

const removeField = (index) => {
  fieldConfigs.value.splice(index, 1)
}

const addRangeValidation = () => {
  const field = fieldConfigs.value[0]?.targetField || 'field'
  validationConfig.ranges[field] = { min: 0, max: 100 }
}

const addRegexValidation = () => {
  const field = fieldConfigs.value[0]?.targetField || 'field'
  validationConfig.regexPatterns[field] = { pattern: '', message: '格式不正确' }
}

const addTransformRule = () => {
  transformConfig.rules.push({ field: '', type: 'multiply', value: '1' })
}

const removeTransformRule = (index) => {
  transformConfig.rules.splice(index, 1)
}

const saveConfig = async () => {
  if (!editingProtocol.value) return

  try {
    await protocolConfigApi.update({
      id: editingProtocol.value.id,
      configName: editingProtocol.value.configName,
      protocolType: editingProtocol.value.protocolType,
      description: editingProtocol.value.description,
      fieldConfigs: JSON.stringify(fieldConfigs.value),
      parseRules: JSON.stringify(parseRulesConfig),
      validationRules: JSON.stringify(validationConfig),
      transformRules: JSON.stringify(transformConfig),
      enabled: editingProtocol.value.enabled
    })
    message.success('配置保存成功')
    loadProtocols()
  } catch (e) { message.error('保存失败') }
}

const runTest = () => {
  try {
    let result = {}

    if (parseRulesConfig.dataFormat === 'json') {
      result = JSON.parse(testData.value)
    } else if (parseRulesConfig.dataFormat === 'delimited') {
      const lines = testData.value.split('\n')
      const delimiter = parseRulesConfig.delimiter
      const hasHeader = parseRulesConfig.hasHeader
      const startIdx = hasHeader ? 1 : 0
      const headers = hasHeader ? lines[0].split(delimiter) : fieldConfigs.value.map((f, i) => f.targetField || `field${i}`)

      result = lines.slice(startIdx).map(line => {
        const values = line.split(delimiter)
        const obj = {}
        fieldConfigs.value.forEach((field, i) => {
          if (values[i] !== undefined) {
            obj[field.targetField || field.sourceField] = field.type === 'number' ? parseFloat(values[i]) : values[i]
          }
        })
        return obj
      })
    }

    testResult.value = JSON.stringify(result, null, 2)
  } catch (e) {
    testResult.value = '解析错误: ' + e.message
  }
}

const testConfig = () => {
  activeTab.value = 'preview'
}

onMounted(() => {
  loadProtocols()
})
</script>

<style scoped>
.stats-row { margin-bottom: 16px; }
.stat-card, .data-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 4px !important;
}
.field-config-container { max-height: 400px; overflow-y: auto; }
.field-toolbar { margin-bottom: 12px; display: flex; align-items: center; }
.range-item, .regex-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.transform-rule { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.empty-config {
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.5);
}
</style>
