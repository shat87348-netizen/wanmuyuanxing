import { http } from './http'
import { taskApi } from './task'
import { agentRegistryApi } from './agentRegistry'
import { parseModelApi } from './parseModel'
import { mockOrFallback } from './legacyMockBridge'
import { getRuntimeConfig, isMockEnabled } from '../config/runtime'

const warnedLegacyApis = new Set()
const legacyWarn = (name) => {
  if (warnedLegacyApis.has(name)) return
  warnedLegacyApis.add(name)
  console.warn('[legacy-adapter]', name, '在新后端无对应实现')
}
const ok = (data) => Promise.resolve({ data })
const currentTaskId = () => Number(localStorage.getItem('currentTaskId')) || 1

// ── 内部辅助 ────────────────────────────────────────────────────────────────

const unsupported = (name) => {
  legacyWarn(name)
  const err = new Error(`${name} 在当前后端暂未提供`)
  err.code = 'ERR_UNSUPPORTED_API'
  return Promise.reject(err)
}

const sameId = (a, b) => String(a) === String(b)

const asArray = (value) => {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.items)) return value.items
  if (value && Array.isArray(value.rules)) return value.rules
  if (value && Array.isArray(value.data)) return value.data
  if (value && Array.isArray(value.content)) return value.content
  return []
}

const apiUrl = (path) => {
  const base = getRuntimeConfig().apiBaseUrl || '/api'
  return `${base.replace(/\/$/, '')}${path}`
}

const _getParseModel = () =>
  parseModelApi.get(currentTaskId()).then(p => p || {}).catch(() => ({}))

const _parseJson = (str, fallback) => {
  try { return str ? JSON.parse(str) : fallback }
  catch { return fallback }
}

const _stringifyJson = (value) => JSON.stringify(value ?? null)

const _nextId = (list) => {
  const maxId = list.reduce((max, item) => {
    const id = Number(item?.id)
    return Number.isFinite(id) ? Math.max(max, id) : max
  }, 0)
  return maxId > 0 ? maxId + 1 : Date.now()
}

const _toTransportProtocol = (protocol) => {
  const raw = String(protocol || '').toUpperCase()
  if (raw.includes('UDP')) return 'UDP'
  if (raw.includes('TCP') || raw.includes('FEP')) return 'TCP'
  if (raw.includes('HTTP')) return 'HTTP'
  return protocol || '-'
}

const _toInterfaceStatus = (state) => {
  const raw = String(state || '').toUpperCase()
  if (['RUNNING', 'ONLINE', 'ACTIVE'].includes(raw)) return '在线'
  if (['ERROR', 'BLOCKED', 'FAILED'].includes(raw)) return '异常'
  return '离线'
}

const _mapInstances = (agents = []) =>
  agents.flatMap((agent, agentIndex) => (agent.instances || []).map((instance, instanceIndex) => {
    const rawProtocol = instance.protocol || instance.name || instance.type || '-'
    const id = instance.interfaceInstanceId ?? instance.id ?? `${agent.agentId || agentIndex}-${instanceIndex}`
    const status = _toInterfaceStatus(instance.state || instance.status)
    const rxRate = instance.rxRate ?? instance.rate ?? instance.currentRate ?? 0
    return {
      id,
      interfaceInstanceId: id,
      interfaceName: `${agent.agentId || 'Agent'}/${rawProtocol}`,
      interfaceType: agent.deployForm === 'embedded' ? 'INTERNAL' : 'EXTERNAL',
      sender: agent.agentId || '-',
      messageType: '遥测数据',
      protocol: _toTransportProtocol(rawProtocol),
      transportProtocol: rawProtocol,
      protocolConfigId: null,
      host: agent.host || agent.ipAddress || agent.ip || '-',
      port: agent.controlPort || agent.port || '-',
      status,
      enabled: status === '在线',
      bandwidth: instance.rateLimit ?? instance.bandwidthLimit ?? null,
      flowRate: instance.rxBytesRate ?? instance.byteRate ?? rxRate,
      totalFlow: instance.rxBytes ?? 0,
      packetCount: instance.rxMessages ?? 0,
      rxBytes: instance.rxBytes ?? 0,
      rxMessages: instance.rxMessages ?? 0,
      rxRate,
      errorCount: instance.errorCount ?? 0,
      lastError: instance.lastError,
      lastHeartbeat: agent.lastHeartbeat,
      createTime: agent.firstSeen,
      updateTime: agent.lastHeartbeat,
      remark: instance.lastError || '',
      agentId: agent.agentId,
      raw: { agent, instance },
    }
  }))

const _normalizeInterfaceRow = (row = {}) => ({
  ...row,
  id: row.id ?? row.interfaceInstanceId,
  interfaceName: row.interfaceName || row.name || `${row.sender || '采集接口'}-${row.protocol || ''}`,
  interfaceType: row.interfaceType || 'INTERNAL',
  protocol: row.protocol || _toTransportProtocol(row.transportProtocol),
  transportProtocol: row.transportProtocol || row.protocol,
  host: row.host || '-',
  port: row.port || '-',
  status: row.status || (row.enabled === false ? '离线' : '在线'),
  enabled: row.enabled !== false,
  flowRate: row.flowRate ?? row.rxRate ?? 0,
  totalFlow: row.totalFlow ?? row.rxBytes ?? 0,
  packetCount: row.packetCount ?? row.rxMessages ?? 0,
  bandwidth: row.bandwidth ?? null,
})

const _loadDbInterfaces = () =>
  _fetchApiJson('/interface/list').then(rows => asArray(rows).map(_normalizeInterfaceRow))

const _loadInterfaces = () => {
  if (isMockEnabled()) return agentRegistryApi.list().then(agents => _mapInstances(agents)).catch(() => [])
  return _loadDbInterfaces().then(rows => {
    if (rows.length > 0) return rows
    return agentRegistryApi.list().then(agents => _mapInstances(agents)).catch(() => [])
  }).catch(() => agentRegistryApi.list().then(agents => _mapInstances(agents)).catch(() => []))
}

const _interfaceStats = (rows) => ({
  total: rows.length,
  online: rows.filter(i => i.status === '在线').length,
  offline: rows.filter(i => i.status === '离线').length,
  error: rows.filter(i => i.status === '异常').length,
  todayCount: rows.reduce((sum, i) => sum + Number(i.packetCount || 0), 0),
})

