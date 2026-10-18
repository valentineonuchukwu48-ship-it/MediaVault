**FacebookGrabContents** — archive Facebook posts to tamper-evident PDFs, and download / merge videos with sound. Runs entirely on your own machine: no account, no server, your data never leaves your computer.

Created by **Valentine Onuchukwu** — ProsperChild Technology, Nigeria.

---

## 📥 Downloads

| Platform | File |
|---|---|
| **Windows (installer)** | `FacebookGrabContents-{{VERSION}}-x64-setup.exe` |
| **Windows (portable, no install)** | `FacebookGrabContents-{{VERSION}}-portable.exe` |
| **macOS (Apple Silicon)** | `FacebookGrabContents-{{VERSION}}-arm64.dmg` |
| **Linux (AppImage)** | `FacebookGrabContents-{{VERSION}}.AppImage` |
| **Linux (Debian/Ubuntu)** | `facebookgrabcontents_{{VERSION}}_amd64.deb` |

### Windows notes
- SmartScreen may warn on first run because the app is **unsigned** (a code-signing certificate costs money). Click **More info → Run anyway**.
- The portable `.exe` needs no installation — just run it.

### macOS notes
- Unsigned build: right-click the app → **Open** the first time.
- Apple Silicon (M1/M2/M3/M4) only.

## 📱 Mobile app (Android & iPhone) — NEW

Phone Connect puts the **same full app on your phone** over your Wi-Fi — the PC keeps doing the heavy lifting (yt-dlp, ffmpeg, vault, AI), so nothing is missing on mobile:

1. Open the desktop app on your PC → **Desktop panel (bottom-right) → Phone Connect → Share to my phone**.
2. Scan the QR code with your phone camera (phone and PC on the **same Wi-Fi**).
3. The full FacebookGrabContents opens on your phone. Install it as an app:
   - **Android (Chrome):** menu (⋮) → **Add to Home screen** / **Install app**
   - **iPhone (Safari):** Share → **Add to Home Screen**

### Android APK (native companion)
`FacebookGrabContents-Mobile-{{VERSION}}.apk` — installs with its own pairing screen:
1. Turn on **Phone Connect** in the desktop app.
2. Open the APK, type the address shown in the panel (e.g. `192.168.1.5:3000`).
3. Done — the app remembers your PC. Videos download straight into your phone's Downloads.

Sideload note: unsigned build — Android asks you to allow "Install unknown apps" for your browser once.

## 🔐 Facebook login (important)

Public Reels and videos work out of the box. **Stories, private and age-gated videos need you to be signed in:**

1. Open the **Desktop** panel (bottom-right of the app).
2. Under **Facebook login**, pick the browser you use Facebook in and save — or click **Import cookies.txt** if your browser refuses (Chrome and Edge block cookie access while running).

## ☕ Support

Free forever. If it saves you time: [buy me a coffee](https://flutterwave.com/donate/fysqhtbnfznn)

---

© 2026 Valentine Onuchukwu — ProsperChild Technology, Nigeria · valentineonuchukwu@gmail.com · MIT License
