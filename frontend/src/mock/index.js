/**
 * Mock 模块入口
 * 提供 axios adapter 和 getMockData 函数
 * 此模块仅在 useMock=true 时通过动态 import 加载
 */
import { handlers } from './handlers.js'
import * as datasets from './datasets/index.js'

/** 从 URL 中解析查询参数 */
function parseQuery(url) {
  const q = {}
  const idx = url.indexOf('?')
  if (idx === -1) return q
  url.slice(idx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=').map(decodeURIComponent)
    q[k] = v
  })
  return q
}

/** 移除查询参数的路径部分 */
function stripQuery(url) {
  const idx = url.indexOf('?')
  return idx === -1 ? url : url.slice(0, idx)
}

/** 查找匹配的 handler */
function findHandler(method, url) {
  const path = stripQuery(url)
  const m = method.toLowerCase()
  for (const h of handlers) {
    if (h.method !== m) continue
    const match = path.match(h.pattern)
    if (match) {
      const pathParams = match.slice(1)
      const query = parseQuery(url)
      return { handler: h, pathParams, query }
    }
  }
  return null
}

/**
 * Axios adapter 实现
 * 拦截请求，返回 mock 响应
 */
export async function mockAdapter(config) {
  const url = config.url || ''
  const method = config.method || 'get'

  // 模拟网络延迟 60~180ms
  const delay = 60 + Math.floor(Math.random() * 120)
  await new Promise(resolve => setTimeout(resolve, delay))

  const found = findHandler(method, url)

  if (!found) {
    console.warn(`[mock] no handler for ${method.toUpperCase()} ${url}`)
    return {
      data: null,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }

  try {
    const { handler, pathParams, query } = found
    const body = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : undefined
    const data = handler.handle({ pathParams, query, body })

    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config,
    }
  } catch (e) {
    console.error(`[mock] handler error for ${method.toUpperCase()} ${url}:`, e)
    return {
      data: null,
      status: 500,
      statusText: 'Mock Error',
      headers: {},
      config,
    }
  }
}

/**
 * 获取 mock 数据（供 legacyMockBridge 使用）
 * key 格式: "domain.subkey" 如 "alarm.list", "telemetry.recent"
 */