const _makeInterfaceEventsFromRows = (rows = [], limit = 50) => rows
  .filter(i => i.lastError || Number(i.errorCount || 0) > 0 || i.status === '异常')
  .slice(0, limit)
  .map((i, index) => ({
    id: `${i.id}-${index}`,
    interfaceId: i.id,
    interfaceName: i.interfaceName,
    protocol: i.transportProtocol || i.protocol,
    severity: i.status === '异常' ? 'ERROR' : 'WARNING',
    message: i.lastError || `近 1 分钟异常 ${i.errorCount || 0} 次`,
    eventTime: i.lastHeartbeat || i.updateTime || new Date().toISOString(),
  }))

const _makeInterfaceEventStatsFromRows = (rows = []) => {
  const warning = rows.filter(i => Number(i.errorCount || 0) > 0 && i.status !== '异常').length
  const error = rows.filter(i => i.status === '异常').length
  return { info: 0, warning, error, critical: 0 }
}

const _getProtocolState = () => _getParseModel().then(pkg => {
  const base = _parseJson(pkg.parseModelJson, {})
  return { pkg, base, protocols: asArray(base.protocols) }
})

const _saveProtocols = (pkg, base, protocols, result) => {
  const updated = { ...pkg, parseModelJson: _stringifyJson({ ...base, protocols }) }
  return parseModelApi.save(currentTaskId(), updated).then(() => ok(result ?? protocols))
}

const _normalizeTask = (task = {}) => ({
  ...task,
  taskName: task.taskName || task.name || '',
  source: task.source || task.model || '',
  progress: task.progress ?? (task.active ? 100 : 0),
  status: task.status || (task.active ? '运行中' : '等待中'),
  processedCount: task.processedCount ?? 0,
  createTime: task.createTime || task.createdAt,
  updateTime: task.updateTime || task.updatedAt,
  canStop: false,
})

const _toBusinessTask = (task = {}) => ({
  name: task.name || task.taskName || '',
  model: task.model || task.source || '',
  description: task.description || task.remark || task.source || '',
  active: task.active ?? task.status === '运行中',
})

