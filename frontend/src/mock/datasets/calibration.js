/** Mock: 校准数据 */
export const channels = [
  { id: 'CH-001', channelName: '温度校准通道A', channelType: '温度传感器', range: '20~85°C', unit: '°C', outlierMethod: '3sigma', status: '正常', accuracy: 0.998, drift: 0.002, lastCalTime: new Date(Date.now() - 3600000).toISOString(), baseValue: 52, amplitude: 16, lower: 20, upper: 85, autoClean: true, enabled: true },
  { id: 'CH-002', channelName: '电压校准通道B', channelType: '电压传感器', range: '22~32V', unit: 'V', outlierMethod: 'threshold', status: '正常', accuracy: 0.995, drift: 0.005, lastCalTime: new Date(Date.now() - 7200000).toISOString(), baseValue: 27, amplitude: 3, lower: 22, upper: 32, autoClean: true, enabled: true },
  { id: 'CH-003', channelName: '电流校准通道C', channelType: '电流传感器', range: '0.5~12A', unit: 'A', outlierMethod: 'chauvener', status: '停止', accuracy: 0.992, drift: 0.008, lastCalTime: new Date(Date.now() - 86400000).toISOString(), baseValue: 6, amplitude: 4, lower: 0.5, upper: 12, autoClean: false, enabled: false },
  { id: 'CH-004', channelName: '功率校准通道D', channelType: '功率传感器', range: '10~200W', unit: 'W', outlierMethod: '3sigma', status: '正常', accuracy: 0.999, drift: 0.001, lastCalTime: new Date(Date.now() - 1800000).toISOString(), baseValue: 120, amplitude: 40, lower: 10, upper: 200, autoClean: true, enabled: true },
  { id: 'CH-005', channelName: '姿态校准通道E', channelType: '姿态传感器', range: '-90~90°', unit: '°', outlierMethod: 'threshold', status: '异常', accuracy: 0.97, drift: 0.03, lastCalTime: new Date(Date.now() - 43200000).toISOString(), baseValue: 0, amplitude: 45, lower: -90, upper: 90, autoClean: true, enabled: true },
]

export const config = {
  method: '线性插值',
  interval: 3600,
  tolerance: 0.01,
  channels: channels.map(c => ({ id: c.id, name: c.channelName, type: c.channelType, enabled: c.status === '正常' })),
}

const logLevels = ['INFO', 'WARN', 'ERROR']
function genLogs(count) {
  const list = []
  for (let i = 0; i < count; i++) {
    const ch = channels[i % channels.length]
    list.push({
      id: i + 1,
      channelId: ch.id,
      channelName: ch.channelName,
      level: logLevels[i % 3],
      message: `校准${logLevels[i % 3] === 'ERROR' ? '失败' : '完成'}: 偏差=${(Math.random() * 0.01).toFixed(4)}`,
      calTime: new Date(Date.now() - i * 3600000).toISOString(),
    })
  }
  return list
}

export const logs = genLogs(20)

export const stats = {
  totalChannels: channels.length,
  runningChannels: channels.filter(c => c.status === '正常').length,
  todayCalCount: 12,
  avgAccuracy: 0.991,
}

// 校准记录（按天 × 通道 统计），字段与页面表格列对齐
export const dailyStats = (() => {
  const rows = []
  for (let d = 6; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
    channels.forEach((ch, idx) => {
      const seed = (d * 7 + idx * 13) % 17
      const outlierCount = 200 + Math.floor((Math.sin(seed) * 0.5 + 0.5) * 1300)
      const cleanedCount = Math.floor(outlierCount * (0.78 + (seed % 5) * 0.04))
      const accuracy = +(96.2 + (Math.cos(seed) * 0.5 + 0.5) * 3.6).toFixed(1)
      rows.push({
        date,
        channelId: ch.id,
        channelName: ch.channelName,
        channelType: ch.channelType,
        unit: ch.unit,
        outlierCount,
        cleanedCount,
        accuracy,
      })
    })
  }
  return rows.reverse()
})()
