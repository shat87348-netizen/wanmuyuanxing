import { http } from './http'

export const agentRegistryApi = {
  list:   () => http.get('/agent-registry'),
  detail: (id) => http.get(`/agent-registry/${id}`),
  remove: (id) => http.delete(`/agent-registry/${id}`),
  instanceAction: (id, instanceId, action) => http.post(`/agent-registry/${id}/instance/${instanceId}/${action}`),
}
