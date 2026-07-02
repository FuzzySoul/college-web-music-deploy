# 音乐网站架构分析

## ⚠️ 重要提示 / Important Note

**所有回答必须使用中文。All responses must be in Chinese.**

## ⚠️ ffmpeg 配置

### 下载完成
- **解压路径**: `C:/Users/62003/ffmpeg/bin/ffmpeg.exe`
- **代理地址**: `192.168.124.3:8080`

### 使用方式
在需要调用 ffmpeg 的命令前添加：
```bash
# Windows PowerShell
$env:HTTP_PROXY="http://192.168.124.3:8080"
$env:HTTPS_PROXY="http://192.168.124.3:8080"

# 或者直接使用完整路径
C:/Users/62003/ffmpeg/bin/ffmpeg.exe -i input.mp3 output.wav
```

### yt-dlp 代理配置
```bash
# 使用代理下载视频/音频
yt-dlp --proxy "http://192.168.124.3:8080" "视频URL"

# 获取下载链接（不下载）
yt-dlp --proxy "http://192.168.124.3:8080" -g "视频URL"
```

### ⚠️ B站特殊配置
**B站（bilibili.com）绝对不能使用代理**，会触发防爬机制导致请求失败！

在 `route.ts` 中，B站请求必须：
- 不使用代理（`{ }` 空选项）
- 添加必要的 Headers（User-Agent, Referer, Origin）

示例：
```typescript
const options = isBilibili ? {
  headers: [
    'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer:https://www.bilibili.com',
    'Origin:https://www.bilibili.com'
  ]
} : { proxy: PROXY }
```

---

## ⚠️ 开发服务器注意事项

**Next.js 支持热更新**，修改代码后页面会自动刷新，**不需要重启服务器**。

- 修改 `.env.local` 等配置文件时需要重启
- 修改代码文件时自动热更新
- 如遇端口占用（EADDRINUSE），使用 `taskkill //F //PID <PID>` 杀死占用进程

## ⚠️ Supabase配置关键要点（避免错误）

### 1. Next.js API路由中访问环境变量

**错误方式**：
```typescript
const supabaseUrl = process.env.COZE_SUPABASE_URL;
const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
```

**正确方式**（使用方括号语法）：
```typescript
const supabaseUrl = process.env['COZE_SUPABASE_URL'];
const supabaseKey = process.env['COZE_SUPABASE_ANON_KEY'];
```

原因：Next.js在build时会对process.env进行内联，使用方括号语法可以避免undefined。

### 2. API路由中使用service_role key

**anon key** 只能在客户端或有限权限的查询中使用。
**service_role key** 可以在服务端API中绕过RLS策略。

```typescript
// /api/admin/route.ts 中使用
function getSupabase() {
  const supabaseUrl = 'https://ddquqhpbykuhghqdvyeh.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...service_role_key...';
  return createClient(supabaseUrl, supabaseKey);
}
```

### 3. 当前Supabase配置信息

```
Project URL: https://ddquqhpbykuhghqdvyeh.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcXVxaHBieWt1aGdocWR2eWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjA4MDQsImV4cCI6MjA4NzUzNjgwNH0.k8f5JqPeUTKTiouBw1n9tUimCNA-k__o-FtH2ZwZTiI
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcXVxaHBieWt1aGdocWR2eWVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk2MDgwNCwiZXhwIjoyMDg3NTM2ODA0fQ.ATE-hT4U4qXqdyv4bb9SNFQRkuuKljv0VtbdFDCkDhY
```

### 4. 环境变量命名

项目中使用的环境变量：
- `COZE_SUPABASE_URL` - 服务端专用URL
- `COZE_SUPABASE_ANON_KEY` - 服务端anon key
- `NEXT_PUBLIC_COZE_SUPABASE_URL` - 客户端URL
- `NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY` - 客户端anon key

## ⚠️ 需求确认原则

**不确切的信息要反复询问用户确认后再实现**，包括但不限于：
- 功能范围不明确时
- 技术方案有多种选择时
- 涉及第三方服务/账号时
- 可能有法律或稳定性风险时