export function getMockData(key) {
  const map = {
    'alarm.list': () => datasets.alarms.list || datasets.alarms.data || [],
    'alarm.stats': () => datasets.alarmStats,
    'log.list': () => datasets.logs.list || datasets.logs.data || [],
    'log.stats': () => datasets.logStats,
    'event.recent': () => datasets.events.list || datasets.events.data || [],
    'event.stats': () => datasets.eventStats,
    'telemetry.recent': () => datasets.telemetry,
    'telemetry.stats': () => datasets.telemetryStats,
    'interface.stats': () => ({
      total: datasets.agents.length * 2,
      online: datasets.agents.filter(a => a.status === 'RUNNING').length * 2,
      error: 1,
      todayCount: 856000,
    }),
    'interface.list': () => datasets.agents.flatMap(a =>
      (a.instances || []).map(i => ({
        id: i.interfaceInstanceId,
        interfaceName: `${a.agentId}-${i.protocol}`,
        interfaceType: i.protocol.includes('UDP') ? 'INTERNAL' : 'EXTERNAL',
        protocol: i.protocol.includes('UDP') ? 'UDP' : i.protocol.includes('TCP') ? 'TCP' : 'HTTP',
        host: a.host,
        port: a.port + i.instanceIndex,
        status: i.state === 'RUNNING' ? '在线' : (i.state === 'STOPPED' ? '离线' : '异常'),
        enabled: i.state === 'RUNNING',
        packetCount: i.rxMessages,
        flowRate: i.rxRate,
      }))
    ),
    'dashboard.stats': () => ({
      onlineSatellites: 4,
      dataRate: 128.5,
      latency: 45,
      errorRate: 0.8,
      totalAgents: datasets.agents.length,
      runningAgents: datasets.agents.filter(a => a.status === 'RUNNING').length,
      totalTasks: datasets.tasks.length,
      activeTask: datasets.tasks.find(t => t.active)?.taskName || '综合遥测试验任务',
    }),
    'dashboard.satelliteStatus': () => [
      { name: 'SAT-001', status: '正常', lastUpdate: '2026-05-25 14:32:10' },
      { name: 'SAT-002', status: '正常', lastUpdate: '2026-05-25 14:32:05' },
      { name: 'SAT-003', status: '警告', lastUpdate: '2026-05-25 14:31:58' },
      { name: 'SAT-004', status: '正常', lastUpdate: '2026-05-25 14:32:12' },
      { name: 'SAT-005', status: '离线', lastUpdate: '2026-05-25 13:15:00' },
    ],
    'dashboard.flowDistribution': () => datasets.agents.flatMap(a =>
      (a.instances || []).map(i => ({
        name: a.agentId + '/' + i.protocol,
        value: i.rxRate || 0,
      }))
    ),
    'dashboard.processStats': () => ({
      todayReceived: 458200,
      todayProcessed: 456800,
      dedupedCount: 3200,
      errorData: 1400,
      throughput: 1280,
      queueDepth: 8,
    }),
    'dashboard.realtimeChart': () =>
      Array.from({ length: 20 }, (_, i) => ({
        time: `${i}s`,
        value: (Math.sin(i * 0.3) * 30 + 55 + Math.random() * 5).toFixed(2),
      })),
    'processTask.list': () => datasets.tasks,
    'processTask.stats': () => ({
      total: datasets.tasks.length,
      running: datasets.tasks.filter(t => t.status === 'RUNNING').length,
    }),
    'processLog.recent': () => datasets.processLogs.list || datasets.processLogs.data || [],
    'processLog.stats': () => datasets.processLogStats,
    'processedTelemetry.recent': () => datasets.telemetry.slice(0, 30),
    'processedTelemetry.stats': () => ({ total: 456800, normal: 455000, abnormal: 1800 }),
    'processedTelemetry.monitor': () => datasets.telemetry.slice(0, 20).map(d => ({
      ...d,
      processed: true,
      alarmTriggered: Math.random() > 0.85,
    })),
    'calibration.channelList': () => datasets.calibrationChannels,
    'calibration.channelStats': () => datasets.calibrationStats,
    'calibration.config': () => datasets.calibrationConfig,
    'calibration.logs': () => datasets.calibrationLogs,
    'calibration.dailyStats': () => datasets.calibrationDailyStats,
    'calibratedTelemetry.recent': () => datasets.telemetry.slice(0, 20).map(d => ({
      ...d,
      calibratedValue: d.paramValue + (Math.random() - 0.5) * 0.1,
    })),
    'calibratedTelemetry.stats': () => ({ total: 12000, calibrated: 11800, failed: 200 }),
    'user.list': () => datasets.users,
    'config.list': () => datasets.configs,
    'config.protocolList': () => {
      try {
        const pm = datasets.parseModel.parseModelJson
        const parsed = typeof pm === 'string' ? JSON.parse(pm) : pm
        return parsed?.protocols || []
      } catch { return [] }
    },
    'parseModel.protocols': () => {
      try {
        const pm = datasets.parseModel.parseModelJson
        const parsed = typeof pm === 'string' ? JSON.parse(pm) : pm
        return parsed?.protocols || []
      } catch { return [] }
    },
    'parseModel.rules': () => {
      try {
        const ar = datasets.parseModel.alarmRulesJson
        return typeof ar === 'string' ? JSON.parse(ar) : ar
      } catch { return [] }
    },
  }

  const fn = map[key]
  if (!fn) {
    console.warn(`[mock] no getMockData key: ${key}`)
    return null
  }
  return fn()
}
