import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../utils/auth'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'data-viz', name: 'DataViz', component: () => import('../components/DataVisualization.vue') },
      { path: 'data-collection', name: 'DataCollection', component: () => import('../views/DataCollection.vue') },
      { path: 'data-process', name: 'DataProcess', component: () => import('../views/DataProcess.vue') },
      { path: 'calibration', name: 'Calibration', component: () => import('../views/Calibration.vue') },
      { path: 'alarm', name: 'Alarm', component: () => import('../views/Alarm.vue') },
      { path: 'config', redirect: '/config/agents' },
      { path: 'config/agents', name: 'AgentRegistry', component: () => import('../views/AgentRegistry.vue') },
      { path: 'config/log', name: 'Log', component: () => import('../views/Log.vue') },
      { path: 'config/user', name: 'User', component: () => import('../views/User.vue') },
      { path: 'log', redirect: '/config/log' },
      { path: 'user', redirect: '/config/user' },
      { path: '__test__/protocol-config', name: 'ProtocolConfigTest', component: () => import('../views/ProtocolConfig.vue') }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.meta.public) {
    if (to.path === '/login' && isAuthenticated()) return '/dashboard'
    return true
  }

  if (!isAuthenticated()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
