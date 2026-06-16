import axios from 'axios'
import { getRuntimeConfig, isMockEnabled } from '../config/runtime'
import { getAuthToken } from '../utils/auth'

let mockAdapterPromise = null

function getMockAdapter() {
  if (!mockAdapterPromise) {
    mockAdapterPromise = import('../mock').then(mod => mod.mockAdapter)
  }
  return mockAdapterPromise
}

export const http = axios.create({
  baseURL: getRuntimeConfig().apiBaseUrl,
  timeout: 10000,
})

http.interceptors.request.use(async cfg => {
  const tid = localStorage.getItem('currentTaskId')
  if (tid) {
    cfg.headers = cfg.headers || {}
    cfg.headers['X-Task-Id'] = tid
  }

  const token = getAuthToken()
  if (token) {
    cfg.headers = cfg.headers || {}
    cfg.headers.Authorization = `Bearer ${token}`
  }

  if (isMockEnabled()) {
    cfg.adapter = await getMockAdapter()
  }

  return cfg
})

http.interceptors.response.use(
  res => res.data,
  err => {
    console.error('[api]', err?.response?.status, err?.config?.url, err.message)
    return Promise.reject(err)
  }
)
