# 现有前端：保留 / 改造 / 弃用 清单

> 给设计师 Claude 的"边界条件"：哪些可以放心保留，哪些要重新设计，哪些直接删。

---

## 一、技术栈层（全部保留）

| 项 | 状态 | 理由 |
|---|---|---|
| Vue 3 + Vite | ✅ 保留 | 稳定、成熟，无需切 Nuxt SSR |
| Nuxt UI 4 组件库 | ✅ 保留 | 已被 6 主题系统适配 |
| Tailwind 4 | ✅ 保留 | 配合 CSS 变量做主题切换 |
| ECharts 6 | ✅ 保留 | 图表能力满足业务 |
| Axios | ✅ 保留 | HTTP 客户端 |
| Vue Router 4 | ✅ 保留 | SPA 路由 |
| VueUse | ✅ 保留 | composable 工具 |
| **新增** Pinia | ⏸ 暂不引入 | 先用 composable + reactive |

---

## 二、6 主题切换系统（完全保留）

| 文件 | 状态 |
|---|---|
| `src/composables/useAppTheme.js` | ✅ 保留 |
| `src/theme/themes.js` | ✅ 保留 |
| `src/theme.css` | ✅ 保留 |
| `src/components/AppThemeMenu.vue` | ✅ 保留 |
| `tests/chrome/nuxtui-migration.chrome.mjs` | ✅ 保留 |

**约束**：所有新页面/组件必须基于 CSS 变量配色，**不允许写死颜色**。

---

## 三、页面级（核心改动）

### 保留 UI 框架，重写数据层（5 页）

| 页面 | 路径 | 改动 |
|---|---|---|
| 总览 | `/dashboard` | 改 API；卡片布局更丰富；按角色显隐"自定义布局保存" |
| 告警中心 | `/alarm` | 改 API + 接 WebSocket；header 铃铛仅红点不闪烁 |
| 遥测查询 | `/telemetry`（原 `/data-viz`） | P5 才有意义；P4 占位 |
| 数据校准 | `/calibration` | 改 API；接 ParseModel.calConfig；写操作仅 admin |
| 日志 | `/log` | P5 落库；P4 占位 |

### 重命名 + 重构（2 页）

| 旧 | 新 | 改动 |
|---|---|---|
| `/data-collection` 数据采集 | `/agent-registry` **采集代理 & 接口** | 左 agent 列表 + 右 instance 流量；启停按钮仅 admin |
| `/data-process` 数据处理 | `/task` **试验任务** | 任务卡 + 激活按钮（admin）；切换查看视角（user） |

### 重构合并（2 页 → 1 页 + 1 新页）

| 旧 | 新 | 改动 |
|---|---|---|
| `/config` 系统配置 + `/__test__/protocol-config` 协议配置 | `/parse-model` **解析模型管理** | 4 tab 编辑器 + ZIP 导入/导出（仅 admin） |
| — | `/system-status` **系统状态**（新） | ingest/business 的 health、吞吐、Disruptor 队列 |

### 弃用（1 页）

| 路径 | 处理 |
|---|---|
| `/user` 用户管理 | **删路由 + 删菜单项 + 删 userApi**。当前 admin 单账号；P5 接入真实登录与 2 角色（admin / user） |

### 测试页

| 路径 | 处理 |
|---|---|
| `/__test__/dashboard` | 保留（dev only） |
| `/__test__/protocol-config` | 弃用 |

---

## 四、API 对象（`src/api/index.js`）

### 重写映射

