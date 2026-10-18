# FacebookGrabContents

**Archive Facebook posts as evidence-grade PDFs, and download or merge Facebook videos (with sound) — as a desktop app that runs entirely on your own machine.**

No servers, no accounts, no uploads. Your posts, videos and API keys never leave your computer.

---

## ✨ Features

- 📄 **Post → PDF dossier** — a clean, print-ready document with cover sheet, engagement metrics, comments, QR verification and a table of contents.
- 🎬 **Video download & merge** — extracts direct MP4 streams (Reels, Watch, post videos) with `yt-dlp`, then merges multiple clips into one MP4 with synchronised, normalised audio via `FFmpeg`.
- 🔊 **Audio guaranteed** — Facebook serves video and audio as separate streams; the app detects that and muxes them back together, so downloads are never silent.
- 🗣️ **AI voiceovers** — drafts a narration script and dubs natural text-to-speech onto any clip.
- 🔐 **Tamper-evident Evidence Vault** — every sealed post is appended to a SHA-256 hash chain, so any later edit or deletion is cryptographically detectable. Includes local retrieval ("Ask your archive") that answers with cited, sealed sources.
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
2. Scan the QR code with your phone camera (phone and PC on the **same Wi-Fi**). The full app opens on the phone.
3. Install it like a real app:
   - **Android (Chrome):** menu (⋮) → **Add to Home screen** / **Install app** — served as an installable PWA (manifest + service worker).
   - **iPhone (Safari):** Share → **Add to Home Screen**.
4. Or grab the native **Android APK** from the [Releases](../../releases) page (`FacebookGrabContents-Mobile-<version>.apk`):
   install, open, type the address from **Desktop → Phone Connect** (e.g. `192.168.1.5:3000`) once — the app remembers it. Downloads land in your phone's Downloads folder.

> The engine only listens on your LAN while **Phone Connect** is on (the toggle rebinds the engine live). It stays loopback-only otherwise.

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
