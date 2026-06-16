# 前端设计 / 重构资料库

本目录是把前端从 demo 重构为业务系统的全部上下文。所有 Claude Design 任务
都基于这里的文档展开，**不需要附加整个 codebase**。

---

## 系统定位（重要）

- **后台数据处理任务的状态查看与配置管理**
- **不是**值班指控系统：无告警铃声 / 无大屏 / 无快捷键 / 无 4K
- **2 角色**：管理员（admin，全权限）/ 普通用户（user，只读）

---

## 文档清单

| 文件 | 用途 | 谁来更新 |
|---|---|---|
| [personas.md](./personas.md) | 2 个角色 + 权限矩阵 + 操作流 | 业务变化时更新 |
| [requirements-matrix.md](./requirements-matrix.md) | 技术要求 4.4 等条款 ↔ 页面映射 | 后端变了就更新 |
| [api-cheatsheet.md](./api-cheatsheet.md) | 后端 REST/WS 端点速查（含角色） | 后端 controller 变了就更新 |
| [brand.md](./brand.md) | 主题 / 告警色 / 字体 / 反模式（甲方无 VI） | 一次定稿 |
| [keep-discard.md](./keep-discard.md) | 现有前端"保留/改造/弃用"清单 | 迁移完成后更新 |
| openapi/ | 后端导出的 OpenAPI JSON | 由脚本生成 |
| refs/ | 截图参考（现状） | 由脚本生成 |
| design-system.md | **阶段 1 产出**（Design System v1） | Claude Design |
| ia-and-wireframes.md | **阶段 2 产出**（信息架构 + 线框） | Claude Design |
| mockups/ | **阶段 3 产出**（每页 HTML mockup） | Claude Design |

---

## 启动 Claude Design 的标准流程

### 1. 准备 Claude.ai Project

- **不要** `attach codebase`（成本暴涨 5-10×）
- 手动上传：本目录的 5 份基础文档 + `refs/` 截图 + `openapi/` JSON
- 在 Project 的 Custom Instructions 里加：

```
你是数据处理软件前端 UI/UX 设计师。
约束（务必遵守）：
1. 不要询问澄清问题，按上下文做合理假设并标注 ASSUMPTION
2. 不要解释设计原理，只给产物 + 必要的 1-2 行 inline 注释
3. 单次回答 ≤ 1 个核心产物（design-system OR ia OR 一个页面，不要混）
4. 输出 markdown 或代码块，避免冗余客套
5. 颜色不允许硬编码，必须用 CSS var（与 frontend/src/theme.css 兼容）
6. 任何 API 字段必须能在 api-cheatsheet.md 找到对应；找不到的标 ASSUMPTION
7. 写操作按钮必须用 <RoleGate role="admin"> 包裹
8. 不要做告警铃声/闪烁/4K大屏/快捷键 — 本系统是后台管理类
```

### 2. 阶段 1（Design System v1）

发送 prompt：基于 5 份文档，产出 Design System v1 → `design-system.md` + `design-system.css`。

走读 → 调整 → 锁定。

### 3. 阶段 2（信息架构 + 线框）

产出 `ia-and-wireframes.md`（ASCII 线框 + 跨页交互）。

走读 → 调整 → 锁定。

### 4. 阶段 3（高保真 + Vue SFC，逐页）

按优先级顺序：
1. 总览 (Overview)
2. 告警中心 (Alarm)
3. 采集代理 & 接口 (AgentRegistry)
4. 试验任务 (Task)
5. 解析模型管理 (ParseModel)
6. 数据校准 (Calibration)
7. 遥测查询 (Telemetry) — P5
8. 日志中心 (Log) — P5
9. 系统状态 (SystemStatus)

每页产出 `mockups/{page}.html` + Vue SFC 草稿。

---

## 节流提示

| 做法 | 单次 token 消耗 | 全设计估算 |
|---|---|---|
| attach 整个 codebase | 80K-120K | 50-100 美元 |
| 手动附本目录 5 文档 + refs | 15K-25K | 8-15 美元 |
| 同上 + 严格 system prompt | 8K-15K | 3-6 美元 |

---

## 截图与 OpenAPI 导出（自动化脚本）

```
tools/
├── screenshot-current-frontend.ps1   # 启动 dev server 后截图所有路由
└── export-openapi.ps1                # 启动 backend 后 curl /v3/api-docs 落 JSON
```
