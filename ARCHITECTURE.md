# ARCHITECTURE

> 老大毕设：音乐 Web 应用 · 基于真实代码扫描 · 2026-07-02 自动生成
> 写不出来的部分就标"未读",不靠文件名脑补。

## 1. 一句话总览

Next.js 15 全栈 + FastAPI 缓存代理 + Supabase Postgres 的音乐播放/收藏/评论/上传/节奏游戏 Web 应用,前端直连 Supabase,FastAPI 只在 :8000 做一层内存缓存。

## 2. 技术栈 (从 package.json + main.py 验证)

| 层 | 技术 | 端口 | 证据 |
|---|---|---|---|
| 前端 | Next.js 15 (App Router) + Turbopack + TypeScript | 5000 | `package.json` scripts |
| UI 组件 | Radix UI + class-variance-authority + Tailwind (隐含) | - | package.json 依赖 |
| 播放 | dashjs (DASH 协议) | - | `^5.1.0` 依赖 |
| 后端 API | Next.js API Routes (route.ts) | 5000 | 48 个 route.ts |
| 缓存代理 | FastAPI + httpx + uvicorn | 8000 | `fastapi-cache-service/main.py` |
| 数据库 | Supabase (远程 Postgres) | REST | `src/storage/database/shared/schema.ts` |
| ORM/类型 | Drizzle ORM (schema 定义) | - | `drizzle-orm/pg-core` import |
| 鉴权 | 自定义 header (`x-user-id`/`x-username`/`x-is-admin`) | - | `src/app/api/comments/route.ts:30-39` |
| 外部 | 网易云 API (`:3000`) · MusicBrainz · yt-dlp · Supabase Auth | - | netease/[...path]/route.ts |
| 媒体 | 头像=Supabase Storage,音频/MV=**本地文件系统** | - | 见 §6 |

## 3. 目录结构 (从 scan 验证)

```
projects/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # 根重定向
│   │   ├── login/                    # 用户登录
│   │   ├── home/                     # 前台 (14 页)
│   │   │   ├── page.tsx              #   主页
│   │   │   ├── albums/               #   专辑列表/详情/按名查
│   │   │   ├── artists/              #   艺人
│   │   │   ├── playlists/            #   歌单
│   │   │   ├── favorites/            #   收藏
│   │   │   ├── local-music/          #   本地音乐
│   │   │   ├── rhythm/               #   节奏游戏入口
│   │   │   ├── explore/              #   发现
│   │   │   ├── stats/                #   听歌统计
│   │   │   ├── profile/              #   个人中心
│   │   │   ├── aggregation/          #   歌单聚合
│   │   │   ├── import/               #   导入
│   │   │   └── discover/             #   探索
│   │   ├── admin/                    # 后台 (11 页)
│   │   │   ├── login/                #   后台登录
│   │   │   ├── layout.tsx            #   鉴权 layout
│   │   │   ├── page.tsx              #   后台首页
│   │   │   ├── albums/ artists/ tracks/ playlists/ users/
│   │   │   ├── stats/ comments/ forbidden-words/
│   │   │   ├── banners/ local-music/
│   │   └── api/                      # 48 个 route.ts
│   │       ├── music/                #   24 个 (专辑/艺人/歌单/上传/sync/搜索/下载/yt-dlp)
│   │       ├── netease/              #   7 个 (网易云对接)
│   │       ├── admin/                #   8 个 (后台专用)
│   │       ├── user/                 #   5 个 (用户/头像/密码/profile)
│   │       ├── rhythm/               #   3 个 (节奏游戏: songs/charts/sync)
│   │       ├── stats/                #   2 个 (track-play/tracks)
│   │       ├── comments/             #   1 个 (含软删)
│   │       ├── download/             #   1 个
│   │       ├── explore/              #   1 个
│   │       └── supabase/config/      #   1 个 (把 env 暴露给浏览器)
│   ├── components/music/             # 33 个 React 组件
│   │   ├── MusicPlayer.tsx           #   核心播放器
│   │   ├── Sidebar.tsx TopBar.tsx    #   布局
│   │   ├── PlaylistManager.tsx       #   歌单管理
│   │   ├── LocalMusicUploader.tsx    #   本地上传
│   │   ├── RhythmGame.tsx            #   节奏游戏
│   │   ├── CommentSection.tsx CommentItem.tsx  #   评论
│   │   ├── MusicCard.tsx / MusicImporter.tsx / MusicAggregator.tsx
│   │   ├── LyricsDisplay/Editor/SearchModal
│   │   ├── PlatformLogin.tsx / PlatformIcons.tsx
│   │   └── stores/useBackButtonStore.ts  #   zustand
│   ├── hooks/useComments.ts
│   ├── types/comment.ts
│   ├── lib/
│   │   ├── cache-fetch.ts            # ★ FastAPI 缓存客户端 (27 行)
│   │   ├── supabase-browser.ts       #   浏览器 Supabase client
│   │   ├── music-service.ts          #   音乐数据服务层
│   │   └── rhythm-sync.ts            #   节奏游戏同步
│   ├── storage/database/shared/
│   │   └── schema.ts                 # ★ Drizzle 表定义 (15 表)
│   └── .next/                        # 构建产物
├── fastapi-cache-service/            # 独立 Python 服务
│   ├── main.py                       # 1177 行 FastAPI 入口
│   ├── cache.py                      # 内存 LRU + stale-while-revalidate
│   ├── config.py                     # Supabase URL + key (硬编码)
│   ├── cache/ data/ .venv/
│   └── start.sh startup.log
├── public/music/
│   ├── local/                        # 上传的 mp3 (本地存储,非 S3)
│   └── mv/                           # 上传的 mp4
├── tracks500.json                    # 种子数据
├── er-diagram.puml                   # 已有 ER 图
├── package.json + tsconfig.json
└── ARCHITECTURE.md                   # 本文件
```

