# ---- FaceGrab Contents (FacebookGrabContents) ---------------------------------
# Multi-stage-ish single image: Node 22 + FFmpeg/FFprobe + yt-dlp.
# Deploy on any container host with a writable disk (Render / Railway /
# Koyeb / Fly.io / a VPS). Works with Cloudflare in front for DNS/CDN.
#
# NOTE: Cloudflare Workers/Pages CANNOT run this image (no native binaries or
# disk). Cloudflare may only sit in front as a proxy, or host the static build.
# --------------------------------------------------------------------------------

FROM node:22-bookworm-slim

# FFmpeg/FFprobe are required for video merge, voiceover and clip remuxing.
# curl is used to fetch the standalone yt-dlp binary below.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp standalone Linux binary (self-contained, no Python needed).
# Placed on PATH so videoService.ts finds it via its PATH fallback.
RUN curl -L --fail --retry 3 \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && /usr/local/bin/yt-dlp --version

WORKDIR /app

# Install deps first for better layer caching. `npm ci` installs devDeps too,
# because runtime uses tsx and the frontend build uses vite.
COPY package.json package-lock.json ./
RUN npm ci

# Build the frontend (Vite) and copy the rest of the source.
COPY . .
RUN npm run build

# Runtime config: production mode serves dist/ + the API.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Non-root user for safety. /app/vault and /tmp must be writable by this user.
RUN useradd --create-home --uid 10001 appuser \
  && mkdir -p /app/vault /app/public/uploads /app/public/audio \
  && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
