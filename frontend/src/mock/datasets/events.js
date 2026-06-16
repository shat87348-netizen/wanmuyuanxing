/** Mock: 接口事件数据 */
const severities = ['INFO', 'WARNING', 'ERROR', 'CRITICAL']
const interfaceNames = ['UDP遥测接口-01', 'TCP指令接口-02', 'HTTP数据接口-03', 'PDXP-UDP接口-04']
const eventMessages = {
  INFO: ['接口连接建立', '数据包接收正常', '心跳检测通过', '配置重新加载'],
  WARNING: ['数据包延迟 >500ms', '缓冲区使用率 80%', '重传次数增多', '带宽接近上限'],
  ERROR: ['接口连接断开', '数据校验失败', '协议解析错误', '缓冲区溢出'],
  CRITICAL: ['接口长时间无响应', '硬件故障告警', '安全认证失败'],
}

function genEvents(count) {
  const list = []
  const baseTime = Date.now() - count * 60000
  for (let i = 0; i < count; i++) {
    const sev = severities[i % severities.length]
    const iface = interfaceNames[i % interfaceNames.length]
    const msgs = eventMessages[sev]
    list.push({
      id: i + 1,
      eventId: i + 1,
      severity: sev,
      interfaceName: iface,
      interfaceId: (i % 6) + 1,
      message: msgs[i % msgs.length],
      eventTime: new Date(baseTime + i * 60000).toISOString(),
    })
  }
  return list
}

const list = genEvents(30)

export const events = { data: list, list }

export const stats = {
  info: list.filter(e => e.severity === 'INFO').length,
  warning: list.filter(e => e.severity === 'WARNING').length,
  error: list.filter(e => e.severity === 'ERROR').length,
  critical: list.filter(e => e.severity === 'CRITICAL').length,
}
