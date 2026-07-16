<template>
  <div class="log">
    <UiCard title="筛选条件" class="filter-card">
      <UiForm layout="vertical" class="log-filter-form">
        <div class="log-filter-grid">
          <UiFormItem label="级别">
            <UiSelect v-model:value="filters.level" placeholder="全部级别">
              <UiSelectOption value="">全部级别</UiSelectOption>
              <UiSelectOption v-for="lvl in levelOptions" :key="lvl.value" :value="lvl.value">{{ lvl.label }}</UiSelectOption>
            </UiSelect>
          </UiFormItem>
          <UiFormItem label="来源">
            <UiSelect v-model:value="filters.source" placeholder="全部来源">
              <UiSelectOption value="">全部来源</UiSelectOption>
              <UiSelectOption v-for="src in sourceOptions" :key="src" :value="src">{{ src }}</UiSelectOption>
            </UiSelect>
          </UiFormItem>
          <UiFormItem label="操作人">
            <UiInput v-model:value="filters.operator" placeholder="输入操作人" />
          </UiFormItem>
          <UiFormItem label="起始时间">
            <UiInput v-model:value="filters.startTime" type="datetime-local" step="1" />
          </UiFormItem>
          <UiFormItem label="结束时间">
            <UiInput v-model:value="filters.endTime" type="datetime-local" step="1" />
          </UiFormItem>
          <UiFormItem label="关键字">
            <UiInput v-model:value="filters.keyword" placeholder="搜索消息 / 详情" @keyup.enter="applyFilters" />
          </UiFormItem>
          <div class="log-filter-actions">
            <UiButton type="primary" :loading="loading" @click="applyFilters">搜索</UiButton>
            <UiButton @click="resetFilters">重置</UiButton>
          </div>
        </div>
      </UiForm>
    </UiCard>

    <UiCard title="日志列表" class="data-card">
      <template #extra>
        <span class="log-count">共 {{ filteredLogs.length }} 条</span>
      </template>
      <UiTable :columns="columns" :data-source="filteredLogs" :loading="loading" :pagination="{ pageSize: 10 }" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'level'">
            <UiTag :color="getLevelColor(record.level)">{{ getLevelText(record.level) }}</UiTag>
          </template>
          <template v-if="column.key === 'action'">
            <UiButton type="link" size="small" @click="viewDetail(record)">详情</UiButton>
          </template>
        </template>
      </UiTable>
    </UiCard>

    <!-- 日志详情弹窗 -->
    <UiModal :visible="detailVisible" title="日志详情" width="600px" @cancel="detailVisible = false">
      <UiDescriptions :column="1" bordered size="small">
        <UiDescriptionsItem label="时间">{{ currentLog.timeText }}</UiDescriptionsItem>
        <UiDescriptionsItem label="级别">
          <UiTag :color="getLevelColor(currentLog.level)">{{ getLevelText(currentLog.level) }}</UiTag>
        </UiDescriptionsItem>
        <UiDescriptionsItem label="来源">{{ currentLog.source || currentLog.module || '-' }}</UiDescriptionsItem>
        <UiDescriptionsItem label="操作人">{{ currentLog.username || '-' }}</UiDescriptionsItem>
        <UiDescriptionsItem label="内容">{{ currentLog.message || currentLog.operation || '-' }}</UiDescriptionsItem>
        <UiDescriptionsItem label="详情">{{ currentLog.detail || currentLog.details || '-' }}</UiDescriptionsItem>
      </UiDescriptions>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { logApi } from '../api'

const loading = ref(false)
const detailVisible = ref(false)
const currentLog = ref({})

const logs = ref([])

const filters = reactive({
  level: '',
  source: '',
  operator: '',
  startTime: '',
  endTime: '',
  keyword: ''
})

const levelOptions = [
  { label: '信息', value: 'INFO' },
  { label: '警告', value: 'WARN' },
  { label: '错误', value: 'ERROR' },
  { label: '调试', value: 'DEBUG' }
]

const sourceOptions = computed(() => {
  const set = new Set()
  logs.value.forEach(l => {
    const src = l.source || l.module
    if (src) set.add(src)
  })
  return Array.from(set).sort()
})

const columns = [
  { title: '时间', dataIndex: 'timeText', width: 170 },
  { title: '级别', key: 'level', width: 80 },
  { title: '来源', dataIndex: 'sourceText', width: 140 },
  { title: '操作人', dataIndex: 'username', width: 100 },
  { title: '内容', dataIndex: 'messageText', ellipsis: true },
  { title: '详情', dataIndex: 'detailText', ellipsis: true },
  { title: '操作', key: 'action', width: 80 }
]

const getLevelColor = (level) => {
  return { INFO: 'blue', WARN: 'orange', ERROR: 'red', DEBUG: 'default' }[level] || 'default'
}

const getLevelText = (level) => {
  return { INFO: '信息', WARN: '警告', WARNING: '警告', ERROR: '错误', DEBUG: '调试' }[String(level || '').toUpperCase()] || level || '-'
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').replace('Z', '')
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const enrichLog = (log) => {
  const time = log.timestamp || log.logTime || log.operationTime
  return {
    ...log,
    timeText: formatDateTime(time),
    sourceText: log.source || log.module || '-',
    messageText: log.message || log.operation || '-',
    detailText: log.detail || log.details || '-',
  }
}

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (filters.level && (log.level || log.logLevel) !== filters.level) return false
    if (filters.source) {
      const src = log.source || log.module
      if (src !== filters.source) return false
    }
    if (filters.operator) {
      const op = (log.username || log.operator || '').toLowerCase()
      if (!op.includes(filters.operator.toLowerCase())) return false
    }
    if (filters.keyword) {
      const text = filters.keyword.toLowerCase()
      const haystack = `${log.message || ''} ${log.detail || ''} ${log.operation || ''} ${log.details || ''}`.toLowerCase()
      if (!haystack.includes(text)) return false
    }
    if (filters.startTime || filters.endTime) {
      const raw = log.timestamp || log.logTime || log.operationTime
      const ts = raw ? new Date(raw).getTime() : NaN
      if (!Number.isFinite(ts)) return false
      if (filters.startTime && ts < new Date(filters.startTime).getTime()) return false
      if (filters.endTime && ts > new Date(filters.endTime).getTime()) return false
    }
    return true
  })
})

const loadLogs = async () => {
  loading.value = true
  try {
    const res = await logApi.getList(200)
    const data = res.data?.data || res.data || []
    logs.value = (Array.isArray(data) ? data : []).map(enrichLog)
  } catch (error) {
    console.error('Failed to load logs:', error)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  loadLogs()
}

const resetFilters = () => {
  filters.level = ''
  filters.source = ''
  filters.operator = ''
  filters.startTime = ''
  filters.endTime = ''
  filters.keyword = ''
  loadLogs()
}

const viewDetail = (record) => {
  currentLog.value = record
  detailVisible.value = true
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.filter-card,
.data-card {
  margin-bottom: 16px;
  background: var(--block-bg) !important;
  border: 0 !important;
  border-radius: var(--ui-radius) !important;
  box-shadow: 0 0 0 1px var(--block-ring), var(--block-shadow) !important;
}

.log-filter-form {
  width: 100%;
}

.log-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 16px;
  align-items: end;
}

.log-filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
}

.log-count {
  color: var(--ui-text-muted);
  font-size: 12px;
}

@media (max-width: 1280px) {
  .log-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .log-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .log-filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
