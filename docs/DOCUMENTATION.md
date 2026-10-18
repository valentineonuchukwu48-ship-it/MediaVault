# FacebookGrabContents — Full Documentation

**Archive Facebook posts as evidence-grade PDFs, download/merge Facebook videos with sound, prove nothing got tampered with — and watch the posts you care about. Runs entirely on your own machine.**

- **Version of this document:** matches app `1.4.0`
- **Author:** Valentine Onuchukwu — ProsperChild Technology, Nigeria
- **License:** MIT — free forever
- **Support the project:** https://flutterwave.com/donate/fysqhtbnfznn
- **Mobile APK / desktop installers:** https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/releases

---

## Table of contents

1. [What the app does](#1-what-the-app-does)
2. [Architecture — the big picture](#2-architecture--the-big-picture)
3. [Installing & first run](#3-installing--first-run)
4. [Feature: Post → PDF dossier](#4-feature-post--pdf-dossier)
5. [Feature: Video download, sound & merging](#5-feature-video-download-sound--merging)
6. [Feature: AI voiceovers, TTS & music](#6-feature-ai-voiceovers-tts--music)
7. [Feature: Bring-your-own-key AI studio](#7-feature-bring-your-own-key-ai-studio)
8. [Feature: Evidence Vault — the tamper-evident hash chain](#8-feature-evidence-vault--the-tamper-evident-hash-chain)
9. [Feature: Zero-Trust Verifier bundle](#9-feature-zero-trust-verifier-bundle)
10. [Feature: Deletion Radar — watch posts for edits & deletions](#10-feature-deletion-radar)
11. [Feature: Phone Connect — mobile app (Android/iPhone)](#11-feature-phone-connect--mobile-app)
12. [Feature: Pairing security (LAN protection)](#12-feature-pairing-security-lan-protection)
13. [Security model summary](#13-security-model-summary)
14. [Where your data lives](#14-where-your-data-lives)
15. [API reference](#15-api-reference)
16. [Environment variables](#16-environment-variables)
17. [Build & release pipeline](#17-build--release-pipeline)
18. [Troubleshooting](#18-troubleshooting)
19. [FAQ](#19-faq)

---

## 1. What the app does

FacebookGrabContents is a **local-first archival workbench** for Facebook content:

| Capability | One-liner |
|---|---|
| 📄 **Post → PDF** | Paste a post/Reel/embed — it becomes a print-ready, QR-stamped PDF dossier on your disk. |
| 🎬 **Video download & merge** | Copy one or many video links — download them individually or concatenated into a single MP4 **with real sound** (Facebook's separate audio tracks are re-muxed). |
| 🗣️ **AI voiceover / TTS** | Generate speech and burn it onto any clip, overlay or replace. |
| 🤖 **AI studio (BYOK)** | Any Gemini key or OpenAI-compatible provider (OpenRouter, Groq, DeepSeek, NVIDIA NIM…) writes scripts, titles, analyses, and answers. |
| 🔐 **Evidence Vault** | Every sealed post lands in an append-only SHA-256 hash chain; edits and deletions become cryptographically evident events. |
| ⏳ **Court-grade time proof** | Each sealed entry can be anchored into the free public OpenTimestamps/Bitcoin calendar — anyone can prove your archive existed on a real date with official tools, no account, no cost. **← NEW in v1.4.0** |
| 📊 **Excel/CSV export** | The whole archive as one auditable spreadsheet (dates, URLs, engagement numbers, hashes, anchor status) — Excel-safe against formula injection. **← NEW in v1.4.0** |
| 🛡️ **Zero-Trust Verifier** | Export one `.html` file that lets *anyone* re-verify your archive in their browser — with no install, no account, no trust in this app. |
| 🔔 **Deletion Radar** | Watch posts you already archived; the engine re-checks them on a schedule and alerts **every open app window (PC and phone)** the moment the public copy changes or disappears. |
| 📱 **Phone Connect** | The whole app installs on your Android/iPhone over Wi-Fi (PWA) — plus a native Android companion APK from GitHub Releases. |

It ships as: **desktop app** (Windows installer/portable, macOS dmg, Linux AppImage/deb), **installable PWA** on your phone, and a **native Android APK** companion.

> **Privacy promise:** nothing is uploaded to a developer's cloud. Your keys, cookies, vault, and downloads stay on your machine (and, for Phone Connect, on your own Wi-Fi).

---

## 2. Architecture — the big picture

```
┌───────────────────────────────────────────────────────────────────┐
│  Desktop shell (Electron, electron/main.cjs)                      │
│    • splash + start-up progress                                   │
│    • spawns the engine as an isolated child process               │
│    • minimal preload bridge (folders, settings, cookies, updater) │
│    • opens the UI in a native window at http://127.0.0.1:<port>   │
└───────────────┬───────────────────────────────────────────────────┘
                └── spawn ──► Express engine (build/server.mjs)
                               │  Node 22/24, TS compiled by esbuild
                               ├── React UI (Vite build → dist/)
                               ├── PHONE CONNECT LAN bind 0.0.0.0 (opt-in)
                               ├ media work: yt-dlp / ffmpeg / ffprobe (bin/)
                               ├── Evidence Vault (NDJSON hash chain)
                               ├── Deletion Radar (watch list + SSE alerts)
                               └── AI routes (BYOK, your key never leaves)
```

Why a separate engine? A heavy 200 MB video merge can never freeze or crash the visible window — the shell restarts the engine process independently. The UI is the same bundle in the Electron window, in `npm run dev` in a browser, and on your phone — one code path for all.

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33, electron-builder, electron-updater |
| Frontend | React 19, Vite, Tailwind CSS v4, lucide-react, jsPDF, html2canvas |
| Engine | Node.js + Express + TypeScript (esbuild bundle) |
| Media | `yt-dlp`, `ffmpeg`, `ffprobe` (fetched per-OS at build time; bundled in the desktop app) |
| Vault | Append-only NDJSON SHA-256 hash chain |
| Mobile | PWA (manifest + service worker) over LAN · Android WebView companion APK (CI-built) |

---

## 3. Installing & first run

### Desktop (Windows / macOS / Linux)

1. Download from the [Releases page](https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/releases):
   - `FacebookGrabContents-<version>-x64-setup.exe` (installer) or `-portable.exe` (no install)
   - `FacebookGrabContents-<version>-arm64.dmg` (mac Apple Silicon)
   - `FacebookGrabContents-<version>.AppImage` or `.deb` (Linux)
2. Windows SmartScreen may warn (unsigned build) → **More info → Run anyway**. macOS: right-click → **Open**.
3. Everything is bundled — **no** Python, no ffmpeg installs, no Node required.

### First-run checklist

1. Open the **Desktop** panel (bottom-right floating button).
2. **Facebook login** — pick the browser you normally use Facebook in and save (this lets `yt-dlp` reuse your logged-in session for private/age-gated content). If Chrome/Edge answers *"Could not copy cookie database"* (App-Bound Encryption), close that browser fully or use **Import cookies.txt**.
3. Paste a post/Reel URL — done.

### Watching from your phone

See [Phone Connect](#11-feature-phone-connect--mobile-app). Phones pair through a one-time 6-digit code (see [Pairing security](#12-feature-pairing-security-lan-protection)).

### Upgrading (no GitHub visit needed)

Already installed an older version? The app **updates itself**:

1. It quietly checks GitHub releases on every startup (and whenever you press **Check now** under **Desktop → Updates**).
2. A new version downloads in the background; the app asks *"Update is ready — restart now?"*.
3. One click installs. All data (vault contents, watch list, time-stamp receipts, cookies) sits outside the app itself, so nothing is lost.

Portable (non-installer) builds don't self-update — download the new portable from [Releases](https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/releases) instead.

---

## 4. Feature: Post → PDF dossier

**Input forms accepted**

| Input | What happens |
|---|---|
| `facebook.com/…/posts/…`, `/videos/…`, `/reel/…`, `/photos/…`, share links | URL metadata extractor (fbid, author hint, story_fbid → resolved id). |
| `<iframe …>` embed code or `plugins/post.php` links | Direct **Embed-Plugin scraper**: fetches the official Facebook plugin HTML and parses author, avatar, date, paragraphs, reactions, and CDN images. |
| Anything else | **OG crawler** (crawler user-agent like `facebookexternalhit`) reads `og:title / og:description / og:image`. Login-walled pages return an honest "protected" record — fake numbers are never invented. |

Extraction strategy is layered: embed plugin → og crawl → url-parameters record, each clearly labelled in the UI (`extractedSource`). Engagement counters are only shown when actually read — never invented (except obvious demo links).

**Then it becomes a PDF in your browser** (`src/utils/pdfGenerator.ts`): jsPDF + html2canvas render a dossier with cover sheet, archival report cards, table of contents, QR code linking back to the post, and — when the vault is used — the verification hashes. Suggested filenames and one-click multi-post combined documents included.

---

## 5. Feature: Video download, sound & merging

**Why downloads were always silent on other tools** — Facebook serves video and audio as **separate DASH streams**. This app handles it explicitly:

1. `yt-dlp --dump-single-json` fetches every available format (respecting your **browser cookie session**).
2. Format selection:
   - *preview* → a **combined** (video+audio) stream when Facebook offers one — sound in the browser preview,
   - *download* → highest-resolution stream (even video-only), because…
3. …on download, the separate **audio-only track is muxed back in with FFmpeg** (`-c:v copy -c:a aac 192k`), then made player-friendly (`+faststart`, AAC 44.1 kHz stereo). Every player — VLC, QuickTime, Windows Player — gets sound.

**Merging** (`/api/video/merge`):

- scales/pads every clip to one target (720p, 1080p, vertical reel 720×1280, or match-first-clip),
- unifies fps, standardises audio to 44.1 kHz stereo,
- injects silence for clips without audio (keeps A/V sync),
- optional loudness normalisation (`loudnorm` I=-16 / TP=-1.5 / LRA=11),
- outputs one MP4 with a streamable + downloadable URL, file size, resolution and duration.

**Voiceovers & merge downloads** land in the engine's `merged_outputs` folder; **Desktop → Downloads** opens it.

---

## 6. Feature: AI voiceovers, TTS & music

- **TTS** (`/api/ai/tts`): Google Gemini TTS natively (`gemini-…-tts` models, voices like Puck/Kore/Fenrir…) or any OpenAI-compatible `/audio/speech` (voice names are auto-mapped). Output is a WAV you can download or burn into a video.
- **Talking voiceover** (`/api/video/add-voiceover`): synthesises speech, then FFmpeg-
  - `overlay` — ducks the original audio to 25%, lifts the voice track, normalises (broadcast feel), or
  - `replace` — swaps the audio entirely (c:v copy so video quality is untouched).
- **Background music** (`/api/generate-music`): Lyria clip/pro models stream ambient tracks to base64 WAV for the in-app music player.

---

## 7. Feature: Bring-your-own-key AI studio

Your key, your machine, your provider:

- **Native Gemini** (`@google/genai`) — including vision (image parts) and streaming.
- **Any OpenAI-compatible provider** — base URL + model id against `/chat/completions` (OpenRouter, Groq, NVIDIA NIM, Cerebras, Mistral, LM Studio on localhost…).
- Features: connection test, model listing, streaming chat (SSE), image inputs, per-provider error translation into human sentences (401 → "check your key", 502 → "provider has no channel for that model…").
- Keys live in the app's own `settings.json` / `.env` (`GEMINI_API_KEY`) on your disk — **never** on any server. Without a key, AI features show a friendly "add your key" prompt, not a crash.

---

## 8. Feature: Evidence Vault — the tamper-evident hash chain

Sealing a post appends one JSON line to `vault/chain.ndjson`. Design goals: *tamper-evident, append-only, human-auditable, crash-safe*.

### Chain model

```
GENESIS ──► E1(prev=GENESIS) ──► E2(prev=hash(E1)) ──► E3(prev=hash(E2)) ──► …
```

Each entry:

```jsonc
{
  "seq": 42,
  "prevHash": "<hash of entry 41 | GENESIS>",
  "timestamp": "2026-10-18T05:00:00.000Z",
  "type": "SEAL | EDIT_DETECTED | DELETE_DETECTED | NOTE",
  "postId": "122129387847098460",
  "url": "https://facebook.com/…",
  "contentHash": "<sha256 of the normalized post text>",
  "snapshot": { postContent, images, authorName, authorHandle, postDate, likesCount, commentsCount, sharesCount },
  "hash": "<sha256 over everything above>"
}
```

### The exact math (what makes it forgery-proof)

1. **Content hash** = `SHA-256( trim( collapse-whitespace( NFC(text) ) ) )` in UTF-8 — so "same meaning, same bytes" always hashes identically while copy-editing or padding is caught.
2. **Entry hash** = `SHA-256( canonical(entry body) )`, where canonical = **sorted-key, compact JSON** (`{"a":1,"b":"x"}` no spaces). Deterministic on every platform.
3. **Linkage** = every entry stores the previous entry's hash — so modifying *any* historical byte invalidates *every* hash after it. You cannot edit history without the math showing you where it broke (`brokenAtSeq`).

### Operational guarantees

- **Idempotent re-sealing:** sealing identical content returns the existing entry (`duplicate: true`) — the vault never inflates.
- **Crash-safe storage:** NDJSON one-line-per-entry; a torn final line is tolerated on load instead of poisoning the chain.
- **Watch & Scan API** records `EDIT_DETECTED` (new text, previous snapshot preserved) and `DELETE_DETECTED` (`postContent` kept from the last seal) with full operator accounts (`previousHash`/`newHash`).
- **Ask Your Archive:** local TF-IDF retrieval over the sealed corpus + BYOK model answering with numbered citations to sealed entries — "what did I archive about X?" without any cloud index.

### Public time anchoring — prove the WHEN, in Bitcoin (v1.4.0)

The chain proves integrity; anchoring proves *when the archive existed*, independent of this app:

1. Every sealed entry's canonical body (whose SHA-256 IS the chain hash) is submitted to the **free OpenTimestamps public calendars** — one batched call, no account, no key. Receipt (`.ots`) saves at `vault/stamps.json`.
2. Within hours the receipt upgrades to a **Bitcoin block attestation**: *"this line existed on or before block NNNNNN (date)"* — forged or backdated proofs are impossible because the block headers are public facts.
3. New seals are submitted automatically; pending receipts upgrade silently every 6 h (`STAMP_DISABLE=1` turns this off). The **Desktop panel** shows `anchored/pending` counts with a manual *Anchor*, *Upgrade*, and *Time-proof ZIP* (all receipts + preimages + a plain-language `HOW-TO-VERIFY.txt`).
4. Any third party verifies with the **official independent tools**, no trust in this app: `pip install ots` → `ots verify <hash>.ots` → *"Success! Bitcoin block NNNNNN attests existence as of YYYY-MM-DD"* — with the downloaded preimage named `<hash>` whose SHA-256 equals the file name (verified in testing: `sha256(preimage) == entryHash == <filename>`).

Together: chain integrity ✓ + zero-trust verifier ✓ + public anchor ✓ — *what, who, when* without trusting anyone.

---

## 9. Feature: Zero-Trust Verifier bundle

*The feature that makes your archive court-grade.* Desktop → **Evidence vault → Download zero-trust verifier** produces one portable `.html` file (`verifierBundle.ts`):

- embeds your **whole sealed chain** (JSON, `<`-escaped so post text can't smuggle HTML);
- re-implements the *entire verification math from scratch* in browser JavaScript with **Web Crypto SHA-256** — checking for every entry:
  1. content hash re-derivation,
  2. entry hash over the canonical body,
  3. chain linkage vs the previous entry's hash,
- renders a verdict — `✓ N/N entries VERIFIED` or `✗ TAMPERING DETECTED — first break at entry #k (reason)`, with a per-entry table;
- is a **universal verifier**: drag & drop *anyone's* `chain.ndjson` and it verifies theirs too;
- makes zero network calls; works from a USB stick, an email attachment, a court laptop.

Why "zero-trust" matters: the verification code shipped *inside the app* might be suspected of favouring the app. The verifier is deliberately independent code proving the same facts — share it with a lawyer, a newsroom, or the other side of a dispute, and the math speaks for itself.

---

## 10. Feature: Deletion Radar

**The button that presses itself.** Sealing proves *what you saw*; the Radar watches *what Facebook does next*.

### How it works

1. **Radar (bottom-left) → paste URL → Watch.** The engine derives the post id from the link, does an initial anonymous re-read, and registers the task (`data/radar/watch.json`).
2. On a **schedule** (default every 15 min, `RADAR_INTERVAL_MS`) plus the **Check now** button, each task is anonymously re-fetched exactly as a logged-out crawler sees it.
3. Deterministic state machine per task:

| Public view | Radar action |
|---|---|
| Text unchanged vs baseline | status `ok`, silent |
| Text **changed** | vault records `EDIT_DETECTED` (both versions preserved) → status `edited` → **live alert to every window** |
| Not publicly visible | 1 miss → `unknown` (network hiccup, rate limit) · **2 consecutive misses → `DELETED` verdict**, vault records `DELETE_DETECTED` with the full original preserved → live alert |
| Never visible since added | stays `unknown`, no false alarms |

4. **Alerts reach every open window instantly** via Server-Sent Events (`/api/radar/stream`) — the desktop app *and* every paired phone tab on Wi-Fi show the badge and the alert list at the same moment. Phones fall back to gentle 60 s polling if SSE is blocked.
5. Every verdict is persisted (`data/radar/events.json`, newest first) — a timeline of what Facebook did to each post, with the receipts.

Deleting "watched" status never deletes the sealed history — the vault keeps what it sealed, and **Radar → 🗑** only stops looking.

> Scans are polite: throttle between tasks (`0.8 s`), conservative deletion gates, no aggressive parallel hammering — Facebook won't flag you for monitoring.

---

## 11. Feature: Phone Connect — mobile app

**Desktop panel → Phone Connect → Share to my phone.** The toggle makes the engine **rebind live** from `127.0.0.1` to `0.0.0.0` (and back) — no app restart — and then:

1. The panel shows a **QR code + address + pairing code**.
2. **Android/iPhone browser:** point your phone camera at the QR → the *same full app* opens on the phone (all desktop features; the PC keeps doing yt-dlp/ffmpeg/vault/AI work). Watch-list alerts land on the phone in real time too.
3. To install like a real app: Chrome ⋮ → **Add to Home screen** (Android) / Safari Share → **Add to Home Screen** (iOS). The app is served as a PWA: manifest, theme colour, installable icon, service worker.
4. **Android APK companion** (from Releases): a tiny native app with its own dark pairing screen — type the address, then the pairing code, and it remembers your PC. Downloads go straight into the phone's Downloads via the standard Android Download Manager.

Engine endpoints involved: `/api/lan-info` (what LAN URL + pairing code is live right now), `/api/health` (readiness), plus everything else, same-origin.

Windows will ask about the firewall the first time you share — allow **private networks only**.

---

## 12. Feature: Pairing security (LAN protection)

Sharing on Wi-Fi is powerful — and dangerous if anyone could reach your engine. Phone Connect pairs instead:

- On first share, the engine generates and persists (`settings.json → phonePairing`):
  - a **6-digit pairing code** (displayed in the panel, embedded in the QR links),
  - a cryptographically random **64-hex-char secret**.
- **Every remote request** must carry the secret — via the cookie set by scanning `?pair=CODE`, or by typing the code into the `/pair` page (that's what the Android APK does).
- **Wrong code** re-renders the pairing page (HTTP 403); right code sets an `HttpOnly; SameSite=Lax` cookie valid for 1 year (tailor removable from your browser at any time).
- **Pairing attempts are rate-limited** to 8/minute per address — brute-forcing a 1,000,000-code space over HTTP is not a thing.
- **Local hospital loopback stays untouched:** the Electron window itself (Host `127.0.0.1`) and local developer loops are exempt, so the desktop experience and dev servers never change; `/api/health` readiness probes are exempt for the shell.
- Everything compares with `crypto.timingSafeEqual` — constant-time, not text equality.

In other words: the cafés on your Wi-Fi see a clean "Pair this device" wall; you and your phone see the whole app.

---

## 13. Security model summary

| Layer | Protection |
|---|---|
| Network reachability | Engine is loopback-only until **Phone Connect** is toggled; LAN access then always requires the pairing secret. |
| Cross-site requests | All `/api` routes reject cross-origin `Origin/Referer` (same-host only). |
| SSRF | Every user-supplied URL that the engine fetches (images, videos, AI base URLs) must be public http(s) — localhost, `*.local`, and private/link-local IPs (including cloud metadata `169.254.169.254`) are blocked, with DNS resolution checks on hostnames. |
| Rate limiting | In-memory fixed-window limiters: AI (30/min), media endpoints (120/min), Radar (12/min), pairing (8/min) — a public host can never burn your API key or hammer downloads. |
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, and a tiny whitelisted preload bridge. |
| Shell escape-hatch | The app window never navigates away — real links open in the OS browser. |
| Secrets at rest | API keys and browser-cookie config live only in your user profile (`settings.json`); cookies.txt is stored in the private data folder. Nothing is transmitted anywhere except to Facebook/AI providers when you click. |
| Verifier bundle | `<`-escaped embedding prevents post-content HTML injection into the standalone HTML. |

---

## 14. Where your data lives

Desktop (packaged) — all inside your user profile:

```
%APPDATA%\FacebookGrabContents\data\
├── vault\
│   ├── chain.ndjson        sealed posts — the append-only hash chain
│   ├── stamps.json         public time-anchor receipts (.ots preimages)
│   └── (verifier exports go to your Downloads)
├── radar\
│   ├── watch.json          Deletion Radar watch list
│   └── events.json         alert history (newest first, capped at 200)
├── merged_outputs\         merged / dubbed videos ("Downloads")
├── audio\                  generated TTS WAVs
├── uploads\                clips uploaded for merging
└── settings.json           cookies browser, cookies.txt path, AI key, phone pairing
```

Dev mode uses `./data/` in the repo; the same names. The AI key never leaves the machine except as a request header to the provider you chose.

---

## 15. API reference

All routes are same-origin, JSON unless noted. Numeric rate-limiters noted in §16.

| Method & route | What it does |
|---|---|
| `GET /api/health` | Readiness + vault integrity snapshot `{entries, integrity}` (also used by the Electron shell on boot). |
| `GET /api/lan-info` | Phone Connect state: LAN URL(s) **with pairing code**, port. |
| `GET /pair` / `POST /pair` | Pairing wall (HTML page; form validates the 6-digit code, sets the cookie). |
| `GET /api/vault/chain?limit=` | Recent chain entries, newest first. |
| `GET /api/vault/verify?hash=` | Re-verify whole chain; optionally match a hash → which post. |
| `POST /api/vault/seal` | Seal posts (idempotent). |
| `POST /api/vault/scan` | Record EDIT/DELETE against sealed snapshots (used by Vault UI & Radar logic). |
| `POST /api/vault/hash` | Compute `contentHashOf(text)` for clients. |
| `POST /api/vault/ask` | Ask Your Archive (RAG with numbered citations). |
| `GET /api/vault/verifier` | **Zero-Trust Verifier**: standalone HTML bundle (`Content-Disposition: attachment`). |
| `GET /api/vault/stamps` | Time-anchor overview + per-entry records (`anchored`, `pending`, block heights). |
| `POST /api/vault/stamp` | Submit unstamped sealed entries to the free OpenTimestamps calendars. |
| `POST /api/vault/stamp/upgrade` | Pull Bitcoin-block attestations into pending receipts (auto every 6 h). |
| `GET /api/vault/stamps/download-all` | Court package ZIP: every receipt + preimage + how-to-verify guide. |
| `GET /api/vault/stamps/:hash/ots` | Single `.ots` receipt (official-tools compatible naming). |
| `GET /api/vault/stamps/:hash/preimage` | The exact canonical entry line the receipt proves. |
| `GET /api/vault/export.csv` | Whole archive as an Excel-safe CSV (engagement + anchor columns). |
| `GET /api/radar/tasks` | Watch list + recent events. |
| `POST /api/radar/tasks` | Watch a URL. |
| `DELETE /api/radar/tasks/:postId` | Stop watching. |
| `POST /api/radar/run` | Manual spot-check scan → `{checked, alerts}`. |
| `GET /api/radar/stream` | **SSE** live alert broadcast. |
| `POST /api/radar/run` | Manual spot-check scan → `{checked, alerts}`. |
| `GET /api/radar/stream` | **SSE** live alert broadcast. |
| `POST /api/fetch-facebook` | Post extraction (embed/OG/fallback record + `isLoginGate`). |
| `POST /api/fetch-multiple-embeds` | Batch embed/URL extraction. |
| `GET /api/proxy-image?url=` `GET /api/proxy-video?url=` | CORS-safe media proxy (range-aware). |
| `POST /api/video/extract` / `/extract-multiple` | Direct MP4/HLS streams + reasons (`code`, `hint`) on failure. |
| `POST /api/video/upload` | Base64 clip upload → `/uploads/...`. |
| `POST /api/video/merge` | Multi-clip FFmpeg merge. |
| `GET /api/video/download/:jobId` `GET /api/video/stream/:jobId` | Merged output: attachment or range-streamed. |
| `GET /api/video/download-clip` | Single-clip download (audio guaranteed, faststart). |
| `POST /api/video/add-voiceover` | TTS + mux (overlay/replace). |
| `POST /api/ai/generate` | Universal BYOK assistant call. |
| `POST /api/ai/tts` | Speech synthesis → WAV (`audioBase64`, `voice…`). |
| `POST /api/ai/test-connection` / `/api/ai/models` | Key validation / model listing (Gemini + OpenAI-compatible). |
| `POST /api/chat/stream` | Streaming chat (SSE, vision-capable). |
| `POST /api/generate-music` | Lyria music generation. |

Error shape is deliberate: `{ error: string, code?: ExtractionFailureCode, hint?: string }` so the UI can say what happened and what to do next.

---

## 16. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 (desktop picks a free one) | Engine port. |
| `HOST` | `0.0.0.0` | Engine bind. The desktop shell forces `127.0.0.1` (or `0.0.0.0` when Phone Connect is on). Pairing gate arms automatically whenever it is *not* `127.0.0.1`. |
| `FGC_DATA_DIR` | platform data dir | Where vault/radar/settings live (dev: `./data`). |
| `FGC_BIN_DIR` / `FGC_DIST_DIR` / `FGC_PUBLIC_DIR` / `FGC_APP_ROOT` | — | Packaged-app path injection (electron/main.cjs). |
| `GEMINI_API_KEY` | — | Default Gemini key (BYOK UI overrides per request). |
| `YTDLP_COOKIES` / `YTDLP_COOKIES_BASE64` / `YTDLP_COOKIES_FROM_BROWSER` | — | Authenticating video extraction to Facebook. |
| `AI_RATE_LIMIT_PER_MIN` / `MEDIA_RATE_LIMIT_PER_MIN` / `RADAR_RATE_LIMIT_PER_MIN` | 30 / 120 / 12 | Rate limiter ceilings. |
| `RADAR_INTERVAL_MS` | 900000 (15 min) | Deletion Radar scan cadence. |
| `RADAR_DISABLE` | — | `1` turns the Radar loop off (manual API still works). |
| `STAMP_DISABLE` | — | `1` turns off public time-anchoring (submission + 6 h upgrade loop). |
| `MERGED_OUTPUT_TTL_MS` | 2 h | Auto-cleanup for temp merged outputs. |

---

## 17. Build & release pipeline

### From source

```bash
git clone https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents.git
cd facebookgrabcontents
npm install
npm run fetch:binaries        # yt-dlp / ffmpeg / ffprobe for YOUR OS → bin/
npm run desktop               # frontend + engine bundle + Electron launch
npm run dev                   # engine + browser UI (hot reload)
```

| Script | Purpose |
|---|---|
| `npm run lint` | `tsc --noEmit` type gate.
| `npm test` | Vitest unit tests (URL handling, vault chain, `verifier` invariants). |
| `npm run build` / `build:server` | Vite bundle / esbuild engine bundling (`build/server.mjs`). |
| `npm run dist:win|mac|linux` | electron-builder packages (installed, portable). |
| `npm run make:icon` | Regenerate brand icon. |

### Releasing (CI does everything)

Push a **tag** (`git tag v1.3.0 && git push origin v1.3.0`) and GitHub Actions:

1. builds installers on **windows-latest, macos-latest, ubuntu-latest** (`--publish always` → draft release),
2. builds the **Android companion APK** (`android/` Gradle project; JDK 17 + Gradle 8.9 on `ubuntu-latest`) and attaches `FacebookGrabContents-Mobile-<version>.apk`,
3. finalises the release notes from `.github/release-template.md` and publishes it.

CI also runs on every push to `main` and PR in `ci.yml` (lint → tests → build), so the `main` branch is kept always-buildable.

---

## 18. Troubleshooting

| Symptom | What it means / what to do |
|---|---|
| SmartScreen warns at install | Unsigned build (cost of a cert). **More info → Run anyway**. |
| *"Could not copy Chrome cookie database"* | Chrome 127+ App-Bound Encryption. Fully close Chrome (check background processes) **or** import `cookies.txt` in the panel. |
| Video extraction says `LOGIN_REQUIRED` | The video needs a session — set browser cookies under Desktop → Facebook login. |
| Phone Connect page shows "No LAN address found" | PC not on Wi-Fi/Ethernet or no IPv4 lease. |
| Phone camera opens the QR but shows "Pair this device" | Type the 6-digit code from the panel — the QR contains it too, maybe your camera opened the base URL only. |
| Android APK can't reach the PC | Desktop app must be running with Phone Connect on; both devices on the same Wi-Fi; if the PC's DHCP lease changed, reconnect with the new address. |
| Windows asks about the firewall | Allow on **private networks** — that's the LAN share. |
| Radar says `unknown` | Usually a transient Facebook rate-limit or network blip; it only reports `deleted` after two consecutive anonymous misses. |
| Merged video silent in preview | Preview uses the combined stream Facebook offers; the downloaded file is always re-muxed with full sound. |

---

## 19. FAQ

**Is anything uploaded anywhere?** No. Everything is local: vault, videos, keys, logs. The engine talks to Facebook/AI providers strictly on your clicks.

**Do I need the desktop app running for the phone to work?** Yes — the phone pairs with your PC engine. That's the design: phone = full experience over Wi-Fi, PC = the muscle.

**Is My Password or key on any phone?** No. Your Facebook cookie session stays on your PC; the AI key stays on your PC. Phones have no credentials because the engine does the authenticated work.

**What stops Facebook from flagging me?** Watch-level usage: manual scans on clicks, throttled radar, cookie-driven yt-dlp like a real browser. Still — normal personal-archiving volumes, please.

**Can I trust the verifier?** You mustn't trust *this README* — open the bundle, read its plain JavaScript, and watch it recompute every hash in front of you. That's the entire point.

**Where do reports go if Facebook deletes a watched post?** Into the vault as a `DELETE_DETECTED` entry — the last sealed snapshot is preserved forever in the append-only chain, and the Radar event log documents the exact moment the public copy disappeared.

---

*FacebookGrabContents — ProsperChild Technology, Nigeria. Built by Valentine Onuchukwu (valentineonuchukwu@gmail.com). Free and MIT. If it saves you time: [buy me a coffee](https://flutterwave.com/donate/fysqhtbnfznn).*
