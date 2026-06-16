import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: 'sky',
          secondary: 'indigo',
          success: 'green',
          info: 'blue',
          warning: 'amber',
          error: 'red',
          neutral: 'neutral'
        },
        // ---- 业务系统紧凑基线（全局生效，单页可用 :ui 再覆盖）----
        dashboardNavbar: {
          slots: {
            root: 'px-3 sm:px-3 gap-1.5',
            title: 'text-sm font-medium',
            right: 'gap-1'
          }
        },
        dashboardSidebar: {
          slots: {
            header: 'px-2',
            body: 'px-2 py-2 gap-2',
            footer: 'px-2 py-2'
          }
        },
        dashboardPanel: {
          slots: {
            body: 'gap-3 sm:gap-3 p-3 sm:p-4'
          }
        },
        card: {
          slots: {
            header: 'px-3 py-2 sm:px-3',
            body: 'p-3 sm:p-3',
            footer: 'px-3 py-2 sm:px-3'
          }
        },
        table: {
          slots: {
            th: 'px-3 py-1.5 text-xs font-semibold',
            td: 'px-3 py-1.5 text-[13px]',
            empty: 'py-8 text-sm'
          }
        }
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true
      }
    }
  }
})