## 4. 数据流 (从代码验证,不脑补)

### 4.1 用户播放音乐

```
浏览器 (MusicPlayer.tsx)
  ↓ fetch GET
/api/music/playlist-tracks?playlist_id=X
  ↓ supabase.from('playlist_tracks').select(...tracks!inner(...))
  ↓ cacheFetch → :8000/api/cache/<key>     ← 命中则直接返,不命中查 Supabase
  ↑ JSON
```

**关键**: 缓存命中走 `:8000`,未命中走 Supabase REST。FastAPI 挂了前端会自己 fallback 到 Supabase (因为 `cacheFetch` 的 `catch` 返 `null`,业务代码继续走 Supabase 路径)。但**部分 API 没有走 cacheFetch**,所以那些 FastAPI 挂了不会立刻爆。

### 4.2 网易云搜索/播放

```
浏览器
  ↓ fetch
/api/netease/[...path]   (catch-all)
  ↓ fetch GET http://localhost:3000/<path>  (环境变量 NEXT_PUBLIC_NETEASE_API_URL)
  ↑ 网易云返回 JSON 原样透传
```

**直连网易云,不走 FastAPI。** 部署时需要本地跑一个网易云 API 服务 (NeteaseCloudMusicApi 之类) 在 `:3000`。

### 4.3 评论提交

```
浏览器
  ↓ POST /api/comments
    Header: x-user-id / x-username / x-is-admin   ← 客户端自定义,无 JWT 验证
  ↓ 1) FastAPI :8000/api/cache/forbidden-words (违禁词, 1.5s 超时)
     2) 失败/超时 → 直接查 Supabase forbidden_words 表
     3) 内容检查 → 插入 comments 表
  ↓ cacheInvalidate(['comments'])
```

**鉴权形同虚设**: 用户传什么 header 就信什么。生产环境不能用,毕设够。

### 4.4 本地音乐上传

```
浏览器 (LocalMusicUploader.tsx)
  ↓ POST /api/music/local-tracks/upload/audio
    FormData: file
  ↓ writeFile + mkdir (写到 public/music/local/)   ← 本地文件系统!
  ↓ 创建 DB 记录
  ↑ 返回 fileUrl
```

**音频和 MV 都存到本地 `public/music/`,不是 S3** (虽然 package.json 里有 `@aws-sdk/client-s3` 但实际没用到)。`avatar/upload` 走的是 Supabase Storage。

### 4.5 节奏游戏