---

## 项目概览

**项目名称**: College Web Music
**项目根目录**: `F:\code\College Web\projects`
**技术栈**: Next.js 16.1.1 + TypeScript + Supabase + Drizzle ORM

## 核心文件结构

### 数据库层

```
src/storage/database/
├── supabase-client.ts      # Supabase 客户端创建工具
└── shared/
    └── schema.ts            # Drizzle ORM 表定义
```

### 业务逻辑层

```
src/lib/
├── music-service.ts      # 音乐库服务（歌曲、歌单、收藏）
└── rhythm-sync.ts      # 音游同步服务（节拍谱面）
```

## 数据库表结构（当前使用中）

### 核心表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `tracks` | 音乐库 | title, artist, album, cover, duration, play_url, audio_url |
| `artists` | 歌手 | name, alias, image, description |
| `playlists` | 歌单 | user_id, name, description, cover, is_public |
| `playlist_tracks` | 歌单-歌曲关联 | playlist_id, track_id, position |
| `favorites` | 收藏 | user_id, track_id |
| `albums` | 专辑 | name, artist, cover, release_year |
| `admin_users` | 管理员账户 | username, password_hash, role |
| `rhythm_charts` | 音游谱面 | track_id, difficulty, note_speed, notes (JSON) |
| `users` | 注册用户 | username, email, role (暂未开放注册) |



### Supabase MCP使用

**所有数据库操作通过Supabase MCP进行**，确保数据真实性。

### API路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/admin` | POST | 管理员登录验证 |
| `/api/admin` | GET | 获取管理数据 |
| `/api/admin` | DELETE | 删除数据 |
| `rhythm_charts` | 音游谱面 | track_id, difficulty, notes (JSON) |
| `sync_logs` | 同步日志 | total_tracks, tracks_with_charts |
| `health_check` | 健康检查 | updated_at |

## 当前实现方式（已统一）

### 配置获取方式

所有模块统一通过 `/api/supabase/config` API 路由获取 Supabase 配置：

| 模块 | 文件路径 | 配置获取方式 |
|------|----------|--------------|
| 音乐上传 | `api/music/upload/route.ts` | API 路由 |
| 音乐服务 | `lib/music-service.ts` | API 路由 |
| 音游同步 | `lib/rhythm-sync.ts` | API 路由 |
| 音游谱面 | `api/rhythm/charts/route.ts` | API 路由 |
| 音游歌曲 | `api/rhythm/songs/route.ts` | API 路由 |

### 配置流程

1. 客户端/服务端代码调用 `/api/supabase/config`
2. API 路由从环境变量读取 `COZE_SUPABASE_URL` 和 `COZE_SUPABASE_ANON_KEY`
3. 返回配置给请求方

## 已解决的问题

### ✅ 配置统一问题已修复

所有模块现在都使用统一的配置获取方式，便于管理和维护。

## 已知问题（待修复）

### 🔴 关键问题：配置获取方式不一致

| 服务 | 配置获取方式 | 降级行为 |
|------|--------------|----------|
| 音乐服务 | API 路由 (`/api/supabase/config`) | 返回空数组 |
| 音游同步 | 环境变量 (`process.env`) | 返回模拟数据对象 |

### 影响

1. **音游功能无法使用**: 音游同步客户端总是从环境变量读取，如果环境变量未设置，立即返回 null
2. **音乐库功能正常**: 音乐服务从 API 路由动态获取配置，可以正常工作
3. **数据无法共享**: 两者可能连接到不同的 Supabase 项目，或者其中一个无法连接

### 环境变量

