# 后端 API 速查（前端设计输入）

> 基于本仓库 backend/ 当前实现反推。新增端点前先与后端确认。
>
> 完整 OpenAPI 文档由 `tools/export-openapi.ps1` 导出到 `frontend/docs/openapi/`。

---

## 一、business-service（端口 8082）— 前端主要对接

### 1. 试验任务 `/api/task`

| 方法 | 路径 | 用途 | 角色 |
|---|---|---|---|
| POST | `/api/task` | 新建任务 | admin |
| GET  | `/api/task` | 列出全部 | admin / user |
| GET  | `/api/task/{id}` | 查详情 | admin / user |
| PUT  | `/api/task/{id}` | 部分更新 | admin |
| DELETE | `/api/task/{id}` | 删除 | admin |
| POST | `/api/task/{id}/activate` | 激活（互斥） | admin |
| GET  | `/api/task/current` | 当前激活任务 | admin / user |

**Task 字段**：`{id, name, description, model, createdAt, updatedAt, active}`

### 2. 代理注册中心 `/api/agent-registry`

| 方法 | 路径 | 用途 | 角色 |
|---|---|---|---|
| GET  | `/api/agent-registry` | 列出全部 agent | admin / user |
| GET  | `/api/agent-registry/{agentId}` | 查详情 | admin / user |
| POST | `/api/agent-registry/upsert` | ingest 内部调用（前端不直调） | — |
| DELETE | `/api/agent-registry/{agentId}` | 移除（离线） | admin |

**AgentRegistryEntry 字段**：
```
{
  agentId, version, deployForm, host, os, arch,
  firstSeen, lastHeartbeat, memUsage, cpuUsage,
  instances: [
    {
      interfaceInstanceId, protocol, state,
      rxBytes, rxMessages, rxRate, errorCount, lastError
    }
  ]
}
```

`state` 枚举：`RUNNING / STOPPED / ERROR / BLOCKED`

### 3. 解析模型 `/api/parse-model`

| 方法 | 路径 | 用途 | 角色 |
|---|---|---|---|
| GET  | `/api/parse-model/{taskId}` | 查模型包（4 JSON） | admin / user |
| PUT  | `/api/parse-model/{taskId}` | 覆盖保存 | admin |
| GET  | `/api/parse-model/{taskId}/export` | 下载 ZIP | admin / user |
| POST | `/api/parse-model/{taskId}/import` | 上传 ZIP（multipart） | admin |

**ParseModelPackage 字段**：
```
{
  taskId, taskName,
  parseModelJson,   // 参数定义 + 帧布局
  visLayoutJson,    // 可视化布局
  alarmRulesJson,   // 阈值规则
  calConfigJson     // 校准配置
}
```

ZIP 内 entry：`parse_model.json` / `vis_layout.json` / `alarm_rules.json` / `cal_config.json` / `meta.txt`。

### 4. 告警 `/api/alarm`

| 方法 | 路径 | 用途 | 角色 |
|---|---|---|---|
| POST | `/api/alarm/ingest` | ingest 内部调用（前端不直调） | — |
| —— | `/api/alarm` 历史查询 | **P5 待实现** | admin / user |

**Alarm 字段**：
```
{
  level,            // INFO / WARNING / MINOR / MAJOR / CRITICAL
  paramCode, paramName,
  value, thresholdDesc,
  message, timestampMs,
  bid, taskId
}
```

### 5. WebSocket

| 路径 | 用途 | 消息 schema | 角色 |
|---|---|---|---|
| `ws://nginx/ws/alarm` | 告警推送 | JSON 化的 `Alarm` | admin / user |
| `ws://nginx/ws/telemetry` | 遥测推送（P5） | 待定 | admin / user |

**连接策略**：
- 初次失败 1s 后重连，指数退避至 30s
- 心跳：客户端每 30s 发 `ping`

### 6. 自描述与健康