const _valueFrom = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const _fetchApiJson = async (path, params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  const url = apiUrl(`${path}${query.toString() ? `?${query}` : ''}`)
  const headers = {}
  const taskId = localStorage.getItem('currentTaskId')
  if (taskId) headers['X-Task-Id'] = taskId
  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const demoTelemetryDefs = [
  { code: 'T001', name: '温度', unit: '°C', type: '遥测', range: [20, 85] },
  { code: 'V001', name: '电压', unit: 'V', type: '遥测', range: [22, 32] },
  { code: 'C001', name: '电流', unit: 'A', type: '遥测', range: [0.5, 12] },
  { code: 'P001', name: '功率', unit: 'W', type: '遥测', range: [10, 200] },
  { code: 'A001', name: '姿态角X', unit: '°', type: '姿态', range: [-180, 180] },
  { code: 'A002', name: '姿态角Y', unit: '°', type: '姿态', range: [-90, 90] },
  { code: 'S001', name: '信号强度', unit: 'dBm', type: '通信', range: [-120, -30] },
  { code: 'R001', name: '下行速率', unit: 'Mbps', type: '通信', range: [0.5, 100] },
  { code: 'M001', name: '存储容量', unit: '%', type: '设备', range: [50, 98] },
  { code: 'B001', name: '电池温度', unit: '°C', type: '设备', range: [15, 55] },
  { code: 'CPU01', name: 'CPU温度', unit: '°C', type: '设备', range: [30, 75] },
  { code: 'H001', name: '湿度', unit: '%', type: '环境', range: [20, 90] },
]

let demoTelemetryCache = null

const _randRange = ([min, max]) => +(min + Math.random() * (max - min)).toFixed(2)

const _makeDemoTelemetry = (sampleCount = 50) => {
  const satellites = ['SAT-001', 'SAT-002', 'SAT-003', 'SAT-004']
  const channels = ['CH-A', 'CH-B', 'CH-C']
  const baseTime = Date.now() - sampleCount * 2000
  const rows = []
  for (let i = 0; i < sampleCount; i += 1) {
    const satelliteId = satellites[i % satellites.length]
    const channel = channels[i % channels.length]
    demoTelemetryDefs.forEach(def => {
      rows.push({
        id: `demo-${satelliteId}-${def.code}-${i}`,
        satelliteId,
        channel,
        telemetryCode: def.code,
        paramCode: def.code,
        paramName: def.name,
        paramType: def.type,
        paramValue: _randRange(def.range),
        unit: def.unit,
        status: Math.random() > 0.94 ? '异常' : '正常',
        timestamp: new Date(baseTime + i * 2000).toISOString(),
        collectTime: new Date(baseTime + i * 2000).toISOString(),
        sourceInterface: channel,
        generated: true,
      })
    })
  }
  return rows
}

const _demoTelemetry = () => {
  if (!demoTelemetryCache) demoTelemetryCache = _makeDemoTelemetry()
  return demoTelemetryCache
}

const _normalizeTelemetry = (item = {}, index = 0) => {
  const collectTime = _valueFrom(item, ['collectTime', 'timestamp', 'time', 'createdAt', 'processTime'])
  const timestamp = collectTime ? new Date(collectTime).toISOString() : new Date(Date.now() - index * 1000).toISOString()
  const paramName = _valueFrom(item, ['paramName', 'name', 'telemetryName']) || '-'
  const telemetryCode = _valueFrom(item, ['telemetryCode', 'paramCode', 'code', 'tmCode']) || paramName
  const paramValue = _valueFrom(item, ['paramValue', 'value', 'telemetryValue']) ?? '-'
  return {
    ...item,
    id: _valueFrom(item, ['id', 'key']) || `${telemetryCode}-${timestamp}-${index}`,
    satelliteId: _valueFrom(item, ['satelliteId', 'satellite_id']) || '-',
    channel: _valueFrom(item, ['channel', 'channelName', 'sourceInterface', 'interfaceInstanceId', 'protocol']) || '默认通道',
    telemetryCode,
    paramCode: _valueFrom(item, ['paramCode', 'code', 'tmCode']) || telemetryCode,
    paramName,
    paramType: _valueFrom(item, ['paramType', 'type', 'dataType']) || '遥测',
    paramValue,
    unit: _valueFrom(item, ['unit', 'paramUnit']) || '',
    status: _valueFrom(item, ['status', 'state']) || '正常',
    timestamp,
    collectTime: timestamp,
    sourceInterface: _valueFrom(item, ['sourceInterface', 'channelName', 'channel']) || '默认通道',
  }
}

const _normalizeTelemetryList = (rows = []) => asArray(rows).map(_normalizeTelemetry)

const _telemetryStats = (rows = []) => ({
  total_count: rows.length,
  totalCount: rows.length,
  realtime_count: rows.slice(-100).length,
  realtimeCount: rows.slice(-100).length,
  normalCount: rows.filter(row => row.status === '正常').length,
  abnormalCount: rows.filter(row => row.status !== '正常').length,
  generated: rows.some(row => row.generated),
})

const _loadMockTelemetry = async () => _normalizeTelemetryList(await mockOrFallback('telemetry.recent', [], 'telemetryApi.getRecent', legacyWarn))

const _loadRealTelemetry = async (limit = 500) => {
  const payload = await _fetchApiJson('/telemetry/recent', { limit })
  return _normalizeTelemetryList(payload)
}

const _loadTelemetryRows = async (limit = 500) => {
  if (isMockEnabled()) {
    const rows = await _loadMockTelemetry()
    return rows.length > 0 ? rows.slice(0, limit) : _demoTelemetry().slice(0, limit)
  }
  const rows = await _loadRealTelemetry(limit)
  return rows.length > 0 ? rows.slice(0, limit) : _demoTelemetry().slice(0, limit)
}

// ── 遥测数据 API ─────────────────────────────────────────────────────────────
export const telemetryApi = {
  getRecent:      (limit = 50) => _loadTelemetryRows(limit).then(rows => ok(rows.slice(0, limit))),
  getBySatellite: (satelliteId, limit = 20) => _loadTelemetryRows(500)
    .then(rows => ok(rows.filter(item => item.satelliteId === satelliteId).slice(0, limit))),
  query:          (params = {}) => {
    const query = { ...params, params: Array.isArray(params.params) ? params.params.join(',') : params.params, limit: params.limit || 1000 }
    if (isMockEnabled()) return _loadTelemetryRows(query.limit).then(rows => ok(rows))
    return _fetchApiJson('/telemetry/query', query).then(rows =>
      rows === null ? _loadTelemetryRows(query.limit).then(fallback => ok(fallback)) : ok(_normalizeTelemetryList(rows))
    )
  },
  getStats:       () => isMockEnabled()
    ? mockOrFallback('telemetry.stats', _telemetryStats(_demoTelemetry()), 'telemetryApi.getStats', legacyWarn).then(d => ok(d))
    : _fetchApiJson('/telemetry/stats').then(stats => stats ? ok(stats) : _loadTelemetryRows(500).then(rows => ok(_telemetryStats(rows)))),
}

// ── 采集接口 API ─────────────────────────────────────────────────────────────
export const interfaceApi = {
  getAll:       () => _loadInterfaces().then(rows => ok(rows)),
  getEnabled:   () => _loadInterfaces().then(rows => ok(rows.filter(i => i.enabled))),
  getByType:    (type) => _loadInterfaces().then(rows => ok(rows.filter(i => i.interfaceType === type))),
  getById:      (id) => _loadInterfaces().then(rows => ok(rows.find(i => sameId(i.id, id)) || {})),
  add:          (data) => isMockEnabled() ? unsupported('interfaceApi.add') : http.post('/interface', data).then(d => ok(d)),
  update:       (data) => isMockEnabled() ? unsupported('interfaceApi.update') : http.put('/interface', data).then(d => ok(d)),
  delete:       (id) => isMockEnabled() ? unsupported('interfaceApi.delete') : http.delete(`/interface/${id}`).then(d => ok(d)),
  updateStatus: () => unsupported('interfaceApi.updateStatus'),
  setEnabled:   (id, enabled) => isMockEnabled() ? unsupported('interfaceApi.setEnabled') : http.put(`/interface/${id}/enabled`, null, { params: { enabled } }).then(d => ok(d)),
  setBandwidth: (id, bandwidth) => isMockEnabled() ? unsupported('interfaceApi.setBandwidth') : http.put(`/interface/${id}/bandwidth`, null, { params: { bandwidth } }).then(d => ok(d)),
  getStats:     () => _loadInterfaces().then(rows => ok(_interfaceStats(rows))),
  getGrouped:   () => _loadInterfaces().then(rows => ok(rows.reduce((grouped, item) => {
    const protocol = item.protocol || '-'
    grouped[protocol] = grouped[protocol] || []
    grouped[protocol].push(item)
    return grouped
  }, {}))),
}

// ── 采集通道 API ─────────────────────────────────────────────────────────────
export const channelApi = {
  getAll:        () => _loadInterfaces().then(rows => ok(rows)),
  getByProtocol: (protocol) => _loadInterfaces().then(rows => ok(rows.filter(i => i.protocol === protocol || i.transportProtocol === protocol))),
  getById:       (id) => _loadInterfaces().then(rows => ok(rows.find(i => sameId(i.id, id)) || {})),
  add:           () => unsupported('channelApi.add'),
  update:        () => unsupported('channelApi.update'),
  delete:        () => unsupported('channelApi.delete'),
  setEnabled:    () => unsupported('channelApi.setEnabled'),
  getStats:      () => _loadInterfaces().then(rows => ok(_interfaceStats(rows))),
}

// ── 接口事件 API ─────────────────────────────────────────────────────────────
export const interfaceEventApi = {
  getRecent:      (limit = 50) => isMockEnabled()
    ? _loadInterfaces().then(rows => ok(_makeInterfaceEventsFromRows(rows, limit)))
    : _fetchApiJson('/interface-event/recent', { limit }).then(rows =>
      rows === null ? _loadInterfaces().then(fallback => ok(_makeInterfaceEventsFromRows(fallback, limit))) : ok(asArray(rows))
    ),
  getByInterface: (interfaceId) => interfaceEventApi.getRecent(100).then(res => ok((res.data || []).filter(e => sameId(e.interfaceId, interfaceId)))),
  getStats:       () => isMockEnabled()
    ? _loadInterfaces().then(rows => ok(_makeInterfaceEventStatsFromRows(rows)))
    : _fetchApiJson('/interface-event/stats').then(stats =>
      stats === null ? _loadInterfaces().then(rows => ok(_makeInterfaceEventStatsFromRows(rows))) : ok(stats)
    ),
}

// ── 协议配置 API ─────────────────────────────────────────────────────────────
export const protocolConfigApi = {
  getAll: () => isMockEnabled()
    ? _getProtocolState().then(({ protocols }) => ok(protocols))
    : http.get('/protocol-config/list').then(d => ok(asArray(d))).catch(() => _getProtocolState().then(({ protocols }) => ok(protocols))),
  getByType: (type) => isMockEnabled()
    ? _getProtocolState().then(({ protocols }) => ok(protocols.filter(p => p.protocolType === type || p.type === type)))
    : http.get(`/protocol-config/list/${type}`).then(d => ok(asArray(d))).catch(() => _getProtocolState().then(({ protocols }) => ok(protocols.filter(p => p.protocolType === type || p.type === type)))),
  getById:   (id) => isMockEnabled()
    ? _getProtocolState().then(({ protocols }) => ok(protocols.find(p => sameId(p.id, id)) || {}))
    : http.get(`/protocol-config/${id}`).then(d => ok(d || {})),
  add:       (data) => isMockEnabled() ? _getProtocolState().then(({ pkg, base, protocols }) => {
    const item = { ...data, id: data.id ?? _nextId(protocols), enabled: data.enabled ?? true }
    return _saveProtocols(pkg, base, [...protocols, item], item)
  }).catch(() => ok({})) : http.post('/protocol-config', data).then(d => ok(d)),
  update:    (data) => isMockEnabled() ? _getProtocolState().then(({ pkg, base, protocols }) => {
    const exists = protocols.some(pr => sameId(pr.id, data.id))
    const item = { ...data, id: data.id ?? _nextId(protocols) }
    const next = exists
      ? protocols.map(pr => sameId(pr.id, item.id) ? { ...pr, ...item } : pr)
      : [...protocols, { ...item, enabled: item.enabled ?? true }]
    return _saveProtocols(pkg, base, next, item)
  }).catch(() => ok({})) : http.put('/protocol-config', data).then(d => ok(d)),
  delete: (id) => isMockEnabled() ? _getProtocolState().then(({ pkg, base, protocols }) =>
    _saveProtocols(pkg, base, protocols.filter(pr => !sameId(pr.id, id)), { ok: true })
  ).catch(() => ok({})) : http.delete(`/protocol-config/${id}`).then(d => ok(d)),
}

// ── 告警 API ─────────────────────────────────────────────────────────────────
export const alarmApi = {
  getList: (limit = 50) => isMockEnabled()
    ? mockOrFallback('alarm.list', [], 'alarmApi.getList', legacyWarn).then(d => ok(d))
    : _fetchApiJson('/alarm/recent', { limit }).then(d => ok(asArray(d))),
  add:     () => unsupported('alarmApi.add'),
  getStats:() => isMockEnabled()
    ? mockOrFallback('alarm.stats', { total: 0, critical: 0, major: 0, minor: 0, warning: 0, info: 0 }, 'alarmApi.getStats', legacyWarn).then(d => ok(d))
    : _fetchApiJson('/alarm/stats').then(d => ok(d || { total: 0, critical: 0, major: 0, minor: 0, warning: 0, info: 0 })),
  handle:  (id) => isMockEnabled() ? unsupported('alarmApi.handle') : http.put(`/alarm/${id}/handle`).then(d => ok(d)),
  delete:  () => unsupported('alarmApi.delete'),
}

// ── 系统日志 API ─────────────────────────────────────────────────────────────
export const logApi = {
  getList: (limit = 50) => isMockEnabled()
    ? mockOrFallback('log.list', [], 'logApi.getList', legacyWarn).then(d => ok(d))
    : _fetchApiJson('/log/list', { limit }).then(rows =>
      rows === null ? mockOrFallback('log.list', [], 'logApi.getList', legacyWarn).then(d => ok(d)) : ok(asArray(rows))
    ),
  getStats:() => isMockEnabled()
    ? mockOrFallback('log.stats', {}, 'logApi.getStats', legacyWarn).then(d => ok(d))
    : _fetchApiJson('/log/stats').then(stats =>
      stats === null ? mockOrFallback('log.stats', {}, 'logApi.getStats', legacyWarn).then(d => ok(d)) : ok(stats)
    ),
  add:     () => unsupported('logApi.add'),
}

// ── 用户 API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (username, password) => http.post('/auth/login', { username, password }).then(d => ok(d)),
  me:     () => http.get('/auth/me').then(d => ok(d)),
  logout: () => http.post('/auth/logout').then(d => ok(d)).catch(() => ok({})),
}