```bash
# .env.example
COZE_SUPABASE_URL=your-supabase-url
COZE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 登录系统设计

### 认证方案

- **用户认证**: 使用 Supabase Auth
- **数据库操作**: 使用 Supabase MCP（通过MCP工具直接操作数据库）
- **管理员认证**: 使用数据库表 `admin_users` 验证，通过API路由 `/api/admin`
- **重要**: 所有管理后台数据来自真实Supabase数据库，不是模拟数据

### 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 登录选择 | 用户登录/管理员登录入口 |
| `/login` | 用户登录 | 邮箱/密码、记住我、忘记密码、注册、第三方登录 |
| `/admin/login` | 管理员登录 | 用户名/密码，从`admin_users`表验证 |
| `/home` | 用户主页 | 登录后跳转（原主页内容） |
| `/admin` | 管理员后台 | 从Supabase获取真实数据，管理用户/歌手/歌曲/歌单 |

### 管理员功能

1. **用户管理**: 查看、编辑、删除用户（从`users`表）
2. **歌手管理**: 增删改歌手信息（从`artists`表）
3. **歌曲管理**: 增删改歌曲信息（从`tracks`表）
4. **歌单管理**: 增删改歌单信息（从`playlists`表）

### 默认管理员账户

- 用户名: `admin`
- 密码: `admin123`
- 数据库表: `admin_users`

---

## 下一步行动

1. ✅ 分析现有代码结构
2. ✅ 生成 agents.md 总结文档
3. ✅ 决定最佳配置策略（统一使用 API 路由获取配置）
4. ✅ 修复音频播放器空 src 错误
5. ✅ 修复删除按钮可见性问题（添加 opacity-0.5）
6. ✅ 配置 Supabase MCP 远程服务器模式
7. ✅ 统一所有模块使用 API 路由获取配置
8. ✅ 测试删除功能（在浏览器中验证）
9. ✅ 测试上传功能
10. ✅ 创建用户登录页面 /login
11. ✅ 创建管理员登录页面 /admin/login
12. ✅ 创建管理员后台页面 /admin（美学已统一为米白色+Claude橙风格）

## 技术债务

- [x] 添加调试日志帮助定位问题
- [x] 修复删除按钮可见性
- [x] 修复音频播放器 src 空值处理
- [x] 统一 rhythm-sync.ts 配置获取方式
- [x] 统一 rhythm/charts/route.ts 配置获取方式
- [x] 统一 rhythm/songs/route.ts 配置获取方式
- [x] 统一 music/upload/route.ts 配置获取方式
- [ ] 添加 TypeScript 类型定义文件

## Supabase MCP 配置

### 方式一：使用 npx（推荐）

在 Claude Code 或其他 MCP 客户端的配置文件中添加：

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "你的Supabase个人访问令牌"
      }
    }
  }
}
```

### 方式二：使用远程 MCP 服务器

Supabase 提供托管的 MCP 服务器：

```
Server URL: https://mcp.supabase.com/mcp
```

### 配置步骤

1. 前往 Supabase 设置创建个人访问令牌 (PAT)
2. 将令牌添加到 MCP 客户端配置
3. 配置完成后，AI 助手可以直接查询 Supabase 数据库

### 测试 MCP 连接

配置完成后，可以直接在 AI 助手（如 Claude Code）中执行：

```sql
SELECT * FROM tracks LIMIT 5;
```

### 本地 Supabase 链接

- **URL**: https://ddquqhpbykuhghqdvyeh.supabase.co
- **API 端点**: http://localhost:5000/api/supabase/config（项目内）
- **Storage Bucket**: music（公开）

## 调试日志

调试时检查浏览器控制台：
- `Delete clicked:` - 删除按钮被点击
- `Delete button clicked for track:` - 删除按钮被点击（带 track ID）
- `Calling API:` - API 调用
- `Delete response:` - API 响应状态
- `Audio load error:` - 音频加载错误

---

## 第三方音乐API接入（歌单聚合功能）

### 功能需求

在音游模块下方添加歌曲聚合功能：
1. 添加网易云音乐和QQ音乐聚合入口
2. 用户扫码登录自己的账号 → 获取个人歌单及歌曲名称
3. 数据存储到 Supabase 数据库

### 技术方案

#### 核心开源项目

