**mediavault** — archive Facebook posts to tamper-evident PDFs, and download / merge videos with sound. Runs entirely on your own machine: no account, no server, your data never leaves your computer.

Created by **Valentine Onuchukwu** — ProsperChild Technology.

---

## 📥 Downloads

| Platform | File |
|---|---|
| **Windows (installer)** | `mediavault-{{VERSION}}-x64-setup.exe` |
| **Windows (portable, no install)** | `mediavault-{{VERSION}}-portable.exe` |
| **macOS (Apple Silicon)** | `mediavault-{{VERSION}}-arm64.dmg` |
| **Linux (AppImage)** | `mediavault-{{VERSION}}.AppImage` |
| **Linux (Debian/Ubuntu)** | `mediavault_{{VERSION}}_amd64.deb` |

### Windows notes
- SmartScreen may warn on first run because the app is **unsigned** (a code-signing certificate costs money). Click **More info → Run anyway**.
- The portable `.exe` needs no installation — just run it.

### macOS notes
- Unsigned build: right-click the app → **Open** the first time.
- Apple Silicon (M1/M2/M3/M4) only.

## ⏳ NEW — Court-grade time proof (v1.4.0)

Your archive now proves not just *what* it captured but **WHEN — anchored in the Bitcoin
blockchain**. Desktop panel → **Evidence vault → Anchor vault to Bitcoin calendar (free)**:
every sealed entry is stamped into the free public OpenTimestamps calendars (no account, no
key, no cost). Within hours each receipt upgrades to a Bitcoin block attestation
(*"this exact evidence existed on or before block NNNNNN"*), impossible to forge or backdate.
New seals follow automatically; the app shows live `anchored / pending` counts and a
**Time-proof ZIP** — every receipt + evidence line + a plain-English how-to-verify guide,
checkable by anyone with the official `ots` tools and zero trust in this app.

## 📊 NEW — Export your archive to Excel (v1.4.0)

Evidence vault section now includes **Export records to Excel (CSV)**: every archived post
with dates, URLs, authors, engagement numbers, content hashes and each entry's public
Bitcoin-anchor status — formula-injection-safe, UTF-8 correct on Windows.

## 🔄 Existing users: the app updates itself

If you already have an older version installed, you don't need to visit this page — the app
checks releases on startup (or via **Desktop → Check for updates**), downloads silently and
asks *"Restart to install?"*. Your evidence vault, watch list and receipts survive every
upgrade.

## 🔔 Deletion Radar (v1.3.0)

**Sealing proves what you saw. The Radar watches what Facebook does next.** Open the green
**Radar** button (bottom-left), paste any Facebook post URL → **Watch**. The engine re-checks it
anonymously on a schedule (like a logged-out visitor): if the post is **edited**, the vault keeps
both versions; if it is **deleted**, the vault keeps your sealed original — and **every open
window (your PC and paired phones) gets the alert live**, the moment it happens. No false
alarms: a deleted verdict needs two consecutive misses.

## 🔐 LAN security upgrade (v1.3.0)

Phone Connect now **pairs devices with a 6-digit code**: the QR code carries it, the desktop
panel shows it (APK users type it), wrong codes are blocked, and brute-force attempts are
rate-limited to 8/minute. Your engine on the Wi-Fi stays yours alone.

## 📖 Full documentation

New: **[docs/DOCUMENTATION.md](https://github.com/valentineonuchukwu48-ship-it/mediavault/blob/main/docs/DOCUMENTATION.md)** — the complete manual: how every feature works (vault hash math, video
pipeline, radar, verifier), all API routes, environment variables, troubleshooting and FAQ.

## 🔐 Zero-trust evidence verifier

Desktop → **Evidence vault** → **Download zero-trust verifier**. It produces a single portable
`.html` file containing your whole sealed archive plus an independent verification engine —
anyone can open it in any browser (no install, no account, no network) and see every hash
recomputed and the chain VERIFIED or TAMPERING DETECTED, byte-by-byte. Disclose evidence with
math, not promises.

## 📱 Mobile app (Android & iPhone) — NEW

Phone Connect puts the **same full app on your phone** over your Wi-Fi — the PC keeps doing the heavy lifting (yt-dlp, ffmpeg, vault, AI), so nothing is missing on mobile:

1. Open the desktop app on your PC → **Desktop panel (bottom-right) → Phone Connect → Share to my phone**.
2. Scan the QR code with your phone camera (phone and PC on the **same Wi-Fi**).
3. The full mediavault opens on your phone. Install it as an app:
   - **Android (Chrome):** menu (⋮) → **Add to Home screen** / **Install app**
   - **iPhone (Safari):** Share → **Add to Home Screen**

### Android APK (native companion)
`mediavault-Mobile-{{VERSION}}.apk` — installs with its own pairing screen:
1. Turn on **Phone Connect** in the desktop app.
2. Open the APK, type the address shown in the panel (e.g. `192.168.1.5:3000`).
3. Type the **6-digit pairing code** shown next to the QR code — the pairing screen appears in the app.
4. Done — the app remembers both. Videos download straight into your phone's Downloads.

Sideload note: unsigned build — Android asks you to allow "Install unknown apps" for your browser once.

## 🔐 Facebook login (important)

Public Reels and videos work out of the box. **Stories, private and age-gated videos need you to be signed in:**

1. Open the **Desktop** panel (bottom-right of the app).
2. Under **Facebook login**, pick the browser you use Facebook in and save — or click **Import cookies.txt** if your browser refuses (Chrome and Edge block cookie access while running).

## ☕ Support

Free forever. If it saves you time: [buy me a coffee](https://flutterwave.com/donate/fysqhtbnfznn)

---

© 2026 Valentine Onuchukwu — ProsperChild Technology · valentineonuchukwu@gmail.com · MIT License
