# FacebookGrabContents

**Grab Facebook posts and videos, archive them as evidence-grade PDFs, and merge clips into one file — all from your browser.**

A self-hostable web app that:

- 📄 **Archives Facebook posts to PDF** — a clean, print-ready dossier with cover page, engagement metrics, comments, QR verification, and a table of contents.
- 🎬 **Downloads & merges Facebook videos** — extracts direct MP4 streams (Reels, Watch, post videos) with `yt-dlp`, then merges multiple clips into a single MP4 with synchronized, normalized audio via `FFmpeg`.
- 🗣️ **Adds AI voiceovers** — writes a narration script (or auto-drafts one) and dubs natural text-to-speech onto any video.
- 🔐 **Tamper-evident Evidence Vault** — every sealed post is written to a SHA-256 hash chain, so any later edit or deletion is cryptographically detectable. Includes a local retrieval ("Ask your archive") that answers with cited, sealed sources.
- 🤖 **Bring Your Own Key (BYOK) AI** — works with Google Gemini natively, or any OpenAI-compatible provider (OpenRouter, Groq, NVIDIA NIM, DeepSeek, Cerebras, Mistral, …).

> **Note:** AI features require an API key. Keep it private — the server forwards it per request and never stores it. You can also set a server-wide `GEMINI_API_KEY`.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, lucide-react, jsPDF, html2canvas |
| Backend | Node.js, Express, TypeScript (`tsx`) |
| Media | `FFmpeg` / `FFprobe`, `yt-dlp` |
| Storage | Append-only NDJSON hash chain (`vault/`) |

---

## Run locally

**Prerequisites:** Node.js 20+, and `ffmpeg`/`ffprobe` on your `PATH`.
For video extraction, place a `yt-dlp` binary in the project root (or on your `PATH`).

```bash
npm install
cp .env.example .env        # optional: add a GEMINI_API_KEY
npm run dev                 # http://localhost:3000
```

Production build:

```bash
npm run build               # outputs dist/
NODE_ENV=production npm start
```

---

## Deploy

### Docker (recommended — any container host)

The included `Dockerfile` bundles FFmpeg and installs the Linux `yt-dlp` binary.

```bash
docker build -t facebookgrabcontents .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key facebookgrabcontents
```

Works on **Render**, **Railway**, **Koyeb**, **Fly.io**, or any VPS. On Render, `render.yaml` gives a one-click blueprint — connect this repo and deploy.

For a persistent Evidence Vault in production, mount a volume at `/app/vault` (the container filesystem is otherwise ephemeral).

### ⚠️ Cloudflare

Cloudflare **Workers / Pages cannot run this app's backend** — its edge runtime has no native binaries (`ffmpeg`, `yt-dlp`) and no writable disk. You can use Cloudflare **for free DNS + CDN/proxy** in front of your container host, or host *only* the static `dist/` build on Pages with the API on a separate Node host (which requires enabling cross-origin access).

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `GEMINI_API_KEY` | — | Optional server-wide Gemini key |
| `AI_RATE_LIMIT_PER_MIN` | `30` | Rate limit for AI endpoints |
| `MEDIA_RATE_LIMIT_PER_MIN` | `120` | Rate limit for video/proxy endpoints |
| `MERGED_OUTPUT_TTL_MS` | `7200000` | How long merged videos live in `/tmp` |

---

## Security

This project is intended for self-hosting and personal/team use. Before exposing it publicly:

- [x] SSRF protection on proxy/stream/AI endpoints (blocks private, loopback and link-local addresses)
- [x] Rate limiting on AI and media endpoints
- [x] Temporary merged outputs auto-expire
- [ ] The server trusts anyone who can reach it — add authentication (reverse-proxy basic auth, Cloudflare Access, or OAuth) for public deployments.
- [ ] Never commit `.env` or API keys.

---

## License

MIT
