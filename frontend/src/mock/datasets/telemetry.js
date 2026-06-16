/** Mock: 遥测数据 */
const satellites = ['SAT-001', 'SAT-002', 'SAT-003', 'SAT-004']
const paramDefs = [
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

const rand = (min, max) => +(min + Math.random() * (max - min)).toFixed(2)

function genTelemetry(count) {
  const list = []
  const baseTime = Date.now() - count * 2000
  for (let i = 0; i < count; i++) {
    const sat = satellites[i % satellites.length]
    const ch = (i % 3 === 0) ? 'CH-A' : (i % 3 === 1) ? 'CH-B' : 'CH-C'
    paramDefs.forEach(p => {
      list.push({
        id: `${sat}-${p.code}-${i}`,
        satelliteId: sat,
        channel: ch,
        telemetryCode: p.code,
        paramName: p.name,
        paramType: p.type,
        paramValue: rand(p.range[0], p.range[1]),
        unit: p.unit,
        status: Math.random() > 0.92 ? '异常' : '正常',
        timestamp: new Date(baseTime + i * 2000).toISOString(),
      })
    })
  }
  return list
}

export const list = genTelemetry(50)

export const stats = {
  totalCount: list.length,
  normalCount: list.filter(d => d.status === '正常').length,
  abnormalCount: list.filter(d => d.status === '异常').length,
  lastUpdate: new Date().toISOString(),
}
