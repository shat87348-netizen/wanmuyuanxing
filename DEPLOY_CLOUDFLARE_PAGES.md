# Cloudflare Pages 快速部署

## 推荐设置

Cloudflare Pages 项目建议使用 `main` 分支部署。

在 `Settings -> Build & deployments -> Build settings` 中设置：

```text
Production branch: main
Root directory: /
Build command: npm run build
Build output directory: frontend/dist
```

环境变量：

```text
PUPPETEER_SKIP_DOWNLOAD=1
```

保存后重新部署最新提交。

## 为什么之前部署成功但打不开

之前的部署日志里显示：

```text
Build command: None
Build output directory: /
No build command specified. Skipping build step.
```

这表示 Cloudflare 没有执行 Vite 构建，而是直接上传仓库根目录。根目录没有生产版 `index.html`，所以页面访问不到。

## 快速兜底方案

如果 Cloudflare 项目暂时仍然使用 `cloudflare/workers-autoconfig` 分支，并且构建设置还是：

```text
Build command: None
Build output directory: /
```

可以把 `frontend/dist` 的静态产物发布到该分支根目录。当前仓库已经同步了这个分支，适配 Cloudflare 现有配置。

后续正常开发仍然提交到 `main`，然后重新构建并同步静态产物即可。