```
浏览器
  ↓ /api/rhythm/songs        → 曲库列表
  ↓ /api/rhythm/charts       → 谱面 (notes: jsonb)
  ↓ /api/rhythm/sync         → 同步
  ↓ client: RhythmGame.tsx   → 客户端判定
```

## 5. 数据模型 (Drizzle schema.ts · 15 表)

**核心表** (从 schema.ts 读出):

| 表 | 关键字段 | 用途 |
|---|---|---|
| `tracks` | title, artist, album, source('local'/'netease'/'mb'), source_id, play_url, audio_url, lyrics, mv_url, has_chart, chart_difficulties | 主歌曲表 |
| `playlists` | name, user_id, is_public, platform_source, external_playlist_id | 歌单 |
| `playlist_tracks` | playlist_id, track_id, position | 歌单-曲目关联 |
| `favorites` | track_id, user_id | 收藏 |
| `playlist_favorites` | playlist_id, user_id | 歌单收藏 |
| `play_history` | track_id, user_id, played_at, duration_played | 播放历史 |
| `artists` | name, alias, image, musicbrainz_id, mb_synced_at | 艺人 |
| `albums` | name, artist, cover_url, track_count, year | 专辑 |
| `rhythm_charts` | track_id, difficulty, note_speed, judgment_window, **notes (jsonb)** | 节奏游戏谱面 |
| `comments` | content, user_id, username, target_type, target_id, parent_id, is_deleted | 通用评论 (支持多态 target) |
| `external_platforms` | platform, platform_user_id, nickname, **cookie (text)** | 外部平台绑定 (存 cookie!) |
| `external_playlists` | platform_id, platform_playlist_id, name | 外部歌单 |
| `external_playlist_tracks` | playlist_id, track_title, track_artist, platform_track_id, position | 外部曲目 |
| `forbidden_words` | word | 评论违禁词 |
| `health_check` | updated_at | 健康检查占位表 |

**关系** (从 er-diagram.puml 确认):
- user 1—n playlist, n—m track (通过 playlist_tracks)
- user 1—n favorites/play_history/comment
- artist 1—n track, album 1—n track
- external_platform 1—n external_playlist 1—n external_playlist_tracks
- admin 是隐含角色,通过 `x-is-admin` header 标识

## 6. 鉴权现状 (要警示一下)

**鉴权是毕设的最大软肋**:
- ❌ 没用 Supabase Auth SDK 验证 JWT
- ❌ 没用 NextAuth / Auth.js
- ❌ 没用中间件统一拦截
- ❌ 用户身份完全靠前端塞 header,后端无验证
- ⚠️ `external_platforms.cookie` 明文存网易云 cookie → 拿到 DB 等于拿到用户网易云账号
- ✅ 但 admin 路径有 `src/app/admin/layout.tsx` 做了某种 layout 鉴权 (未深读,文件名+惯例推测)

**生产前必须重做**: 接 Supabase Auth + middleware 校验 + 不存明文 cookie。

## 7. 缓存机制细节 (main.py + cache.py 验证)

**两套独立缓存**:
1. **FastAPI 内存 LRU** (Python `MemoryCache`): key → (data, expires_at, stale_until), 命中返数据,过期走 stale-while-revalidate
2. **Next.js 客户端 `cacheFetch`**: 简单 HTTP 包装,失败返 null → 业务回退到 Supabase 直连

**离线降级**: 5 连续错误 → `enter_offline_mode` → 所有 read 走 stale 数据。`health_check()` 每 30s ping 一次 `/playlists` 探活,恢复后 `exit_offline_mode` 并清零错误计数。

**TTL 默认 5 分钟** (`bg_refresh` 函数),但**整个 cache.py 只有 114 行**,功能简陋,别指望它当 Redis 用。

## 8. 节奏游戏子系统

独立子模块,3 个 API + 1 个组件 + 1 个 client sync lib:
- 谱面存 `rhythm_charts.notes: jsonb[]` (每条 note 是 `{time, lane}`)
- 客户端渲染 + 判定 (RhythmGame.tsx)
- `lib/rhythm-sync.ts` 处理谱面同步

**没读深的**: 判定逻辑/计分/谱面编辑流程。需要时再读。

