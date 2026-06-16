import { http } from './http'
import { getRuntimeConfig } from '../config/runtime'

const apiUrl = (path) => {
  const base = getRuntimeConfig().apiBaseUrl || '/api'
  return `${base.replace(/\/$/, '')}${path}`
}

export const parseModelApi = {
  get:       (taskId) => http.get(`/parse-model/${taskId}`),
  save:      (taskId, pkg) => http.put(`/parse-model/${taskId}`, pkg),
  exportUrl: (taskId) => apiUrl(`/parse-model/${taskId}/export`),
  import:    (taskId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post(`/parse-model/${taskId}/import`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
