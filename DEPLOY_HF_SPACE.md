# Hugging Face Space 部署

## 目标

使用单个 Hugging Face Docker Space 跑完整演示版：

- `Next.js` 主站
- `NeteaseCloudMusicApi`
- `yt-dlp`
- `ffmpeg`

不再依赖 `Render` 和 `Netlify`。

## 为什么选这个

- 不需要拆多服务
- 免费 CPU Space 一般不要求绑卡
- 单一公网 URL，适合作品集展示

## 必填 Secrets / Variables

在 Hugging Face Space 设置里添加：

- `COZE_SUPABASE_URL`
- `COZE_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_COZE_SUPABASE_URL`
- `NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COZE_SUPABASE_SERVICE_ROLE_KEY`

可选：

- `HTTP_PROXY`
- `HTTPS_PROXY`

## 创建步骤

1. 登录 Hugging Face。
2. 创建一个新的 Space。
3. 选择 `Docker` SDK。
4. 把当前仓库代码推到该 Space 仓库，或从 GitHub 导入本仓库。
5. 在 Space Settings 中填入上面的 Secrets。
6. 等待 Docker 构建完成。

## 说明

- 容器会在启动时后台拉起 `NeteaseCloudMusicApi`。
- 对外只暴露一个端口：`7860`。
- `NETEASE_API_URL` 默认走容器内部的 `http://127.0.0.1:3000`。
