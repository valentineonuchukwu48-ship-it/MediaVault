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

### Video extraction on a server (cookies)

Facebook blocks datacenter/cloud IPs, so `yt-dlp` may fail on a hosted server even
though it works on your laptop. Supplying **browser cookies** fixes almost all of
these cases. Export a Netscape-format `cookies.txt` (e.g. with the "Get cookies.txt"
browser extension) while logged into Facebook, then provide it one of three ways:

- `YTDLP_COOKIES=/path/to/cookies.txt`
- `YTDLP_COOKIES_BASE64=<base64 of the file>` (best for host secret UIs — e.g. Render)
- place `cookies.txt` (or `secrets/cookies.txt`) in the project root

Generate the base64 value:

```bash
base64 -w0 cookies.txt     # macOS: base64 cookies.txt | tr -d '\n'
```

### Cloudflare Pages (free — for the frontend)

Cloudflare **Workers/Pages cannot run the backend** (no `ffmpeg`/`yt-dlp`, no disk),
so the app's engine runs on a container host (see Docker/Render above) and Pages
serves the static UI, proxying API calls to the backend via
`functions/api/[[path]].ts`.

1. Deploy the backend first and copy its URL (e.g. `https://facebookgrabcontents.onrender.com`).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select this repository.
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** *(leave empty)*
4. **Environment variables (Production):**
   - `API_BACKEND_URL` = your backend URL from step 1
   - `NODE_VERSION` = `22`
5. **Save and Deploy.** Your app is live at `https://<project>.pages.dev`.

> Prefer the simplest setup? Skip Pages and just run the Docker image on Render,
> then point Cloudflare DNS at it — one deploy, no split.

### ⚠️ Cloudflare (what it cannot do)

Cloudflare **Workers / Pages cannot run this app's backend** — its edge runtime has no native binaries (`ffmpeg`, `yt-dlp`) and no writable disk. Use Cloudflare for DNS/CDN in front of your container host, or for the static frontend as described above.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `GEMINI_API_KEY` | — | Optional server-wide Gemini key |
| `AI_RATE_LIMIT_PER_MIN` | `30` | Rate limit for AI endpoints |
| `MEDIA_RATE_LIMIT_PER_MIN` | `120` | Rate limit for video/proxy endpoints |
| `MERGED_OUTPUT_TTL_MS` | `7200000` | How long merged videos live in `/tmp` |
| `YTDLP_COOKIES` | — | Path to a Netscape `cookies.txt` for yt-dlp |
| `YTDLP_COOKIES_BASE64` | — | Base64 of `cookies.txt` (for host secret UIs) |
| `API_BACKEND_URL` | — | **(Cloudflare Pages only)** backend origin to proxy `/api` to |

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