## 9. 外部集成表

| 外部 | 用途 | 在哪里调用 |
|---|---|---|
| 网易云 API (`:3000`) | 搜索/播放/歌单导入/榜单 | `/api/netease/*` 全系 |
| MusicBrainz | 艺人/专辑元数据补全 | `sync-mb/route.ts` `sync-album-tracks/route.ts` `sync-artists/route.ts` `sync-netease-artist/route.ts` |
| yt-dlp | 通用下载器 (YouTube/B站) | `music/ytdlp/route.ts` (733 行) + `music/ytdlp/proxy/route.ts` |
| Supabase Auth | (未实际使用,仅配置) | `supabase/config/route.ts` 把 env 暴露给前端 |
| AWS S3 | (未使用) | package.json 装了 SDK 但代码里没出现 |
| Coze SDK | (未读) | `coze-coding-dev-sdk` 0.7.16 依赖 |

**环境变量假设** (从代码 import 推测,需对照 .env 确认):
- `COZE_SUPABASE_URL` / `COZE_SUPABASE_ANON_KEY` / `COZE_SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_NETEASE_API_URL` (默认 `http://localhost:3000`)
- `CACHE_API_URL` (默认 `http://localhost:8000`)
- `YTDLP_PATH` / `HTTP_PROXY` / `HTTPS_PROXY`

## 10. 已知问题/技术债 (从代码读出,不夸大)

| 严重度 | 问题 | 位置 |
|---|---|---|
| 🔴 高 | 鉴权是假的,传 header 就过 | 全站,尤其中 POST/DELETE |
| 🔴 高 | Supabase key 硬编码在 4+ 文件 (截断展示,实际完整 key 可能在 git 历史) | `comments/route.ts` `user/avatar/upload/route.ts` `ytdlp/route.ts` `playlist-tracks/route.ts` `fastapi-cache-service/config.py` |
| 🟡 中 | 音频/MV 存本地,生产环境必须换 S3 | `local-tracks/upload/audio/route.ts` `upload/mv/route.ts` |
| 🟡 中 | 网易云 cookie 明文存 DB | `external_platforms.cookie` |
| 🟡 中 | `.next/` 目录被 git 跟踪 (1MB+ 噪声) | 仓库根 |
| 🟢 低 | 缓存只 5 分钟 TTL,无主动刷新策略 | `cache.py` |
| 🟢 低 | 评论软删没清理线程,DB 会膨胀 | `comments.is_deleted` |
| 🟢 低 | `tracks500.json` 种子数据可能与 schema 不同步 | 根目录 |
| 🟢 低 | 419 个 `__duplicate__` 文件 (可能是重复组件/工具) | pygount 报告 |

## 11. 给新协作者的 5 分钟入门

1. 跑起来: `pnpm install` → `pnpm dev` (5000) → `cd fastapi-cache-service && source .venv/bin/activate && python main.py` (8000) → 网易云 API 跑在 3000
2. 看懂数据: 打开 `src/storage/database/shared/schema.ts` + `er-diagram.puml`
3. 看懂请求: 打开 `src/app/api/music/playlist-tracks/route.ts` (典型 cache + supabase 模式)
4. 看懂播放: 打开 `src/components/music/MusicPlayer.tsx`
5. 看懂评论: 打开 `src/app/api/comments/route.ts` (含软删+违禁词+鉴权示例)

## 12. 未深读 / 待补 (诚实声明)

下面这些写"看不出来",需要时再读:
- Admin 鉴权 layout 怎么实现的 (`src/app/admin/layout.tsx` 完整逻辑)
- 歌单聚合 (`home/aggregation`) 的具体算法
- 网易云 cookie 登录/刷新机制 (`PlatformLogin.tsx` + `external_platforms.cookie` 怎么用)
- `MusicImporter.tsx` 的批量导入策略
- 节奏游戏的判定算法和计分
- `useBackButtonStore.ts` 状态管理范围
- `.env*` 实际配置 (因安全拦截未读,需老大口头确认)

---

**生成方法**: `codebase-inspection` 体检 + 关键文件逐个 read_file + llm-wiki 流程改造。生成时间 2026-07-02。**重新生成**: `arch生成` 一句话即可。