| 旧 API 对象 | 新动作 |
|---|---|
| `telemetryApi` | 改路径；P5 端点 |
| `interfaceApi` / `channelApi` / `interfaceEventApi` | 替换为 `agentRegistryApi.detail().instances` |
| `protocolConfigApi` | **删除**；合并到 `parseModelApi` |
| `alarmApi` | 改路径；新增 WebSocket 客户端 |
| `processTaskApi` | 重命名 `taskApi`；改路径 `/api/task` |
| `processRuleApi` | **删除**；规则合并到 `parseModelApi.alarmRules` |
| `processedTelemetryApi` | P5 端点 |
| `processLogApi` / `calibrationLogApi` | 合并到 `logApi` |
| `calibrationChannelApi` / `calibrationConfigApi` | **删除**；合并到 `parseModelApi.calConfig` |
| `calibratedTelemetryApi` | 暂保留；P5 接通 |
| `dashboardApi` | Dashboard 总览页数据聚合 |
| `agentApi` | 重命名 `agentRegistryApi`；改路径 |
| `userApi` | **删除** |
| `configApi` | **删除**；系统配置走 yml + actuator |
| `logApi` | 改路径；P5 落地 |

### 新增

| 名称 | 端点 |
|---|---|
| `taskApi` | `/api/task/*` |
| `parseModelApi` | `/api/parse-model/*` |
| `agentRegistryApi` | `/api/agent-registry/*` |
| `wsAlarm` | `ws://nginx/ws/alarm` |
| `wsTelemetry` | `ws://nginx/ws/telemetry` — P5 |

### 迁移策略

1. **第 0 步**：`src/api/http.js` 抽统一 axios + interceptor + X-Task-Id 注入
2. **第 1 步**：新建 `taskApi / parseModelApi / agentRegistryApi`
3. **第 2 步**：旧 API 保留为薄 adapter，内部转调新 API（让旧 page 零改动）
4. **第 3 步**：page 一个个迁；迁完一个删 adapter 一个

---

## 五、组件级

### 保留

- `AppThemeMenu.vue` — 主题切换
- `ToastBridge.vue` — 全局轻提示
- Nuxt UI 内置组件（U-Button / U-Card / U-Table / ...）

### 改造

| 组件 | 改动 |
|---|---|
| `Layout.vue` | header 加任务选择器；告警铃铛接 WebSocket（仅显示红点 + 未读数，**不闪烁**） |
| `DataVisualization.vue` | 改数据源，ECharts 配置不动 |

### 新增

| 组件 | 用途 |
|---|---|
| `WebSocketIndicator.vue` | 右下角 ws 连接状态（绿/灰/红） |
| `TaskSelector.vue` | header 任务下拉 |
| `RoleGate.vue` | 按角色显隐 slot（admin only） |
| `AgentCard.vue` | agent 节点卡（含 instances） |
| `InstanceCard.vue` | 单个采集接口实例卡（流量曲线 + 启停按钮） |
| `ParseModelEditor.vue` | 4 tab JSON 编辑器（Monaco 或 CodeMirror） |
| `AlarmDrawer.vue` | 右侧告警抽屉 |
| `AlarmBell.vue` | header 告警铃铛 + 未读数红点（**无闪烁无响铃**） |

---

## 六、composables（src/composables/）

### 保留

- `useAppTheme.js` — 主题切换

### 新增

| Composable | 用途 |
|---|---|
| `useCurrentTask.js` | 当前任务上下文（localStorage 持久化） |
| `useCurrentUser.js` | 当前用户身份与角色（开发期 localStorage 切换，P5 接登录） |
| `useStream.js` | WebSocket 通用封装（指数退避） |
| `useAlarmStream.js` | WebSocket 告警订阅 |
| `useTelemetryStream.js` | WebSocket 遥测订阅（P5） |
| `usePolling.js` | 周期轮询封装（带可见性暂停） |
| `useAgentRegistry.js` | 代理列表数据源（聚合 polling + ws 状态） |

---

## 七、测试基建

### 保留

- `tests/chrome/nuxtui-migration.chrome.mjs` — 主题 / DOM / CSS 回归

### 新增