export const userApi = {
  getList: () => mockOrFallback('user.list', [], 'userApi.getList', legacyWarn).then(d => ok(d)),
  getById: (id) => ok({ id: 1, username: 'admin', role: 'ADMIN' }),
  add:     () => unsupported('userApi.add'),
  update:  () => unsupported('userApi.update'),
  delete:  () => unsupported('userApi.delete'),
  login:   (username, password) => isMockEnabled()
    ? ok({ token: 'mock', user: { id: 1, username: 'admin', realName: '系统管理员', role: 'ADMIN' } })
    : authApi.login(username, password),
}

// ── 系统配置 API ─────────────────────────────────────────────────────────────
export const configApi = {
  getList:  () => mockOrFallback('config.list', [], 'configApi.getList', legacyWarn).then(d => ok(d)),
  getById:  (id) => { legacyWarn('configApi.getById'); return ok({}) },
  getByType:(type) => { legacyWarn('configApi.getByType'); return ok([]) },
  getByKey: (key) => { legacyWarn('configApi.getByKey'); return ok({}) },
  add:      () => unsupported('configApi.add'),
  update:   () => unsupported('configApi.update'),
  delete:   () => unsupported('configApi.delete'),
}

// ── 数据处理任务 API ──────────────────────────────────────────────────────────
export const processTaskApi = {
  getAll:  () => taskApi.list()
    .then(list => ok(asArray(list).map(_normalizeTask)))
    .catch(() => mockOrFallback('processTask.list', [], 'processTaskApi.getAll', legacyWarn).then(d => ok(d))),
  getById: (id) => taskApi.get(id).then(d => ok(_normalizeTask(d))).catch(() => ok({})),
  add:     (data) => taskApi.create(_toBusinessTask(data)).then(d => ok(_normalizeTask(d))).catch(() => ok({})),
  update:  (data) => taskApi.update(data.id, _toBusinessTask(data)).then(d => ok(_normalizeTask(d))).catch(() => ok({})),
  delete:  (id) => taskApi.remove(id).then(d => ok(d)).catch(() => ok({})),
  start:   (id) => taskApi.activate(id).then(d => ok(d)).catch(() => ok({})),
  stop:    () => unsupported('processTaskApi.stop'),
  getStats:() => taskApi.list()
    .then(list => ok({ total: asArray(list).length, running: asArray(list).filter(t => t.active).length }))
    .catch(() => mockOrFallback('processTask.stats', { total: 0, running: 0 }, 'processTaskApi.getStats', legacyWarn).then(d => ok(d))),
}