| 方法 | 路径 |
|---|---|
| GET | `/api/info` |
| GET | `/actuator/health` |
| GET | `/actuator/prometheus` |
| GET | `/swagger-ui.html` |

---

## 二、ingest-service（端口 8081）— 前端基本不直调

| 方法 | 路径 | 调用方 |
|---|---|---|
| POST | `/api/agent/register` | agent |
| POST | `/api/agent/heartbeat` | agent |
| POST | `/api/agent/report` | agent |
| —— | UDP 9001 / TCP 9002 | agent（PDXP 直传） |
| GET | `/api/ingest/info` / `/actuator/*` | 运维 / 跳转链接 |

---

## 三、统一约定

### 错误响应

```json
{ "code": "ERR_NOT_FOUND", "message": "task 1001 not found", "traceId": "abc123" }
```

前端 axios interceptor 统一处理 → Toast + 记 traceId。

### 任务上下文

- 所有需要 taskId 的 API 接收 path param 或 query
- 前端 `useCurrentTask()` 统一注入
- axios 默认 header 加 `X-Task-Id`，后端拦截器读 ThreadLocal 简化 controller

### 用户角色

- 开发期：所有请求经 MockAdminFilter 注入固定 admin
- P5：接入真实登录与 2 角色（admin / user）
- 前端：
  - `useCurrentUser()` 拿当前角色
  - 写操作按钮用 `<RoleGate role="admin">` 包裹（不渲染而非 disable）
  - 同时后端有服务端校验（前端只是 UX）

### 分页（P5+）

待加分页接口的统一约定：
- 查询：`?page=0&size=20&sort=field,asc`
- 返回：`{ content: [...], totalElements, totalPages, page, size }`

---

## 四、待补端点清单（设计时可视作"将有"）

- [ ] `GET /api/telemetry/recent?taskId=&satelliteId=&paramCode=&limit=`
- [ ] `GET /api/telemetry/by-param/{code}` — 单参数时序
- [ ] `GET /api/alarm?taskId=&level=&from=&to=&page=` — 告警历史
- [ ] `GET /api/log?level=&from=&to=&page=` — 系统日志
- [ ] `POST /api/agent-registry/{id}/instance/{instanceId}/{action}` — 启停接口（admin only）
- [ ] `POST /api/auth/login` / `GET /api/auth/me` — P5 登录

---

## 五、典型前端调用片段

```javascript
// src/api/http.js
import axios from 'axios'
import { useCurrentTask } from '@/composables/useCurrentTask'

export const http = axios.create({ baseURL: '/api', timeout: 5000 })

http.interceptors.request.use(cfg => {
  const { id } = useCurrentTask()
  if (id) cfg.headers['X-Task-Id'] = id
  return cfg
})

http.interceptors.response.use(
  r => r.data,
  err => { /* 统一 Toast + traceId 记录 */ throw err }
)
```

```javascript
export const taskApi = {
  list:     () => http.get('/task'),
  current:  () => http.get('/task/current'),
  activate: id  => http.post(`/task/${id}/activate`),   // admin
  remove:   id  => http.delete(`/task/${id}`),          // admin
}

export const agentRegistryApi = {
  list:   () => http.get('/agent-registry'),
  detail: id  => http.get(`/agent-registry/${id}`),
  remove: id  => http.delete(`/agent-registry/${id}`),  // admin
}

export const parseModelApi = {
  get:       id  => http.get(`/parse-model/${id}`),
  save:      (id, pkg) => http.put(`/parse-model/${id}`, pkg),   // admin
  exportUrl: id  => `/api/parse-model/${id}/export`,             // <a href> 下载
  import:    (id, file) => {                                      // admin
    const fd = new FormData()
    fd.append('file', file)
    return http.post(`/parse-model/${id}/import`, fd)
  }
}
```

```vue
<!-- 角色门控示例 -->
<RoleGate role="admin">
  <UButton @click="restart" color="warning">重启接口</UButton>
</RoleGate>
```
