/** Mock: 系统配置数据 */
export const configs = [
  { id: 1, configKey: 'system.name', configValue: '数据处理子系统', configType: 'SYSTEM', description: '系统名称' },
  { id: 2, configKey: 'system.version', configValue: 'v2.1.0', configType: 'SYSTEM', description: '系统版本' },
  { id: 3, configKey: 'collect.interval', configValue: '1000', configType: 'COLLECT', description: '采集间隔(ms)' },
  { id: 4, configKey: 'collect.bufferSize', configValue: '65536', configType: 'COLLECT', description: '采集缓冲区大小' },
  { id: 5, configKey: 'alarm.emailEnabled', configValue: 'true', configType: 'ALARM', description: '邮件告警开关' },
  { id: 6, configKey: 'alarm.smsEnabled', configValue: 'false', configType: 'ALARM', description: '短信告警开关' },
  { id: 7, configKey: 'storage.retentionDays', configValue: '90', configType: 'STORAGE', description: '数据保留天数' },
  { id: 8, configKey: 'storage.maxSize', configValue: '107374182400', configType: 'STORAGE', description: '最大存储空间(字节)' },
]