// ── 数据处理规则 API ──────────────────────────────────────────────────────────
const _getAlarmRuleState = () => _getParseModel().then(pkg => {
  const parsed = _parseJson(pkg.alarmRulesJson, [])
  return { pkg, parsed, rules: asArray(parsed) }
})

const _saveAlarmRules = (pkg, parsed, rules, result) => {
  const payload = Array.isArray(parsed) ? rules : { ...(parsed || {}), rules }
  const updated = { ...pkg, alarmRulesJson: _stringifyJson(payload) }
  return parseModelApi.save(currentTaskId(), updated).then(() => ok(result ?? rules))
}

export const processRuleApi = {
  getAll:    () => _getAlarmRuleState().then(({ rules }) => ok(rules)),
  getById:   (id) => _getAlarmRuleState().then(({ rules }) => ok(rules.find(r => sameId(r.id, id)) || {})),
  add:       (data) => _getAlarmRuleState().then(({ pkg, parsed, rules }) => {
    const item = { ...data, id: data.id ?? _nextId(rules), enabled: data.enabled ?? true }
    return _saveAlarmRules(pkg, parsed, [...rules, item], item)
  }).catch(() => ok({})),
  update:    (data) => _getAlarmRuleState().then(({ pkg, parsed, rules }) => {
    const exists = rules.some(rule => sameId(rule.id, data.id))
    const item = { ...data, id: data.id ?? _nextId(rules) }
    const next = exists
      ? rules.map(rule => sameId(rule.id, item.id) ? { ...rule, ...item } : rule)
      : [...rules, { ...item, enabled: item.enabled ?? true }]
    return _saveAlarmRules(pkg, parsed, next, item)
  }).catch(() => ok({})),
  delete:    (id) => _getAlarmRuleState().then(({ pkg, parsed, rules }) =>
    _saveAlarmRules(pkg, parsed, rules.filter(rule => !sameId(rule.id, id)), { ok: true })
  ).catch(() => ok({})),
  setEnabled:(id, enabled) => _getAlarmRuleState().then(({ pkg, parsed, rules }) =>
    _saveAlarmRules(pkg, parsed, rules.map(rule => sameId(rule.id, id) ? { ...rule, enabled } : rule), { ok: true })
  ).catch(() => ok({})),
}

// ── 数据处理日志 API ──────────────────────────────────────────────────────────
export const processLogApi = {
  getRecent: (limit = 50) => mockOrFallback('processLog.recent', [], 'processLogApi.getRecent', legacyWarn).then(d => ok(d)),
  getStats:  () => mockOrFallback('processLog.stats', {}, 'processLogApi.getStats', legacyWarn).then(d => ok(d)),
}

// ── 处理后遥测数据 API ────────────────────────────────────────────────────────
export const processedTelemetryApi = {
  getRecent: (limit = 50) => mockOrFallback('processedTelemetry.recent', [], 'processedTelemetryApi.getRecent', legacyWarn).then(d => ok(d)),
  getStats:  () => mockOrFallback('processedTelemetry.stats', {}, 'processedTelemetryApi.getStats', legacyWarn).then(d => ok(d)),
  getMonitor:() => mockOrFallback('processedTelemetry.monitor', [], 'processedTelemetryApi.getMonitor', legacyWarn).then(d => ok(d)),
}

// ── 校准通道 API ─────────────────────────────────────────────────────────────
export const calibrationChannelApi = {
  getAll:  () => mockOrFallback('calibration.channelList', [], 'calibrationChannelApi.getAll', legacyWarn).then(d => ok(d)),
  getById: (id) => { legacyWarn('calibrationChannelApi.getById'); return ok({}) },
  add:     () => unsupported('calibrationChannelApi.add'),
  update:  () => unsupported('calibrationChannelApi.update'),
  delete:  () => unsupported('calibrationChannelApi.delete'),
  getStats:() => mockOrFallback('calibration.channelStats', {}, 'calibrationChannelApi.getStats', legacyWarn).then(d => ok(d)),
}

// ── 校准配置 API ─────────────────────────────────────────────────────────────
export const calibrationConfigApi = {
  get: () => _getParseModel()
    .then(p => ok(_parseJson(p.calConfigJson, {}))),
  update: (data) => _getParseModel().then(p => {
    const updated = { ...p, calConfigJson: JSON.stringify(data) }
    return parseModelApi.save(currentTaskId(), updated).then(d => ok(d)).catch(() => ok({}))
  }).catch(() => ok({})),
}

// ── 校准日志 API ─────────────────────────────────────────────────────────────
export const calibrationLogApi = {
  getRecent:   (limit = 50) => mockOrFallback('calibration.logs', [], 'calibrationLogApi.getRecent', legacyWarn).then(d => ok(d)),
  getStats:    () => mockOrFallback('calibration.channelStats', {}, 'calibrationLogApi.getStats', legacyWarn).then(d => ok(d)),
  getDailyStats:() => mockOrFallback('calibration.dailyStats', [], 'calibrationLogApi.getDailyStats', legacyWarn).then(d => ok(d)),
}

// ── 校准后数据 API ────────────────────────────────────────────────────────────
export const calibratedTelemetryApi = {
  getRecent: (limit = 50) => mockOrFallback('calibratedTelemetry.recent', [], 'calibratedTelemetryApi.getRecent', legacyWarn).then(d => ok(d)),
  getStats:  () => mockOrFallback('calibratedTelemetry.stats', {}, 'calibratedTelemetryApi.getStats', legacyWarn).then(d => ok(d)),
}

const _sum = (rows = [], key) => rows.reduce((sum, item) => sum + Number(item?.[key] || 0), 0)

