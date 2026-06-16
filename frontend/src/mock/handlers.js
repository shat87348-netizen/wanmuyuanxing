/** Mock Handler 注册表 - URL 到 mock handler 的映射 */
import * as datasets from './datasets/index.js'

export const handlers = [
  // ── Agent Registry ──
  {
    method: 'get',
    pattern: /^\/agent-registry$/,
    handle: () => datasets.agents,
  },
  {
    method: 'get',
    pattern: /^\/agent-registry\/([^/]+)$/,
    handle: ({ pathParams }) =>
      datasets.agents.find(a => a.agentId === pathParams[0]) || null,
  },
  {
    method: 'delete',
    pattern: /^\/agent-registry\/([^/]+)$/,
    handle: () => ({ success: true }),
  },
  {
    method: 'post',
    pattern: /^\/agent-registry\/([^/]+)\/instance\/([^/]+)\/([^/]+)$/,
    handle: () => ({ success: true }),
  },

  // ── Task ──
  {
    method: 'get',
    pattern: /^\/task$/,
    handle: () => datasets.tasks,
  },
  {
    method: 'get',
    pattern: /^\/task\/current$/,
    handle: () => datasets.tasks.find(t => t.active) || datasets.tasks[0],
  },
  {
    method: 'get',
    pattern: /^\/task\/(\d+)$/,
    handle: ({ pathParams }) =>
      datasets.tasks.find(t => t.id === Number(pathParams[0])) || null,
  },
  {
    method: 'post',
    pattern: /^\/task$/,
    handle: ({ body }) => ({ ...body, id: Date.now(), active: false, status: 'PENDING' }),
  },
  {
    method: 'put',
    pattern: /^\/task\/(\d+)$/,
    handle: ({ pathParams, body }) => {
      const task = datasets.tasks.find(t => t.id === Number(pathParams[0]))
      return task ? { ...task, ...body } : null
    },
  },
  {
    method: 'delete',
    pattern: /^\/task\/(\d+)$/,
    handle: () => ({ success: true }),
  },
  {
    method: 'post',
    pattern: /^\/task\/(\d+)\/activate$/,
    handle: ({ pathParams }) => {
      const task = datasets.tasks.find(t => t.id === Number(pathParams[0]))
      return task ? { ...task, active: true, status: 'RUNNING' } : null
    },
  },

  // ── Telemetry ──
  {
    method: 'get',
    pattern: /^\/telemetry\/recent$/,
    handle: ({ query }) => {
      const limit = Number(query.limit || 50)
      return datasets.telemetry.slice(0, limit)
    },
  },
  {
    method: 'get',
    pattern: /^\/telemetry\/satellite\/([^/]+)$/,
    handle: ({ pathParams, query }) => {
      const satelliteId = pathParams[0]
      const limit = Number(query.limit || 20)
      return datasets.telemetry
        .filter(d => d.satelliteId === satelliteId)
        .slice(0, limit)
    },
  },
  {
    method: 'get',
    pattern: /^\/telemetry\/stats$/,
    handle: () => datasets.telemetryStats,
  },

  // ── Parse Model ──
  {
    method: 'get',
    pattern: /^\/parse-model\/(\d+)$/,
    handle: () => datasets.parseModel,
  },
  {
    method: 'put',
    pattern: /^\/parse-model\/(\d+)$/,
    handle: ({ body }) => ({ ...datasets.parseModel, ...body }),
  },
  {
    method: 'post',
    pattern: /^\/parse-model\/(\d+)\/import$/,
    handle: () => ({ success: true }),
  },

  // ── Dashboard / Flow Distribution (computed from agents) ──
  {
    method: 'get',
    pattern: /^\/dashboard\/flow-distribution$/,
    handle: () => datasets.agents.flatMap(a =>
      (a.instances || []).map(i => ({
        name: a.agentId + '/' + i.protocol,
        value: i.rxRate || 0,
      }))
    ),
  },

  // ── Calibration ──
  {
    method: 'get',
    pattern: /^\/calibration\/channels$/,
    handle: () => datasets.calibrationChannels,
  },
]
