import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import './theme.css'
import router from './router'
import uiCompat from './components/ui-compat'
import { applyInitialTheme } from './composables/useAppTheme'
import { loadRuntimeConfig } from './config/runtime'

async function bootstrap() {
  // 预加载运行时配置（必须在 axios/http 创建前完成）
  await loadRuntimeConfig()

  const { default: App } = await import('./App.vue')

  applyInitialTheme()
  const app = createApp(App)
  app.use(router)
  app.use(ui)
  app.use(uiCompat)
  app.mount('#app')
}

bootstrap()