const _interfaceGroupStatus = (rows = []) => {
  if (rows.some(item => item.status === '异常')) return '异常'
  if (rows.length > 0 && rows.every(item => item.status === '离线')) return '离线'
  return '在线'
}

const _getTimelineConfig = (range) => {
  if (range === '1w') return { points: 28, intervalMs: 6 * 60 * 60 * 1000 }
  if (range === '24h') return { points: 48, intervalMs: 30 * 60 * 1000 }
  return { points: 36, intervalMs: 5 * 60 * 1000 }
}

const _makeTimeline = (length, intervalMs, mapper) => {
  const now = Date.now()
  return Array.from({ length }, (_, index) => {
    const time = new Date(now - (length - 1 - index) * intervalMs).toISOString()
    return { time, ...mapper(index) }
  })
}

const _collectionStatsFromInterfaces = (interfaces = [], timeRange = '3h') => {
  const { points, intervalMs } = _getTimelineConfig(timeRange)
  const grouped = interfaces.reduce((map, item) => {
    const sender = item.sender || item.agentId || '未知发送方'
    if (!map.has(sender)) map.set(sender, [])
    map.get(sender).push(item)
    return map
  }, new Map())

  const rows = Array.from(grouped.entries()).map(([sender, items]) => ({
    key: sender,
    sender,
    interfaceCount: items.length,
    flowRate: _sum(items, 'flowRate'),
    packetCount: _sum(items, 'packetCount'),
    protocols: Array.from(new Set(items.map(item => item.protocol || item.transportProtocol || '-'))),
    status: _interfaceGroupStatus(items),
  })).sort((a, b) => b.flowRate - a.flowRate)

  const totalPacketCount = _sum(rows, 'packetCount')
  const totalFlowRate = _sum(rows, 'flowRate')
  const pie = rows.map(row => ({
    name: row.sender,
    value: row.flowRate,
    sender: row.sender,
    packetCount: row.packetCount,
    interfaceCount: row.interfaceCount,
    status: row.status,
  }))

  const interfaceTimelines = {}
  for (const [sender, items] of grouped.entries()) {
    const senderPackets = _sum(items, 'packetCount')
    const senderFlow = _sum(items, 'flowRate')
    const seed = sender.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    interfaceTimelines[sender] = _makeTimeline(points, intervalMs, (index) => {
      const ratio = 0.65 + index * (0.30 / points) + Math.sin(index / 2.5 + seed * 0.1) * 0.08
      return {
        packetCount: Math.max(0, Math.round((senderPackets / points) * ratio)),
        flowRate: Math.max(0, Math.round(senderFlow * ratio)),
      }
    })
  }

  const timeline = _makeTimeline(points, intervalMs, (index) => {
    const ratio = 0.68 + index * (0.28 / points) + Math.sin(index / 1.7) * 0.08
    return {
      packetCount: Math.max(0, Math.round((totalPacketCount / points) * ratio)),
      flowRate: Math.max(0, Math.round(totalFlowRate * ratio)),
    }
  })

  return { rows, pie, timeline, interfaceTimelines, totalFlowRate, totalPacketCount, interfaceCount: interfaces.length }
}

const _processStatsFromSources = (interfaces = [], tasks = [], timeRange = '3h') => {
  const { points, intervalMs } = _getTimelineConfig(timeRange)
  const todayReceived = _sum(interfaces, 'packetCount')
  const abnormalCount = interfaces.filter(item => item.status === '异常').length
  const errorData = Math.max(Math.round(todayReceived * 0.002), abnormalCount * 120)
  const dedupedCount = Math.round(todayReceived * 0.004)
  const todayProcessed = Math.max(0, todayReceived - dedupedCount - errorData)
  const throughput = _sum(interfaces, 'flowRate')
  const queueDepth = Math.max(0, todayReceived - todayProcessed)
  const rows = [
    { key: 'received', name: '今日接收', value: todayReceived, unit: '条' },
    { key: 'processed', name: '今日处理', value: todayProcessed, unit: '条' },
    { key: 'deduped', name: '去重数量', value: dedupedCount, unit: '条' },
    { key: 'error', name: '异常数据', value: errorData, unit: '条' },
    { key: 'task', name: '运行任务', value: asArray(tasks).filter(task => task.active || task.status === '运行中').length, unit: '个' },
  ]

  const grouped = interfaces.reduce((map, item) => {
    const sender = item.sender || item.agentId || '未知发送方'
    if (!map.has(sender)) map.set(sender, [])
    map.get(sender).push(item)
    return map
  }, new Map())

  const interfaceTimelines = {}
  for (const [sender, items] of grouped.entries()) {
    const senderPackets = _sum(items, 'packetCount')
    const senderProcessed = Math.max(0, Math.round(senderPackets * 0.994))
    const seed = sender.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    interfaceTimelines[sender] = _makeTimeline(points, intervalMs, (index) => {
      const ratio = 0.68 + index * (0.28 / points) + Math.sin(index / 2 + seed * 0.1) * 0.07
      return {
        packetCount: Math.max(0, Math.round((senderPackets / points) * ratio)),
        processedCount: Math.max(0, Math.round((senderProcessed / points) * ratio)),
      }
    })
  }

  const timeline = _makeTimeline(points, intervalMs, (index) => {
    const ratio = 0.70 + index * (0.24 / points) + Math.sin(index / 2) * 0.07
    return {
      todayReceived: Math.max(0, Math.round((todayReceived / points) * ratio)),
      todayProcessed: Math.max(0, Math.round((todayProcessed / points) * ratio)),
      dedupedCount: Math.max(0, Math.round((dedupedCount / points) * ratio)),
      errorData: Math.max(0, Math.round((errorData / points) * ratio)),
    }
  })

  return { todayReceived, todayProcessed, dedupedCount, errorData, throughput, queueDepth, rows, timeline, interfaceTimelines }
}

const _normalizeCollectionStats = (payload, fallbackRows = [], timeRange = '3h') => {
  const fallback = _collectionStatsFromInterfaces(fallbackRows, timeRange)
  const rows = asArray(payload?.rows).length ? asArray(payload.rows) : fallback.rows
  const pie = asArray(payload?.pie).length ? asArray(payload.pie) : rows.map(row => ({
    name: row.name || row.sender,
    value: Number(row.value ?? row.flowRate ?? 0),
    sender: row.sender || row.name,
    packetCount: row.packetCount || 0,
    interfaceCount: row.interfaceCount || 0,
    status: row.status,
  }))
  const timeline = asArray(payload?.timeline).length ? asArray(payload.timeline) : fallback.timeline
  const interfaceTimelines = payload?.interfaceTimelines || fallback.interfaceTimelines || {}
  return {
    ...fallback,
    ...payload,
    rows,
    pie,
    timeline,
    interfaceTimelines,
    totalFlowRate: Number(payload?.totalFlowRate ?? fallback.totalFlowRate),
    totalPacketCount: Number(payload?.totalPacketCount ?? fallback.totalPacketCount),
  }
}

