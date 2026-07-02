# Netlify + Render 部署说明

## 目标结构

- `Netlify`：部署主站 `Next.js`
- `Render / musicweb-netease-api`：单独从 `Binaryify/NeteaseCloudMusicApi` 或你的 fork 部署
- `Render / musicweb-cache-api`：部署 `fastapi-cache-service`
- `Render / musicweb-media-api`：部署 `render-media-api`
- `Supabase`：继续使用现有数据库与 Storage

## 免费版现实约束

- `Netlify Free` 每月有 credits 限额，用完会暂停。
- `Render Free Web Service` 15 分钟无请求后会休眠，首次访问会冷启动。
- 这套方案适合简历展示、低流量访问，不适合严格生产 SLA。

## Render 部署

1. 把这个部署副本单独建仓库，或推到单独分支。
2. 在 Render 里先用 Blueprint 导入当前仓库根目录的 `render.yaml`。
3. 这一步会创建两个服务：
   - `https://your-cache-api.onrender.com`
   - `https://your-media-api.onrender.com`
4. 再单独新建一个 Render Web Service，仓库选择 `Binaryify/NeteaseCloudMusicApi` 或你自己的 fork。
5. 记录网易云 API 公网地址：
   - `https://your-netease-api.onrender.com`
6. 给 `musicweb-cache-api` 补环境变量：
   - `APP_BASE_URL=https://your-site.netlify.app`
   - `CORS_ALLOWED_ORIGINS=*`
   - `COZE_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` 或等价服务端 key
7. 给 `musicweb-media-api` 补环境变量：
   - `COZE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HTTP_PROXY`
   - `HTTPS_PROXY`
   - 不要设置 `MEDIA_API_URL`，避免自代理循环。
8. 给 `musicweb-netease-api` 按项目需要补它自身环境变量。

## Netlify 部署

1. 在 Netlify 导入同一个仓库。
2. Build command：`pnpm build`
3. Node version：`22`
4. 部署环境变量参考 `.env.deploy.example`。
5. 至少补这些变量：
   - `NEXT_PUBLIC_CACHE_API_URL`
   - `CACHE_API_URL`
   - `NEXT_PUBLIC_NETEASE_API_URL`
   - `NETEASE_API_URL`
   - `MEDIA_API_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SITE_URL`
   - `SITE_URL`
   - `COZE_SUPABASE_URL`
   - `COZE_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_COZE_SUPABASE_URL`
   - `NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `COZE_SUPABASE_SERVICE_ROLE_KEY`

## 上线后优先验证

1. 首页和 `/login`
2. `/admin/login`
3. 歌单列表与缓存请求
4. 网易云聚合入口
5. `yt-dlp` 搜索与解析
6. 下载接口

## 必须处理的安全事项

- 当前代码库里仍有多处硬编码的 Supabase service role key。
- 如果这个部署副本要推送到公开仓库，必须先改成环境变量并轮换旧 key。
- 否则即使网站能上线，也不适合公开展示源码。
