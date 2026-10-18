# FacebookGrabContents

[![Release](https://img.shields.io/github/v/release/valentineonuchukwu48-ship-it/facebookgrabcontents?include_prereleases&logo=github&label=release)](https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/releases)
[![Tests](https://img.shields.io/github/actions/workflow/status/valentineonuchukwu48-ship-it/facebookgrabcontents/ci.yml?branch=main&label=tests&logo=github)](https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Windows_%7C_macOS_%7C_Linux_%7C_Android-lightgrey?logo=windows95)](https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents/releases)
[![Docs](https://img.shields.io/badge/docs-full%20manual-8A2BE2?logo=readme)](docs/DOCUMENTATION.md)

**Archive Facebook posts as evidence-grade PDFs, and download or merge Facebook videos (with sound) — as a desktop app that runs entirely on your own machine.**

No servers, no accounts, no uploads. Your posts, videos and API keys never leave your computer.

---

## ✨ Features

- 📄 **Post → PDF dossier** — a clean, print-ready document with cover sheet, engagement metrics, comments, QR verification and a table of contents.
- 🎬 **Video download & merge** — extracts direct MP4 streams (Reels, Watch, post videos) with `yt-dlp`, then merges multiple clips into one MP4 with synchronised, normalised audio via `FFmpeg`.
- 🔊 **Audio guaranteed** — Facebook serves video and audio as separate streams; the app detects that and muxes them back together, so downloads are never silent.
- 🗣️ **AI voiceovers** — drafts a narration script and dubs natural text-to-speech onto any clip.
- 🔔 **Deletion Radar** — watch posts you already archived; the engine quietly re-checks them on a schedule and alerts **every open window (PC and phone)** the moment a public copy is edited or deleted. Your sealed original stays in the vault no matter what. **← NEW in v1.3.0**
- ⏳ **Court-grade time proof** — anchor every sealed entry into the free public Bitcoin calendar (OpenTimestamps); anyone can prove your archive existed on a real date with official independent tools. **← NEW in v1.4.0**
- 📊 **Excel/CSV export** — the whole sealed archive as one auditable spreadsheet (dates, URLs, engagement, hashes, anchor status). **← NEW in v1.4.0**
- 🛡️ **Tamper-evident Evidence Vault** — every sealed post is appended to a SHA-256 hash chain, so any later edit or deletion is cryptographically detectable. Includes local retrieval ("Ask your archive") that answers with cited, sealed sources.
- 🤖 **Bring Your Own Key AI** — Google Gemini natively, or any OpenAI-compatible provider (OpenRouter, Groq, NVIDIA NIM, DeepSeek, Cerebras, Mistral, …).
- 🍪 **One-click Facebook login** — reuses your own browser session via `--cookies-from-browser`, which fixes private, age-gated and blocked videos with no manual cookie export.

---

## 📥 Download & install

1. Go to the **[Releases](../../releases)** page.
2. Download either:
   - **`FacebookGrabContents-<version>-x64-setup.exe`** — installer (recommended), or
   - **`FacebookGrabContents-<version>-portable.exe`** — no installation.
3. Run it. Windows may show a *"Windows protected your PC"* SmartScreen prompt because the build is not code-signed — click **More info → Run anyway**.

> The app bundles everything it needs (`ffmpeg`, `ffprobe`, `yt-dlp`) — you do **not** need to install anything else.

### Already have an older version?
Don't head to GitHub — **the app updates itself**: it checks on every startup (or press **Desktop → Check for updates**), downloads in the background and asks *"Restart to install?"*. All your sealed evidence and settings survive every upgrade.

### First run
1. Open the **Desktop** button (bottom-right).
2. Under **Facebook login**, pick the browser you're signed into Facebook with (e.g. Chrome) → **Save**.
3. Paste a Facebook post or video URL and go.

### Where your data lives
Everything is stored under your user profile:

```
%APPDATA%\FacebookGrabContents\data\
├── vault\            sealed posts (hash chain)
├── merged_outputs\   merged / downloaded videos
├── audio\            generated voiceovers
├── uploads\
└── settings.json     your preferences
```

Use **Desktop → Data folder / Downloads** to open them, or **File** in the menu bar.

---

---

## 🛡️ Zero-trust evidence verifier

**Evidence vault → Download zero-trust verifier** produces one portable `.html` file that embeds
your whole sealed chain plus an independent re-verification engine (WebCrypto SHA-256 in the
recipient's browser). Share it with a lawyer, court, or journalist — they open the file and see
`VERIFIED ✓` with every hash recomputed live, or `TAMPERING DETECTED` with the first broken entry.
No installation, no account, no trust in the app itself. **← NEW in v1.2.0**

## 📱 Mobile app (Android & iPhone)

Phone Connect puts the same full experience on your phone over your Wi-Fi. The PC keeps doing the heavy lifting (yt-dlp, ffmpeg, vault, AI), so nothing is missing on mobile:

1. Open the desktop app on your PC → **Desktop panel (bottom-right) → Phone Connect → Share to my phone**.
2. Scan the QR code with your phone camera (phone and PC on the **same Wi-Fi**). The full app opens on the phone — the QR carries a one-time **6-digit pairing code**, so nobody else on the Wi-Fi can reach your engine.
3. Install it like a real app:
   - **Android (Chrome):** menu (⋮) → **Add to Home screen** / **Install app** — served as an installable PWA (manifest + service worker).
   - **iPhone (Safari):** Share → **Add to Home Screen**.
4. Or grab the native **Android APK** from the [Releases](../../releases) page (`FacebookGrabContents-Mobile-<version>.apk`):
   install, open, type the address from **Desktop → Phone Connect** (e.g. `192.168.1.5:3000`) once, then the **pairing code** shown in the panel — the app remembers both. Downloads land in your phone's Downloads folder.

> The engine only listens on your LAN while **Phone Connect** is on (the toggle rebinds the engine live). It stays loopback-only otherwise.

---

## 🔔 Deletion Radar (NEW in v1.3.0)

**Sealing proves what you saw. The Radar watches what Facebook does next.**

Open the green **Radar** button (bottom-left), paste a Facebook post URL → **Watch**. The engine re-checks it anonymously every 15 minutes (or via **Check now**) exactly as a logged-out visitor sees it:

- **Edit detected** → the vault records both versions and every open window (PC **and** paired phone) gets a live alert.
- **Delete detected** → the radar only fires `DELETED` after two consecutive misses (no false alarms from network hiccups), the vault preserves your sealed original forever, and every window is alerted instantly.

A full timeline of alerts is kept under `data\radar\events.json`. Full docs: **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)**.

---

## ⏳ Court-grade time proof (NEW in v1.4.0)

The core's brakes don't just prove integrity — they prove **when your archive existed**, independent of this app:

1. **Desktop panel → Evidence vault → Anchor vault to Bitcoin calendar (free).** Every sealed entry is submitted to the free public OpenTimestamps calendars (one batched call, no account, no cost). New seals follow automatically.
2. Within hours each receipt becomes a **Bitcoin block attestation** — *"this exact evidence existed on or before block NNNNNN"* — impossible to forge or backdate.
3. **Time-proof ZIP** gives a lawyer/court everything: every receipt + evidence line + a plain-English guide, verifiable with the official `ots` tools and zero trust in this app.

The Desktop panel shows live `anchored / pending` counts.

## 📊 Export your archive to Excel (NEW in v1.4.0)

**Evidence vault → Export records to Excel (CSV)** — every archived post with date, URL, author, engagement numbers, content hashes and its public Bitcoin-anchor status. Formula-injection-safe and UTF-8 correct on Windows Excel.

---

## 🧱 Architecture

```
Electron shell (electron/main.cjs)
   │  shows a splash + progress bar
   ├─ spawns ─► Express engine (build/server.mjs)  on 127.0.0.1:<random port>
   │               ├── React UI (built by Vite → dist/)
   │               ├── ffmpeg / ffprobe  (bundled bin/)
   │               └── yt-dlp            (bundled bin/)
   └─ opens the UI in a native window
```

The engine runs as an isolated child process, so a heavy merge can never freeze the window.

| Layer | Tech |
|---|---|
| Desktop shell | Electron, electron-builder, electron-updater |
| Frontend | React 19, Vite, Tailwind CSS v4, lucide-react, jsPDF, html2canvas |
| Engine | Node.js, Express, TypeScript (bundled with esbuild) |
| Media | `FFmpeg` / `FFprobe`, `yt-dlp` |
| Vault storage | Append-only NDJSON SHA-256 hash chain |
| Mobile | Installable PWA over LAN + Android WebView companion (CI-built APK) |

---

## 🛠️ Build from source

**Prerequisites:** Node.js 20+ (22 recommended).

```bash
git clone https://github.com/valentineonuchukwu48-ship-it/facebookgrabcontents.git
cd facebookgrabcontents
npm install
npm run fetch:binaries        # downloads ffmpeg + ffprobe + yt-dlp into bin/
npm run desktop               # build everything and launch the desktop app
```

### Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Browser dev server with hot reload (`http://localhost:3000`) |
| `npm run desktop` | Build frontend + engine, then launch Electron |
| `npm run pack:dir` | Produce an unpacked app in `release/` (fast smoke test) |
| `npm run dist:win` | Build the Windows installer + portable `.exe` |
| `npm run dist:mac` / `dist:linux` | Build for macOS / Linux |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm test` | Run the unit tests (Vitest) |
| `npm run make:icon` | Regenerate `build-resources/icon.png` with ffmpeg |

### Releasing (free GitHub account is fine)
Tag a version and push — CI builds installers for all three platforms and attaches them to a Release:

```bash
git tag v1.0.0
git push --tags
```

---

## 🔐 Security notes

- [x] SSRF protection on all proxy/stream/AI endpoints (blocks private, loopback and link-local addresses) — rejected URLs return a clean `400`.
- [x] Rate limiting on AI and media endpoints.
- [x] Temporary merged outputs auto-expire.
- [x] Renderer runs with `contextIsolation` on, `nodeIntegration` off, and a minimal preload bridge.
- [ ] Windows builds are **unsigned** by default, so SmartScreen warns on first run. Add a code-signing certificate to remove it.

---

## 👤 Author

**Valentine Onuchukwu**
ProsperChild Technology — Nigeria
✉️ [valentineonuchukwu@gmail.com](mailto:valentineonuchukwu@gmail.com)

## ☕ Support

This app is free and always will be. If it saved you time, you can buy me a coffee:

**→ [https://flutterwave.com/donate/fysqhtbnfznn](https://flutterwave.com/donate/fysqhtbnfznn)**

Thank you — it genuinely keeps the project alive. 🙏

---

## 📄 License

[MIT](LICENSE) © 2026 Valentine Onuchukwu — ProsperChild Technology, Nigeria