| 项目 | Stars | 功能 | 部署方式 |
|------|-------|------|-----------|
| **NeteaseCloudMusicApi** (binaryify) | 15k+ | 网易云音乐扫码登录、获取歌单 | Vercel/本地/Docker |
| **wp_MusicApi** (GitHub-ZC) | - | QQ音乐扫码登录、获取歌单 | 本地/服务器 |

#### 实现原理

```
用户点击登录 → 获取二维码 → 用户扫码 → 轮询状态 → 登录成功 → 获取歌单 → 存储到Supabase
```

#### 部署方案

**方式一：Vercel 部署（推荐，免费）**
- 部署 NeteaseCloudMusicApi 到 Vercel
- 优点：免费、无需服务器
- 缺点：某些功能可能受限

**方式二：本地部署**
- 在本地运行 Node.js 服务
- 优点：功能完整、稳定
- 缺点：需要保持服务运行

#### 关键接口

1. **二维码登录流程**
   - `/login/qr/key` - 获取二维码 key
   - `/login/qr/create` - 生成二维码图片
   - `/login/qr/check` - 轮询扫码状态

2. **获取用户歌单**
   - `/user/playlist` - 获取用户所有歌单
   - `/playlist/track/all` - 获取歌单内歌曲

### 数据库设计

```sql
-- external_platforms 表
CREATE TABLE external_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL, -- 'netease' | 'qq'
  user_id VARCHAR(255), -- 平台用户ID
  nickname VARCHAR(255),
  avatar_url TEXT,
  cookie TEXT, -- 登录cookie（加密存储）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- external_playlists 表
CREATE TABLE external_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES external_platforms(id),
  platform_playlist_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  cover_url TEXT,
  track_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- external_playlist_tracks 表
CREATE TABLE external_playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES external_playlists(id),
  track_title VARCHAR(255) NOT NULL,
  track_artist VARCHAR(255),
  track_duration INTEGER,
  platform_track_id VARCHAR(255),
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 实现步骤

1. ✅ 调研第三方 API 方案
2. ⏳ 部署 NeteaseCloudMusicApi 服务（Vercel部署的API无法访问）
3. ✅ 数据库表已创建
4. ✅ 创建登录组件（手机验证码登录）
5. ⏳ 测试手机验证码登录

---

## 搜索结果总结

### 网易云API QR登录问题

**问题根源**: Vercel部署的API无法访问，导致二维码key获取失败

**类似问题**:
- Binaryify/NeteaseCloudMusicApi Issue #1748 - 二维码登录失效
- foamzou/melody Issue #143 - 账号无法登录，QR码状态801/802

### 解决方案

采用手机验证码登录替代二维码登录：
1. `/captcha/sent?phone=xxx` - 发送验证码
2. `/login/cellphone?phone=xxx&captcha=xxx` - 验证登录

### 创建的文件

- `src/hooks/usePhoneLogin.ts` - 手机验证码登录Hook
- `src/components/music/PlatformLogin.tsx` - 更新为支持手机登录
7. ⏳ 集成到前端页面

---

## OpenCode 网络访问问题（身处中国大陆）

### 问题描述

OpenCode 无法访问境外网站（GitHub、Vercel等），但用户本地浏览器可以正常访问。

### 解决方案

**方法1：配置代理环境变量**

在启动 OpenCode 前设置代理：

```bash
# 设置代理（替换为你的代理地址）
export HTTP_PROXY="http://192.168.124.3:8080"
export HTTPS_PROXY="http://192.168.124.3:8080"

