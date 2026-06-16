/**
 * Legacy Mock Bridge
 * 为不走 HTTP 的旧桩函数提供统一的 mock/real 切换入口
 * real 模式：保留原 fallback + legacyWarn 行为
 * mock 模式：从 mock 数据集获取数据
 */
import { isMockEnabled } from '../config/runtime'

let mockModulePromise = null

async function getMockModule() {
  if (!mockModulePromise) {
    mockModulePromise = import('../mock')
  }
  return mockModulePromise
}

/**
 * @param {string} key - mock 数据键名，如 "alarm.list"
 * @param {*} fallback - real 模式下的默认返回值
 * @param {string} [warnName] - legacyWarn 名称
 * @param {Function} [legacyWarn] - legacy 警告函数
 * @returns {Promise<*>}
 */
export async function mockOrFallback(key, fallback, warnName, legacyWarn) {
  if (!isMockEnabled()) {
    if (warnName && legacyWarn) {
      legacyWarn(warnName)
    }
    return fallback
  }

  try {
    const { getMockData } = await getMockModule()
    const data = getMockData(key)
    return data ?? fallback
  } catch (e) {
    console.error('[legacyMockBridge] error:', e)
    return fallback
  }
}
