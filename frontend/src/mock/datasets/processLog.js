/** Mock: 处理日志数据 */
const levels = ['INFO', 'WARN', 'ERROR']
const phases = ['数据接收', '协议解析', '规则匹配', '告警生成', '数据存储', '结果输出']

function genLogs(count) {
  const list = []
  for (let i = 0; i < count; i++) {
    list.push({
      id: i + 1,
      level: levels[i % 3],
      phase: phases[i % phases.length],
      message: `${phases[i % phases.length]}${levels[i % 3] === 'ERROR' ? '异常' : '完成'}，处理 ${Math.floor(Math.random() * 500) + 100} 条数据`,
      timestamp: new Date(Date.now() - i * 45000).toISOString(),
    })
  }
  return list
}

const list = genLogs(30)

export const processLogs = { data: list, list }

export const stats = {
  totalProcessed: 125800,
  successCount: 124500,
  errorCount: 1300,
  avgLatency: 45,
  throughput: 1280,
  queueDepth: 8,
}
