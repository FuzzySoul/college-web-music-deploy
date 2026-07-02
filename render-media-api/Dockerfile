FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
  && pip3 install --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY render-media-api/package.json ./package.json
COPY render-media-api/tsconfig.json ./render-media-api/tsconfig.json
RUN npm install

COPY src ./src
COPY render-media-api/src ./render-media-api/src

WORKDIR /app/render-media-api
CMD ["node", "../node_modules/tsx/dist/cli.mjs", "--tsconfig", "./tsconfig.json", "./src/server.ts"]