# 必须排除本地地址
export NO_PROXY="localhost,127.0.0.1,::1"
```

**方法2：使用本地模型（推荐）**

配置使用 Ollama 等本地模型，避免访问境外 API：

```json
{
  "models": {
    "provider": "ollama",
    "baseURL": "http://localhost:11434",
    "models": ["deepseek-coder", "qwen2.5-coder-7b"]
  }
}
```

**方法3：使用代理服务**

- V2Ray / Clash Verge
- Sing-box
- 商业代理服务

### 相关文档

- [OpenCode 网络配置官方文档](https://open-code.ai/en/docs/network)
- [GitHub Issue #6953](https://github.com/anomalyco/opencode/issues/6953) - OpenCode 代理配置问题

---

## 网易云音乐API文档

### 基础信息

- **项目地址**: https://github.com/Binaryify/NeteaseCloudMusicApi
- **本地服务**: http://localhost:3000

### 核心接口

| 接口 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/captcha/sent` | GET | phone | 发送手机验证码 |
| `/login/cellphone` | GET | phone, captcha | 手机验证码登录 |
| `/login/qr/key` | GET | timestamp | 获取二维码key |
| `/login/qr/create` | GET | key, qrimg | 生成二维码 |
| `/login/qr/check` | GET | key | 检查扫码状态 |
| `/user/playlist` | GET | uid | 获取用户歌单 |
| `/playlist/track/all` | GET | id, limit | 获取歌单歌曲 |

### 完整API文档

部署后可访问: `http://localhost:3000/docs/`

### 常用调用示例

```bash
# 发送验证码
curl "http://localhost:3000/captcha/sent?phone=13800000000"

# 验证码登录
curl "http://localhost:3000/login/cellphone?phone=13800000000&captcha=123456"

# 获取用户歌单
curl "http://localhost:3000/user/playlist?uid=用户ID"
```

---

## YouTube/Bilibili搜索数量配置

### 问题描述

用户播放外部歌单时，希望只从YouTube搜索1个链接，不搜索Bilibili。

### 问题根因

项目中有两套搜索逻辑：
1. **流式搜索逻辑** (GET `/api/music/ytdlp`) - 实际使用的
2. **异步任务搜索** (POST `/api/music/ytdlp`) - 后台任务

前端传递了参数，但后端默认值为2，导致仍然搜索Bilibili。

### 解决方案

#### 1. 修改后端默认参数 (`src/app/api/music/ytdlp/route.ts`)

**GET流式搜索默认参数** (约600行):
```typescript
const youtubeCountParam = searchParams.get('youtube_count') || searchParams.get('youtubeCount') || '1'
const bilibiliCountParam = searchParams.get('bilibili_count') || searchParams.get('bilibiliCount') || '0'

const youtubeCount = Math.min(Math.max(parseInt(youtubeCountParam) || 1, 0), 10)
const bilibiliCount = Math.min(Math.max(parseInt(bilibiliCountParam) || 0, 0), 10)
```

**executeSearchAsync默认参数** (约318行):
```typescript
async function executeSearchAsync(
  taskId: string, 
  query: string, 
  youtubeCount: number = 1, 
  bilibiliCount: number = 0
): Promise<void> {
```

**POST异步任务默认参数** (约421行):
```typescript
youtube_count: youtubeCount || 1,
bilibili_count: bilibiliCount || 0,
```

#### 2. 修改前端调用 (`PlaylistManager.tsx`)

```typescript
const response = await fetch(`/api/music/ytdlp?q=${encodeURIComponent(query)}&youtube_count=${youtubeCount}&bilibili_count=${bilibiliCount}`, {
```

#### 3. 添加用户设置UI

在PlaylistManager中添加搜索数量输入框：
```typescript
const [youtubeCount, setYoutubeCount] = useState(1);
const [bilibiliCount, setBilibiliCount] = useState(0);
```

### URL参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `youtube_count` | YouTube搜索数量 (0-10) | 1 |
| `bilibili_count` | Bilibili搜索数量 (0-10) | 0 |

### 测试验证

```bash
curl "http://localhost:5000/api/music/ytdlp?q=test&youtube_count=1&bilibili_count=0"
```

预期日志：
```
[Stream] Starting streaming search for: test YouTube count: 1 Bilibili count: 0
[yt-dlp] Trying YouTube with query: test, maxCount: 1
[yt-dlp] YouTube found 1 results
[Stream] Skipping Bilibili: count is 0
```