| 文件 | 用途 |
|---|---|
| `tests/chrome/api-smoke.chrome.mjs` | 启动 docker-compose 后跑每页，断言 fetch 200 + DOM 有数据 |
| `tests/chrome/role-gate.chrome.mjs` | 切换 admin / user，断言写操作按钮显隐正确 |
| `tests/chrome/websocket.chrome.mjs` | mock server 推送告警，断言前端 UI 响应 |

---

## 八、新文件目录结构（设计参考）

```
frontend/
├── src/
│   ├── api/
│   │   ├── http.js             # 统一 axios + interceptor （新）
│   │   ├── task.js             # taskApi （新）
│   │   ├── agentRegistry.js    # agentRegistryApi （新）
│   │   ├── parseModel.js       # parseModelApi （新）
│   │   ├── alarm.js            # alarmApi （改）
│   │   ├── telemetry.js        # telemetryApi （P5）
│   │   ├── log.js              # logApi （P5）
│   │   └── legacy.js           # 旧 API adapter（迁移期）
│   ├── composables/
│   │   ├── useAppTheme.js      # 保留
│   │   ├── useCurrentTask.js   # 新
│   │   ├── useCurrentUser.js   # 新（角色）
│   │   ├── useStream.js        # 新
│   │   ├── useAlarmStream.js   # 新
│   │   └── usePolling.js       # 新
│   ├── components/
│   │   ├── AppThemeMenu.vue    # 保留
│   │   ├── ToastBridge.vue     # 保留
│   │   ├── TaskSelector.vue    # 新
│   │   ├── RoleGate.vue        # 新
│   │   ├── AlarmBell.vue       # 新
│   │   ├── AlarmDrawer.vue     # 新
│   │   ├── WebSocketIndicator.vue
│   │   ├── AgentCard.vue
│   │   ├── InstanceCard.vue
│   │   └── ParseModelEditor.vue
│   ├── views/Layout.vue        # 改
│   ├── pages/
│   │   ├── Dashboard.vue       # 总览页
│   │   ├── Alarm.vue           # 改
│   │   ├── AgentRegistry.vue   # 新（原 data-collection）
│   │   ├── Task.vue            # 新（原 data-process）
│   │   ├── ParseModel.vue      # 新（原 config + protocol-config 合并）
│   │   ├── Calibration.vue     # 改
│   │   ├── Telemetry.vue       # 改（原 data-viz）
│   │   ├── Log.vue             # 改
│   │   └── SystemStatus.vue    # 新
│   ├── theme.css               # 保留
│   ├── design-system.css       # 新（Design System v1 产出）
│   └── main.js                 # 改（注册新路由）
├── tests/chrome/
│   ├── nuxtui-migration.chrome.mjs
│   ├── api-smoke.chrome.mjs
│   ├── role-gate.chrome.mjs
│   └── websocket.chrome.mjs
└── docs/
    ├── personas.md
    ├── requirements-matrix.md
    ├── api-cheatsheet.md
    ├── brand.md
    ├── keep-discard.md
    ├── design-system.md        # Claude Design 阶段 1 产出
    ├── ia-and-wireframes.md    # Claude Design 阶段 2 产出
    ├── refs/                   # 截图参考
    └── openapi/                # 后端导出的 OpenAPI JSON
```

---

## 九、删除清单（迁移完成后执行）

- [ ] `src/pages/User.vue`
- [ ] `src/pages/Config.vue`（重构后）
- [ ] `src/pages/ProtocolConfig.vue`（重构后）
- [ ] `src/api/index.js` 中已不再使用的对象
- [ ] 路由 / 菜单项中相关条目

---

## 十、不要做的事

- ❌ 切 Nuxt SSR
- ❌ 换组件库
- ❌ "系统配置"和"解析模型"分两页
- ❌ 给 user 页面"补功能让它继续用"（直接弃用）
- ❌ 告警铃声 / 闪烁 / 弹屏
- ❌ 大屏 / 4K / 拼接适配
- ❌ 快捷键
- ❌ 复杂的"工作台 / 角色定制"