const MOCK_COLLECTION_SENDERS = [
  { name: '实验综合控制分系统', interfaceCount: 3, baseRate: 2400, baseHourly: 180000, protocols: ['UDP', 'TCP'], status: '在线' },
  { name: '内部其他分系统', interfaceCount: 2, baseRate: 1200, baseHourly: 95000, protocols: ['TCP'], status: '在线' },
  { name: '测控中心模拟子系统', interfaceCount: 2, baseRate: 1800, baseHourly: 130000, protocols: ['UDP'], status: '在线' },
  { name: '测试测量', interfaceCount: 1, baseRate: 800, baseHourly: 56000, protocols: ['UDP'], status: '在线' },
  { name: '地面支持等效', interfaceCount: 2, baseRate: 1500, baseHourly: 110000, protocols: ['TCP', 'UDP'], status: '在线' },
  { name: '实验综合控制', interfaceCount: 2, baseRate: 1100, baseHourly: 78000, protocols: ['HTTP'], status: '异常' },
  { name: '数据管理与交互', interfaceCount: 1, baseRate: 600, baseHourly: 42000, protocols: ['TCP'], status: '在线' },
]

const MOCK_PROCESS_DATA_TYPES = [
  { name: '实时遥测数据', baseHourly: 280000, errorRate: 0.005 },
  { name: '延时遥测数据', baseHourly: 120000, errorRate: 0.004 },
  { name: '载荷业务数据', baseHourly: 85000, errorRate: 0.008 },
]

const _mockCollectionStats = (timeRange = '3h') => {
  const { points, intervalMs } = _getTimelineConfig(timeRange)
  const hoursPerPoint = intervalMs / 3600000

  const interfaceTimelines = {}
  const rows = []

  MOCK_COLLECTION_SENDERS.forEach((cfg) => {
    const seed = cfg.name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    let cumulativePackets = 0
    let sumFlowRate = 0

    const timeline = _makeTimeline(points, intervalMs, (i) => {
      const wave = 0.85 + 0.15 * Math.sin(i / 4 + seed * 0.07) + 0.08 * Math.cos(i / 2.5 + seed * 0.03)
      const packetCount = Math.max(0, Math.round(cfg.baseHourly * hoursPerPoint * wave))
      const flowRate = Math.max(0, Math.round(cfg.baseRate * wave))
      cumulativePackets += packetCount
      sumFlowRate += flowRate
      return { packetCount, flowRate }
    })

    interfaceTimelines[cfg.name] = timeline
    rows.push({
      key: cfg.name,
      sender: cfg.name,
      interfaceCount: cfg.interfaceCount,
      flowRate: Math.round(sumFlowRate / points),
      packetCount: cumulativePackets,
      protocols: cfg.protocols,
      status: cfg.status,
    })
  })

  rows.sort((a, b) => b.flowRate - a.flowRate)

  const totalPacketCount = _sum(rows, 'packetCount')
  const totalFlowRate = _sum(rows, 'flowRate')

  const pie = rows.map(row => ({
    name: row.sender,
    value: row.flowRate,
    sender: row.sender,
    packetCount: row.packetCount,
    interfaceCount: row.interfaceCount,
    status: row.status,
  }))

  const timeline = _makeTimeline(points, intervalMs, (i) => {
    let pc = 0
    let fr = 0
    MOCK_COLLECTION_SENDERS.forEach(cfg => {
      const point = interfaceTimelines[cfg.name][i]
      pc += point.packetCount
      fr += point.flowRate
    })
    return { packetCount: pc, flowRate: fr }
  })

  return {
    rows,
    pie,
    timeline,
    interfaceTimelines,
    totalFlowRate,
    totalPacketCount,
    interfaceCount: _sum(rows, 'interfaceCount'),
  }
}

const _mockProcessStats = (timeRange = '3h') => {
  const { points, intervalMs } = _getTimelineConfig(timeRange)
  const hoursPerPoint = intervalMs / 3600000

  const interfaceTimelines = {}
  const typeStats = []
  let totalReceived = 0
  let totalProcessed = 0
  let totalError = 0
  let totalDeduped = 0

  MOCK_PROCESS_DATA_TYPES.forEach((cfg) => {
    const seed = cfg.name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    let typeReceived = 0
    let typeProcessed = 0
    let typeError = 0

    const timeline = _makeTimeline(points, intervalMs, (i) => {
      const wave = 0.88 + 0.12 * Math.sin(i / 3.5 + seed * 0.08) + 0.06 * Math.cos(i / 2 + seed * 0.04)
      const packetCount = Math.max(0, Math.round(cfg.baseHourly * hoursPerPoint * wave))
      const errorCount = Math.max(0, Math.round(packetCount * cfg.errorRate))
      const processedCount = Math.max(0, packetCount - errorCount)
      typeReceived += packetCount
      typeProcessed += processedCount
      typeError += errorCount
      return { packetCount, processedCount }
    })

    const typeDeduped = Math.round(typeReceived * 0.004)
    totalReceived += typeReceived
    totalProcessed += typeProcessed
    totalError += typeError
    totalDeduped += typeDeduped

    interfaceTimelines[cfg.name] = timeline
    typeStats.push({
      type: cfg.name,
      processedCount: typeProcessed,
      dedupedCount: typeDeduped,
      errorCount: typeError,
    })
  })

  const rows = typeStats.map(item => ({
    key: item.type,
    type: item.type,
    processedCount: item.processedCount,
    dedupedCount: item.dedupedCount,
    errorCount: item.errorCount,
  }))

  const timeline = _makeTimeline(points, intervalMs, (i) => {
    let received = 0
    let processed = 0
    MOCK_PROCESS_DATA_TYPES.forEach(cfg => {
      const point = interfaceTimelines[cfg.name][i]
      received += point.packetCount
      processed += point.processedCount
    })
    return {
      todayReceived: received,
      todayProcessed: processed,
      dedupedCount: Math.round(received * 0.004),
      errorData: Math.round(received * 0.005),
    }
  })

  return {
    todayReceived: totalReceived,
    todayProcessed: totalProcessed,
    dedupedCount: totalDeduped,
    errorData: totalError,
    throughput: 0,
    queueDepth: 0,
    rows,
    timeline,
    interfaceTimelines,
  }
}

