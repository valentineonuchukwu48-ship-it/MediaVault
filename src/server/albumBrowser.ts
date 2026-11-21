/**
 * Cookie-free full-album extraction.
 *
 * Facebook's Embedded Post plugin only renders a short preview of a
 * multi-photo post (a handful of images and a "+N" tile). The rest of the
 * gallery lives in the photo viewer, which is reachable from that tile and
 * lazy-loads one photo at a time.
 *
 * This module opens a **fresh, isolated, headless browser profile** (no login,
 * no cookies, no saved credentials), follows the public album viewer link and
 * pages through it, collecting every photo URL Facebook exposes for a public
 * post. Nothing is imported from the user's browser and nothing is persisted.
 *
 * Safety properties:
 *   - Only allows navigation to facebook.com / fb.com HTTPS URLs.
 *   - Uses a temporary user-data directory that is deleted on exit.
 *   - Never reads, writes or imports cookies.txt or credentials.
 *   - Bounded timeouts and iteration caps; no runaway browser sessions.
 *   - Reuses a single browser instance and serialises requests.
 */
import puppeteer, { Browser, Page } from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';

const MAX_VIEWER_STEPS = 160;
const MAX_STAGNANT_STEPS = 6;
const PAGE_TIMEOUT_MS = 25_000;
const STEP_DELAY_MS = 650;

let browserPromise: Promise<Browser> | null = null;
let activeBrowser: Browser | null = null;
let tail: Promise<void> = Promise.resolve();
let profileDir: string | null = null;
let cleanupRegistered = false;
let idleTimer: NodeJS.Timeout | null = null;
let activeJobs = 0;
const IDLE_CLOSE_MS = 120_000;

/** Transient browser hiccups that are worth one clean retry. */
function isTransientBrowserError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /detached|target closed|session closed|browser has been closed|protocol error|navigation|timeout|crash/i.test(
    message,
  );
}

/** Discard a broken browser so the next job starts from a clean process. */
function resetBrowser(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  browserPromise = null;
  const stale = activeBrowser;
  activeBrowser = null;
  if (stale) void stale.close().catch(() => undefined);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Only ever navigate to Facebook over HTTPS. This blocks SSRF-style abuse. */
function isAllowedFacebookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com');
  } catch {
    return false;
  }
}

/** Locate an already-installed browser. Never downloads anything. */
export function findChromeExecutable(): string | null {
  const envCandidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ].filter((p): p is string => Boolean(p && p.trim()));
  for (const p of envCandidates) {
    if (fs.existsSync(p)) return p;
  }

  const candidates: string[] = [];
  if (process.platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    candidates.push(
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function removeProfileDir() {
  if (!profileDir) return;
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  profileDir = null;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = findChromeExecutable();
    if (!executablePath) throw new Error('No local Chrome/Edge executable found');
    if (!profileDir) {
      profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediavault-album-'));
      if (!cleanupRegistered) {
        cleanupRegistered = true;
        process.once('exit', removeProfileDir);
      }
    }
    browserPromise = puppeteer
      .launch({
        executablePath,
        headless: true,
        userDataDir: profileDir,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--no-first-run',
          '--no-default-browser-check',
        ],
      })
      .then((browser) => {
        activeBrowser = browser;
        browser.once('disconnected', () => {
          if (activeBrowser === browser) activeBrowser = null;
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/** Close the shared browser after a quiet period so no process lingers. */
function scheduleIdleClose(browser: Browser): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeJobs > 0) {
      scheduleIdleClose(browser);
      return;
    }
    if (activeBrowser === browser) resetBrowser();
    else void browser.close().catch(() => undefined);
    removeProfileDir();
  }, IDLE_CLOSE_MS);
  idleTimer.unref?.();
}

/** Serialise album jobs so we only ever run one browser workflow at a time. */
function withBrowser<T>(job: (browser: Browser) => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    // A new job cancels any pending idle shutdown before it can close the
    // browser out from under us.
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    activeJobs++;
    const browser = await getBrowser();
    try {
      return await job(browser);
    } finally {
      activeJobs--;
      scheduleIdleClose(browser);
    }
  });
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** photo-id -> full CDN URL, collected from the current DOM. */
async function collectVisiblePhotos(page: Page, into: Map<string, string>): Promise<void> {
  const urls = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img[src*="fbcdn.net"]'))
      .map((img) => (img as HTMLImageElement).src)
      .filter((src) => !/rsrc\.php|emoji\.php|s200x200/i.test(src)),
  );
  for (const url of urls) {
    const match = url.match(/\/(\d+_\d+_\d+)/);
    if (!match) continue;
    if (!/fbcdn\.net/i.test(url)) continue;
    if (!into.has(match[1])) into.set(match[1], url);
  }
}

