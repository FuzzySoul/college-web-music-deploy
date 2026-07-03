FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip git ca-certificates \
  && pip3 install --break-system-packages yt-dlp \
  && npm install -g pnpm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
ENV NETEASE_API_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_NETEASE_API_URL=/api/netease
ENV NEXT_PUBLIC_APP_URL=http://127.0.0.1:7860
ENV NEXT_PUBLIC_SITE_URL=http://127.0.0.1:7860

COPY . /app

RUN git clone --depth 1 https://github.com/Binaryify/NeteaseCloudMusicApi.git /opt/NeteaseCloudMusicApi \
  && cd /opt/NeteaseCloudMusicApi \
  && npm install

RUN pnpm install --frozen-lockfile \
  && pnpm build

RUN chmod +x /app/scripts/start-hf-space.sh

EXPOSE 7860

CMD ["/app/scripts/start-hf-space.sh"]
