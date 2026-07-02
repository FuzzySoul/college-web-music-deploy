# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

A full-stack **Next.js 16 + React 19** music platform with admin panel, rhythm game, and video playback capabilities.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Components)
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: TailwindCSS v4 + shadcn/ui (Radix UI primitives)
- **Database**: Supabase + Drizzle ORM + PostgreSQL (`pg`)
- **State**: Zustand 5
- **Forms**: react-hook-form + zod 4
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Video**: dash.js + hls.js
- **Icons**: lucide-react
- **Package Manager**: pnpm >= 9.0.0
- **Storage**: AWS S3

## Build & Dev Commands

```bash
pnpm dev          # Start dev server (Turbopack, port 5000)
pnpm build        # Production build
pnpm start        # Production server (port 5000)
pnpm lint         # ESLint
pnpm ts-check     # TypeScript type checking
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin panel (users, tracks, playlists, stats, etc.)
│   ├── home/               # Home page
│   └── api/                # API routes
│       ├── admin/          # Admin APIs (banners, playlists, stats, etc.)
│       ├── music/          # Music APIs (ytdlp, artist-detail, etc.)
│       ├── rhythm/         # Rhythm game APIs (songs, charts)
│       ├── comments/       # Comment system APIs
│       ├── download/       # Download APIs
│       └── explore/        # Explore/discover APIs
├── components/             # React components
│   ├── music/              # Music player, playlist, search, sidebar
│   └── ui/                 # shadcn/ui components (auto-generated)
├── lib/                    # Service layer & utilities
│   ├── music-service.ts    # Music business logic
│   └── rhythm-sync.ts      # Rhythm game sync logic
└── storage/database/       # Database layer
    └── shared/schema.ts    # Drizzle schema definitions
```

## Path Aliases

- `@/*` → `src/*`

## Key Conventions

- **No `any` types** — use explicit types and Zod schemas
- **API routes** follow Next.js Route Handlers pattern (export `GET`, `POST`, etc.)
- **shadcn/ui components** live in `src/components/ui/`, use `npx shadcn add` to install new ones
- **Database queries** go through Drizzle ORM with Supabase/PostgreSQL
- **State management** uses Zustand stores for client-side state
- **Form validation** uses react-hook-form with zod resolvers
