export const BASE_URL = 'http://localhost:5173'

export const routes = [
  { path: '/dashboard', label: '总览' },
  { path: '/data-viz', label: '数据可视化' },
  { path: '/data-collection', label: '数据采集' },
  { path: '/data-process', label: '数据处理' },
  { path: '/calibration', label: '数据校准' },
  { path: '/alarm', label: '告警管理' },
  { path: '/config/agents', label: '采集代理' },
  { path: '/config/log', label: '日志管理' },
  { path: '/config/user', label: '用户管理' },
  { path: '/__test__/dashboard', label: 'Dashboard 源码页' },
  { path: '/__test__/protocol-config', label: 'ProtocolConfig 源码页' }
]

export const themeMatrix = [
  ['military', 'light'],
  ['military', 'dark'],
  ['style1', 'light'],
  ['style1', 'dark'],
  ['style2', 'light'],
  ['style2', 'dark']
]

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const getPageState = async (tab) => {
  return tab.playwright.evaluate(() => {
    const root = document.documentElement
    const computed = getComputedStyle(root)
    return {
      url: location.pathname,
      textLength: document.body.innerText.trim().length,
      theme: root.dataset.appTheme,
      isLight: root.classList.contains('light'),
      isDark: root.classList.contains('dark'),
      primary: computed.getPropertyValue('--ui-primary').trim(),
      bg: computed.getPropertyValue('--ui-bg').trim(),
      antDomCount: document.querySelectorAll('[class*="ant-"]').length,
      themeButtonCount: document.querySelectorAll('[data-testid="theme-menu"]').length,
      controls: document.querySelectorAll('button,input,select,textarea,a').length,
      tables: document.querySelectorAll('.ui-table').length,
      cards: document.querySelectorAll('.ui-card').length,
      canvases: Array.from(document.querySelectorAll('canvas')).map(canvas => ({
        width: canvas.width,
        height: canvas.height
      }))
    }
  })
}

export const runThemeCombination = async (tab, path, themeId, mode, options = {}) => {
  const baseUrl = options.baseUrl || BASE_URL
  await tab.goto(`${baseUrl}${path}?__theme=${themeId}&__mode=${mode}`)
  await tab.playwright.waitForTimeout(600)
  const state = await getPageState(tab)
  assert(state.theme === themeId, `主题未切换到 ${themeId}，当前为 ${state.theme}`)
  assert(mode === 'dark' ? state.isDark : state.isLight, `明暗模式未切换到 ${mode}`)
  assert(state.primary, '未读取到 --ui-primary')
  assert(state.bg, '未读取到 --ui-bg')
  return state
}

export const runPage = async (tab, path, options = {}) => {
  const baseUrl = options.baseUrl || BASE_URL
  await tab.goto(`${baseUrl}${path}`)
  await tab.playwright.waitForTimeout(700)

  const initial = await getPageState(tab)
  assert(initial.textLength > 20, `${path} 页面正文过短，可能未正常渲染`)
  assert(initial.themeButtonCount === 1, `${path} 未找到主题切换按钮`)
  assert(initial.controls > 0, `${path} 未找到可交互控件`)
  assert(initial.antDomCount === 0, `${path} 仍存在 ant-* DOM 类`)
  for (const canvas of initial.canvases) {
    assert(canvas.width > 0 && canvas.height > 0, `${path} 存在空 canvas`)
  }

  const themes = []
  for (const [themeId, mode] of themeMatrix) {
    themes.push(await runThemeCombination(tab, path, themeId, mode, options))
  }

  const errors = await tab.dev.logs({ levels: ['error'], limit: 50 })
  assert(errors.length === 0, `${path} 控制台存在 error: ${errors.map(error => error.message).join(' | ')}`)

  return {
    path,
    initial,
    themes: themes.map(item => ({
      theme: item.theme,
      mode: item.isDark ? 'dark' : 'light',
      primary: item.primary,
      bg: item.bg
    }))
  }
}

export const runAll = async (tab, options = {}) => {
  const results = []
  for (const route of routes) {
    results.push(await runPage(tab, route.path, options))
  }
  return results
}
