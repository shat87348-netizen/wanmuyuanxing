/**
 * 运行时配置加载模块
 * 从 public/config.json 读取配置，支持部署后热切换 mock/real 模式
 */

let _config = null
let _loaded = false
let _loadPromise = null

const DEFAULT_CONFIG = Object.freeze({
  useMock: false,
  apiBaseUrl: '/api'
})

/** 加载运行时配置（应用启动前调用一次） */
export async function loadRuntimeConfig() {
  if (_loaded) return _config
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/'
      const res = await fetch(base + 'config.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      _config = Object.freeze({ ...DEFAULT_CONFIG, ...json })
    } catch (e) {
      console.warn('[runtime-config] 无法加载 config.json，使用默认配置:', e.message)
      _config = DEFAULT_CONFIG
    }
    _loaded = true
    return _config
  })()

  return _loadPromise
}

/** 获取当前运行时配置（同步） */
export function getRuntimeConfig() {
  if (!_loaded) {
    console.warn('[runtime-config] 配置尚未加载，返回默认配置')
    return { ...DEFAULT_CONFIG }
  }
  return _config
}

/** 是否启用 mock 模式（同步） */
export function isMockEnabled() {
  return getRuntimeConfig().useMock === true
}
