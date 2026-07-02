<div align="center">

# 🎵 MusicWeb

**A full-stack music streaming & management platform built with modern web technologies.**

Browse, play, and manage music from multiple sources — all in one elegant interface.

[Live Demo](https://musicweb-fuzzysoul.netlify.app) · [Report Bug](https://github.com/FuzzySoul/MusicWeb/issues) · [Request Feature](https://github.com/FuzzySoul/MusicWeb/issues)

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Cache-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

</div>

---

## ✨ Highlights

| 🎨 **Modern UI** | 🚀 **Blazing Fast** | 🔌 **Multi-Source** | 🎮 **Interactive** |
|:---:|:---:|:---:|:---:|
| Radix UI + Tailwind 4 + Framer Motion | Next.js 16 Turbopack + Drizzle ORM | Local files · NetEase · MusicBrainz | Rhythm Game · Comments · Stats |

---

## 🎬 Screenshots

> _Screenshots & live demo: see the deployed build link above once CI completes._

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React 19)                       │
│              Next.js 16 App Router · Turbopack              │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  API Routes  │  │  API Routes  │  │  API Routes  │
   │   /music/*   │  │  /netease/*  │  │  /rhythm/*   │
   └──────────────┘  └──────────────┘  └──────────────┘
            │               │               │
            └───────┬───────┘               │
                    ▼                       ▼
        ┌──────────────────────┐   ┌──────────────┐
        │  FastAPI Cache (LRU) │   │  Rhythm Game │
        │   5min TTL · offline │   │   谱面 jsonb │
        └──────────────────────┘   └──────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │  Supabase PostgreSQL │
        │  Drizzle ORM schema  │
        └──────────────────────┘
```

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical breakdown (15 tables, 48 endpoints, 33 components).

---

## 🛠️ Tech Stack

**Frontend**
- ⚡ [Next.js 16.1.1](https://nextjs.org/) — App Router · Turbopack · React Server Components
- ⚛️ [React 19.2](https://react.dev/) — Server Actions, `useFormState`, streaming
- 🎨 [Tailwind CSS 4](https://tailwindcss.com/) — utility-first, JIT
- 🧩 [shadcn/ui](https://ui.shadcn.com/) — accessible primitives (Radix UI)
- 🎬 [Framer Motion 12](https://www.framer.com/motion/) — physics-based animations
- 📊 [Recharts](https://recharts.org/) — listening stats dashboards
- 🎵 [DASH.js](https://github.com/Dash-Industry-Forum/dash.js) + [HLS.js](https://github.com/video-dev/hls.js) — adaptive streaming

**Backend**
- 🐍 [FastAPI](https://fastapi.tiangolo.com/) — in-memory cache proxy (httpx + pydantic)
- 🐘 [Supabase](https://supabase.com/) — managed Postgres + Auth + Storage
- 🗄️ [Drizzle ORM](https://orm.drizzle.team/) — type-safe SQL with migrations
- 🎶 [yt-dlp](https://github.com/yt-dlp/yt-dlp) — universal media downloader
- 🟢 [Node.js 22](https://nodejs.org/) — [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) integration

**DevOps & Tooling**
- 📦 pnpm 9 — workspace-grade package manager
- 🔍 TypeScript 5.9 — strict mode
- 🎯 ESLint 9 — flat config
- ☁️ Netlify + Render — auto-deploy from `main`

---

## 🎯 Features

### 🎼 Music Playback
- 🎵 **Multi-source streaming** — local files, NetEase Cloud Music, MusicBrainz metadata
- 📑 **DASH / HLS adaptive streaming** via DASH.js and HLS.js
- 🎚️ **Audio visualizer** with real-time frequency analysis
- ⌨️ **Keyboard shortcuts** — space to play/pause, ←/→ to seek
- 📱 **Mobile-responsive** player with touch gestures
- 🔁 **Loop modes** — single track, playlist, shuffle
- 📜 **Synced lyrics** with line-level timing (LRC format)

### 📚 Library Management
- 🎤 **Artist pages** with bio, image, and discography
- 💿 **Album browser** with track listing and metadata
- 📋 **Playlists** — create, edit, share, aggregate from multiple sources
- ❤️ **Favorites** — quick-access collection
- 🔍 **Search** across tracks, artists, albums, playlists
- 📊 **Listening stats** — top tracks, play history, time-spent charts

### 💬 Social
- 💬 **Threaded comments** on tracks/albums/playlists
- 🛡️ **Admin moderation** — forbidden word filter, soft delete
- 🏷️ **User profiles** with avatar upload (Supabase Storage)

### 🎮 Rhythm Game
- 🎼 **Custom charts** — editor with 4-lane note layout
- ⏱️ **Note timing** stored in jsonb with millisecond precision
- 🏆 **Scoring & judgment windows** (perfect/great/miss)
- 🔄 **Chart sync** from external sources

### 🔧 Admin Dashboard
- 👥 User management (ban, role assignment)
- 🎵 Content management (CRUD tracks/albums/playlists)
- 📊 Site statistics & analytics
- 🛡️ Moderation queue with bulk actions
- 🚫 Forbidden word management

---

## 📊 Project Stats

```
📁 48 API routes          🎨 33 React components
🗃️ 15 database tables      📄 200+ files
💎 ~43,000 LOC TypeScript  ⚡ Next.js 16 Turbopack
🎯 95% type coverage       🔒 Supabase RLS
```

> Generated with [codebase-inspection](https://github.com/...) using pygount.

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm i -g pnpm` |
| Python | 3.12+ | [python.org](https://www.python.org/) |

### Clone & Install

```bash
git clone https://github.com/FuzzySoul/MusicWeb.git
cd MusicWeb
pnpm install
# NetEase integration is REQUIRED for full features (search, charts, playlist import).
# It's a separate Git repo (Binaryify/NeteaseCloudMusicApi). Either:
#   1) Clone it into ./NeteaseCloudMusicApi/ — `git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git`
#   2) Or use any public NetEase API endpoint by setting NEXT_PUBLIC_NETEASE_API_URL
```

### Full Tech Stack (for someone cloning fresh)

| Component | What it is | Required? | What to do |
|---|---|---|---|
| **Next.js 16 (App Router)** | Frontend + 48 API routes | ✅ Yes | `pnpm install && pnpm dev` → :5000 |
| **Supabase** | Postgres + Auth + Storage | ✅ Yes | Create a free project at [supabase.com](https://supabase.com/), run the Drizzle schema (`src/storage/database/shared/schema.ts`), fill 3 keys in `.env.local` |
| **FastAPI cache** (`fastapi-cache-service/`) | In-memory LRU for Supabase reads | ⚠️ Optional (app falls back to direct Supabase if down) | `cd fastapi-cache-service && .venv/Scripts/python.exe -m uvicorn main:app --port 8000 --reload` |
| **NetEase API** (`NeteaseCloudMusicApi/`) | Search / playlists / charts / play URLs | ⚠️ Optional but recommended | Clone [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) into `./NeteaseCloudMusicApi/`, `cd NeteaseCloudMusicApi && npm install && node app.js` → :3000 |
| **yt-dlp** | YouTube/Bilibili downloader | ⚠️ Optional | `pip install yt-dlp` or set `YTDLP_PATH` to the binary in repo root (`./yt-dlp.exe`) |
| **MusicBrainz** | Artist/album metadata sync | ⚠️ Optional (no key needed, free public API) | Just works, no signup |
| **Supabase Storage** | Avatar uploads | ✅ Yes (part of Supabase project) | Create a public bucket named `avatars` in Supabase dashboard |

### Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase
COZE_SUPABASE_URL=https://<your-project>.supabase.co
COZE_SUPABASE_ANON_KEY=<your-anon-key>
COZE_SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

# NetEase API (run locally or use a public demo)
NEXT_PUBLIC_NETEASE_API_URL=http://localhost:3000

# FastAPI cache (optional — app falls back to direct Supabase if down)
CACHE_API_URL=http://localhost:8000

# yt-dlp (optional, for downloads)
YTDLP_PATH=yt-dlp
```

### Start the Stack

```bash
# Terminal 1 — Next.js dev server
pnpm dev                              # → http://localhost:5000

# Terminal 2 — FastAPI cache proxy
cd fastapi-cache-service
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload  # → http://localhost:8000

# Terminal 3 — NetEase API (optional, only if using NetEase features)
cd ../NeteaseCloudMusicApi
node app.js                            # → http://localhost:3000
```

### Open the App

Navigate to **http://localhost:5000** 🎉

---

## 🧰 Project Structure

```
MusicWeb/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── home/                     # Frontend pages (14)
│   │   ├── admin/                    # Admin dashboard (11)
│   │   └── api/                      # API routes (48)
│   ├── components/music/             # React components (33)
│   ├── lib/                          # Service layer
│   ├── hooks/                        # Custom React hooks
│   ├── types/                        # TypeScript definitions
│   └── storage/database/shared/      # Drizzle schema
├── fastapi-cache-service/            # Python cache proxy (independent venv)
├── public/                           # Static assets (uploaded media goes here)
├── ARCHITECTURE.md                   # Full technical documentation
└── package.json
```

> **Note:** `NeteaseCloudMusicApi/` is **NOT** in this repo (it's a separate upstream project). See Quick Start above for the clone command.

---

## 🤝 Contributing

Contributions are welcome! Please read the [contribution guidelines](CONTRIBUTING.md) first.

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/amazing`)
3. 💾 Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing`)
5. 🔁 Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

## 🙏 Acknowledgments

- [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) — NetEase API server
- [MusicBrainz](https://musicbrainz.org/) — open music encyclopedia
- [Supabase](https://supabase.com/) — backend infrastructure
- [Vercel](https://vercel.com) · [Netlify](https://www.netlify.com/) — hosting
- [Radix UI](https://www.radix-ui.com/) · [shadcn/ui](https://ui.shadcn.com/) — UI primitives

---

<div align="center">

**Built with ❤️ by [FuzzySoul](https://github.com/FuzzySoul)**

⭐ Star this repo if you like it!

</div>