const _normalizeProcessStats = (payload, interfaces = [], tasks = [], timeRange = '3h') => {
  const fallback = _processStatsFromSources(interfaces, tasks, timeRange)
  return {
    ...fallback,
    ...payload,
    todayReceived: Number(payload?.todayReceived ?? fallback.todayReceived),
    todayProcessed: Number(payload?.todayProcessed ?? fallback.todayProcessed),
    dedupedCount: Number(payload?.dedupedCount ?? fallback.dedupedCount),
    errorData: Number(payload?.errorData ?? fallback.errorData),
    rows: asArray(payload?.rows).length ? asArray(payload.rows) : fallback.rows,
    timeline: asArray(payload?.timeline).length ? asArray(payload.timeline) : fallback.timeline,
    interfaceTimelines: payload?.interfaceTimelines || fallback.interfaceTimelines || {},
  }
}

// ── 可视化 API ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => Promise.all([
    agentRegistryApi.list().catch(() => []),
    taskApi.list().catch(() => []),
    alarmApi.getStats().catch(() => ok({})),
    alarmApi.getList(100).catch(() => ok([])),
  ]).then(([agents, tasks, alarmStatsRes, alarmsRes]) => {
    const rows = _mapInstances(agents)
    const totalMessages = rows.reduce((sum, item) => sum + Number(item.rxMessages || 0), 0)
    const totalErrors = rows.reduce((sum, item) => sum + Number(item.errorCount || 0), 0)
    const alarmStats = alarmStatsRes?.data || {}
    const alarms = asArray(alarmsRes?.data?.data || alarmsRes?.data)
    const unhandledAlarms = Number(
      alarmStats.unhandled ??
      alarmStats.active ??
      (alarmStats.total !== undefined && alarmStats.resolved !== undefined ? Number(alarmStats.total) - Number(alarmStats.resolved) : NaN)
    )
    const fallbackUnhandled = alarms.filter(item => {
      const status = item.status === 'RESOLVED' ? '已处理' : item.status === 'ACTIVE' ? '未处理' : item.status || '未处理'
      return status !== '已处理'
    }).length
    const onlineAgents = agents.filter(agent => (agent.instances || []).some(instance => {
      const state = String(instance.state || instance.status || '').toUpperCase()
      return state === 'RUNNING' || state === 'ONLINE' || state === 'ACTIVE'
    })).length
    return ok({
      onlineAgents,
      onlineSatellites: onlineAgents,
      dataRate: rows.reduce((sum, item) => sum + Number(item.rxRate || 0), 0),
      latency: 0,
      errorRate: totalMessages > 0 ? Number(((totalErrors / totalMessages) * 100).toFixed(2)) : 0,
      unhandledAlarms: Number.isFinite(unhandledAlarms) ? Math.max(0, unhandledAlarms) : fallbackUnhandled,
      totalAgents: agents.length,
      runningAgents: agents.filter(a => (a.instances || []).some(i => i.state === 'RUNNING')).length,
      totalTasks: tasks.length,
      activeTask: tasks.find(t => t.active)?.name,
    })
  }),
  getSatelliteStatus: () => agentRegistryApi.list()
    .then(agents => ok(_mapInstances(agents).map(item => ({
      satelliteId: item.interfaceName,
      name: item.interfaceName,
      status: item.status === '在线' ? '正常' : item.status,
      dataRate: item.rxRate || 0,
      lastTime: item.lastHeartbeat,
    }))))
    .catch(() => mockOrFallback('dashboard.satelliteStatus', [], 'dashboardApi.getSatelliteStatus', legacyWarn).then(d => ok(d))),
  getFlowDistribution: () => isMockEnabled()
    ? _loadInterfaces().then(interfaces => ok(_collectionStatsFromInterfaces(interfaces).pie))
    : _fetchApiJson('/dashboard/flow-distribution').then(rows => {
      if (rows !== null) return ok(asArray(rows))
      return _loadInterfaces().then(interfaces => ok(_collectionStatsFromInterfaces(interfaces).pie))
    }),
  getCollectionStats: (timeRange = '3h') => isMockEnabled()
    ? Promise.resolve(ok(_mockCollectionStats(timeRange)))
    : Promise.all([
      _fetchApiJson('/dashboard/collection-stats', { timeRange }),
      _loadInterfaces().catch(() => []),
    ]).then(([payload, interfaces]) => ok(_normalizeCollectionStats(payload, interfaces, timeRange))),
  getProcessStats:   (timeRange = '3h') => isMockEnabled()
    ? Promise.resolve(ok(_mockProcessStats(timeRange)))
    : Promise.all([
      _loadInterfaces(),
      taskApi.list().catch(() => []),
      _fetchApiJson('/dashboard/process-stats', { timeRange }),
    ]).then(([rows, tasks, payload]) => ok(_normalizeProcessStats(payload, rows, tasks, timeRange)))
      .catch(() => mockOrFallback('dashboard.processStats', { throughput: 0, queueDepth: 0 }, 'dashboardApi.getProcessStats', legacyWarn).then(d => ok(_normalizeProcessStats(d, [], [], timeRange)))),
  getRealtimeChart:  (satelliteId, param) => mockOrFallback('dashboard.realtimeChart', [], 'dashboardApi.getRealtimeChart', legacyWarn).then(d => ok(d)),
}

// ── 采集代理 API（兼容旧 getAll/getById/delete 签名）────────────────────────
export const agentApi = {
  getAll:  () => agentRegistryApi.list().then(d => ok(d)).catch(() => ok([])),
  getById: (id) => agentRegistryApi.detail(id).then(d => ok(d)).catch(() => ok({})),
  delete:  (id) => agentRegistryApi.remove(id).then(d => ok(d)).catch(() => ok({})),
  instanceAction: () => unsupported('agentApi.instanceAction'),
  // 兼容 list/detail/remove 直调
  list:   agentRegistryApi.list,
  detail: agentRegistryApi.detail,
  remove: agentRegistryApi.remove,
}

export default http
