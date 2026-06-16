import { http } from './http'

export const taskApi = {
  list:     () => http.get('/task'),
  get:      (id) => http.get(`/task/${id}`),
  current:  () => http.get('/task/current').catch(() => null),
  create:   (body) => http.post('/task', body),
  update:   (id, patch) => http.put(`/task/${id}`, patch),
  remove:   (id) => http.delete(`/task/${id}`),
  activate: (id) => http.post(`/task/${id}/activate`),
}
