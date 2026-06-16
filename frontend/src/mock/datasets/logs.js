/** Mock: 系统日志数据 */
const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG']
const modules = ['AgentManager', 'DataCollector', 'ProtocolParser', 'TaskScheduler', 'CalibrationEngine', 'StorageService']
const messages = {
  INFO: ['服务启动完成', '配置加载成功', '定时任务已注册', '健康检查通过', '连接池初始化完成', '数据同步开始'],
  WARN: ['重试次数达到上限', '缓冲区接近饱和', '响应时间超过阈值 2s', '证书即将过期', '磁盘空间不足 15%'],
  ERROR: ['数据库连接超时', '消息解析失败', '任务执行异常退出', '文件写入失败', '认证令牌无效'],
  DEBUG: ['收到心跳包 seq=1024', '缓存命中率 87.3%', 'GC 回收 12MB', '线程池: active=4 idle=8', '批量写入 256 条'],
}

function genLogs(count) {
  const list = []
  const baseTime = Date.now() - count * 30000
  for (let i = 0; i < count; i++) {
    const level = levels[i % levels.length]
    const mod = modules[i % modules.length]
    const msgs = messages[level]
    list.push({
      id: i + 1,
      logId: i + 1,
      level,
      logLevel: level,
      module: mod,
      source: mod,
      message: msgs[i % msgs.length],
      detail: `[${mod}] ${msgs[i % msgs.length]} - traceId=${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date(baseTime + i * 30000).toISOString(),
      logTime: new Date(baseTime + i * 30000).toISOString(),
    })
  }
  return list
}

const list = genLogs(50)

export const logs = { data: list, list }

export const stats = {
  total: list.length,
  info: list.filter(l => l.level === 'INFO').length,
  warn: list.filter(l => l.level === 'WARN').length,
  error: list.filter(l => l.level === 'ERROR').length,
  debug: list.filter(l => l.level === 'DEBUG').length,
}
