/** Mock: 告警数据 */
const levels = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO']
const sources = ['温度监控', '电压监控', '通信链路', '存储系统', '电源系统', '姿态控制', '载荷设备']
const messages = {
  CRITICAL: ['温度超出安全阈值 85°C', '信号强度降至 -115dBm', '主电源模块故障', '姿态角偏移超限 ±15°'],
  MAJOR: ['电压波动超过 ±5%', '存储使用率达 95%', '下行速率降至 0.3Mbps', '电池温度 52°C 偏高'],
  MINOR: ['电流轻微波动', '传感器响应延迟', '数据包偶发丢失', '校准参数漂移'],
  WARNING: ['CPU温度 70°C 注意', '湿度 85% 偏高', '队列深度增加', '内存使用率 82%'],
  INFO: ['系统自检完成', '定时校准开始', '数据备份完成', '固件更新成功'],
}

const tasks = ['综合遥测试验任务', '载荷数据处理任务', '姿态控制验证任务', '电源系统监测任务']
const channelNames = ['CH-A / UDP-01', 'CH-B / TCP-02', 'CH-C / UDP-03', 'CH-D / HTTP-04', 'CH-E / TCP-05']
const triggerRules = {
  CRITICAL: '数值 > 危急阈值，持续 ≥ 3 帧',
  MAJOR: '数值 > 告警阈值，持续 ≥ 5 帧',
  MINOR: '数值偏离基线 > 10%',
  WARNING: '数值接近阈值（达 90%）',
  INFO: '状态变更通知',
}

function genAlarms(count) {
  const list = []
  const baseTime = Date.now() - count * 600000
  for (let i = 0; i < count; i++) {
    const level = levels[i % levels.length]
    const msgs = messages[level]
    const src = sources[i % sources.length]
    list.push({
      id: i + 1,
      alarmId: i + 1,
      level,
      alarmLevel: level,
      alarmSource: src,
      source: src,
      alarmMessage: msgs[i % msgs.length],
      message: msgs[i % msgs.length],
      task: tasks[i % tasks.length],
      channel: channelNames[i % channelNames.length],
      triggerRule: triggerRules[level],
      status: i < 5 ? 'ACTIVE' : (i < 15 ? 'ACKED' : 'CLEARED'),
      createTime: new Date(baseTime + i * 600000).toISOString(),
      alarmTime: new Date(baseTime + i * 600000).toISOString(),
    })
  }
  return list
}

const list = genAlarms(30)

export const alarms = { data: list, list }

export const stats = {
  total: list.length,
  critical: list.filter(a => a.level === 'CRITICAL').length,
  major: list.filter(a => a.level === 'MAJOR').length,
  minor: list.filter(a => a.level === 'MINOR').length,
  warning: list.filter(a => a.level === 'WARNING').length,
  info: list.filter(a => a.level === 'INFO').length,
}