/** Find the link that opens the full photo viewer for this post. */
async function findAlbumViewerLink(page: Page): Promise<string | null> {
  // NOTE: keep this callback completely self-contained. esbuild adds a `__name`
  // helper to named inner functions, which does not exist in the browser where
  // page.evaluate runs. Use inline code only — no named helpers.
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('a[href], div, span'));

    // 1. The "+N" overflow tile is the most reliable pointer to the full album.
    for (const el of all) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^\+\d+$/.test(text)) continue;
      const anchor = el.tagName === 'A' ? el : el.closest('a');
      if (!anchor) continue;
      try {
        const url = new URL((anchor as HTMLAnchorElement).href, location.href).href;
        if (/facebook\.com\/photo\//i.test(url) && /[?&]set=(?:pcb|a)\./i.test(url)) return url;
      } catch {}
    }
    // 2. Some layouts label it "See all photos" / "See more".
    for (const el of all) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^see (all )?photos$/i.test(text) && !/^see more$/i.test(text)) continue;
      const anchor = el.tagName === 'A' ? el : el.closest('a');
      if (!anchor) continue;
      try {
        const url = new URL((anchor as HTMLAnchorElement).href, location.href).href;
        if (/facebook\.com\/photo\//i.test(url) && /[?&]set=(?:pcb|a)\./i.test(url)) return url;
      } catch {}
    }
    // 3. Fall back to any photo-viewer link carrying an album set id.
    for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
      try {
        const url = new URL((anchor as HTMLAnchorElement).href, location.href).href;
        if (/facebook\.com\/photo\//i.test(url) && /[?&]set=(?:pcb|a)\./i.test(url)) return url;
      } catch {}
    }
    return null;
  });
}

export type AlbumFetchResult = {
  images: string[];
  /** Human-readable reason when nothing extra could be collected. */
  note?: string;
};

/**
 * Open a public post in a clean browser, follow its album viewer and collect
 * all photos. Returns an empty list when the browser is unavailable or the
 * content is private — callers keep their existing preview images in that case.
 */
export async function fetchAlbumImagesViaBrowser(
  postUrl: string,
  _previewPhotoIds: string[] = [],
): Promise<AlbumFetchResult> {
  if (!isAllowedFacebookUrl(postUrl)) {
    return { images: [], note: 'Refused to open a non-Facebook URL' };
  }
  if (!findChromeExecutable()) {
    return { images: [], note: 'No local Chrome/Edge found for album expansion' };
  }

  const job = async (browser: Browser): Promise<AlbumFetchResult> => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      );
      await page.setDefaultTimeout(PAGE_TIMEOUT_MS);

      const res = await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      if (!res || !res.ok()) {
        return { images: [], note: `Post page returned HTTP ${res?.status() ?? 'unknown'}` };
      }
      await delay(3_000);

      const photos = new Map<string, string>();
      await collectVisiblePhotos(page, photos);

      const viewerUrl = await findAlbumViewerLink(page);
      if (!viewerUrl || !isAllowedFacebookUrl(viewerUrl)) {
        return {
          images: [...photos.values()],
          note: 'No public album viewer link found (post may have a single photo)',
        };
      }

      await page.goto(viewerUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await delay(2_500);
      await collectVisiblePhotos(page, photos);

      let stagnant = 0;
      for (let step = 0; step < MAX_VIEWER_STEPS; step++) {
        const before = photos.size;
        const clicked = await page.evaluate(() => {
          const next =
            document.querySelector('[aria-label="Next photo"]') ||
            document.querySelector('[aria-label*="Next photo"]');
          if (!next) return false;
          (next as HTMLElement).click();
          return true;
        });
        if (!clicked) break;
        await delay(STEP_DELAY_MS);
        await collectVisiblePhotos(page, photos);
        stagnant = photos.size > before ? 0 : stagnant + 1;
        if (stagnant >= MAX_STAGNANT_STEPS) break;
      }

      return { images: [...photos.values()] };
    } catch (err) {
      // Let the caller retry with a fresh browser for transient failures
      // instead of silently falling back to the 5 preview images.
      if (isTransientBrowserError(err)) throw err;
      return {
        images: [],
        note: `Album browser error: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await withBrowser(job);
    } catch (err) {
      lastError = err;
      if (attempt === 0 && isTransientBrowserError(err)) {
        resetBrowser();
        await delay(750);
        continue;
      }
      break;
    }
  }
  return {
    images: [],
    note: `Album browser error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  };
}
