#!/usr/bin/env bash
set -euo pipefail

export NETEASE_API_URL="${NETEASE_API_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_NETEASE_API_URL="${NEXT_PUBLIC_NETEASE_API_URL:-/api/netease}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:7860}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:7860}"
export PORT="${PORT:-7860}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

cd /opt/NeteaseCloudMusicApi
node app.js > /tmp/netease.log 2>&1 &

cd /app
exec npx next start --hostname "$HOSTNAME" --port "$PORT"
