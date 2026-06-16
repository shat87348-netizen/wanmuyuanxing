/** Mock: Agent Registry 数据 */
const instanceTemplates = [
  { protocol: 'UDP', state: 'RUNNING', rxRate: 1250000, rxBytes: 8900000000, rxMessages: 450000, errorCount: 3 },
  { protocol: 'TCP', state: 'RUNNING', rxRate: 980000, rxBytes: 6700000000, rxMessages: 320000, errorCount: 1 },
  { protocol: 'HTTP', state: 'STOPPED', rxRate: 0, rxBytes: 1200000000, rxMessages: 85000, errorCount: 0 },
  { protocol: 'PDXP-UDP', state: 'RUNNING', rxRate: 2100000, rxBytes: 15000000000, rxMessages: 780000, errorCount: 7 },
  { protocol: 'Protobuf-TCP', state: 'RUNNING', rxRate: 1560000, rxBytes: 9800000000, rxMessages: 520000, errorCount: 2 },
  { protocol: 'JSON-HTTP', state: 'RUNNING', rxRate: 870000, rxBytes: 4300000000, rxMessages: 210000, errorCount: 0 },
]

let instanceIdCounter = 200

const makeInstance = (template, agentId, idx) => ({
  interfaceInstanceId: instanceIdCounter++,
  protocol: template.protocol,
  state: template.state,
  rxRate: template.rxRate + Math.floor(Math.random() * 200000),
  rxBytes: template.rxBytes + Math.floor(Math.random() * 1000000000),
  rxMessages: template.rxMessages + Math.floor(Math.random() * 50000),
  errorCount: template.errorCount + (Math.random() > 0.9 ? 1 : 0),
  agentId,
  instanceIndex: idx,
})

export const agents = [
  {
    agentId: 'AGENT-001',
    agentName: '主采集代理-01',
    agentType: 'COLLECTOR',
    host: '192.168.1.101',
    port: 9001,
    status: 'RUNNING',
    instances: [
      makeInstance(instanceTemplates[0], 'AGENT-001', 0),
      makeInstance(instanceTemplates[1], 'AGENT-001', 1),
      makeInstance(instanceTemplates[4], 'AGENT-001', 2),
    ],
  },
  {
    agentId: 'AGENT-002',
    agentName: '备份采集代理-02',
    agentType: 'COLLECTOR',
    host: '192.168.1.102',
    port: 9002,
    status: 'RUNNING',
    instances: [
      makeInstance(instanceTemplates[3], 'AGENT-002', 0),
      makeInstance(instanceTemplates[5], 'AGENT-002', 1),
    ],
  },
  {
    agentId: 'AGENT-003',
    agentName: '数据处理代理-03',
    agentType: 'PROCESSOR',
    host: '192.168.1.103',
    port: 9003,
    status: 'RUNNING',
    instances: [
      makeInstance(instanceTemplates[0], 'AGENT-003', 0),
      makeInstance(instanceTemplates[4], 'AGENT-003', 1),
      makeInstance(instanceTemplates[2], 'AGENT-003', 2),
    ],
  },
  {
    agentId: 'AGENT-004',
    agentName: '校准代理-04',
    agentType: 'CALIBRATOR',
    host: '192.168.1.104',
    port: 9004,
    status: 'STOPPED',
    instances: [
      makeInstance(instanceTemplates[1], 'AGENT-004', 0),
    ],
  },
  {
    agentId: 'AGENT-005',
    agentName: '遥测转发代理-05',
    agentType: 'RELAY',
    host: '192.168.1.105',
    port: 9005,
    status: 'RUNNING',
    instances: [
      makeInstance(instanceTemplates[5], 'AGENT-005', 0),
      makeInstance(instanceTemplates[3], 'AGENT-005', 1),
      makeInstance(instanceTemplates[0], 'AGENT-005', 2),
    ],
  },
  {
    agentId: 'AGENT-006',
    agentName: '日志采集代理-06',
    agentType: 'COLLECTOR',
    host: '192.168.1.106',
    port: 9006,
    status: 'RUNNING',
    instances: [
      makeInstance(instanceTemplates[1], 'AGENT-006', 0),
    ],
  },
]
