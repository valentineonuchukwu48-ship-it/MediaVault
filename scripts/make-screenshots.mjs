// Capture README screenshots of the running app (desktop panels + lightbox).
// Usage: node scripts/make-screenshots.mjs
// Requires: engine on 127.0.0.1:3000 (npm start) and Edge installed.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

function guessEdge() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error('Edge not found');
  return hit;
}

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname.replace(/^\/?([A-Za-z]:)/, '$1');
const SHOTS = process.argv[2] ?? OUT;

const VIEW = { width: 1440, height: 1000 };

async function shoot(browser) {
  const page = await browser.newPage();
  await page.setViewport(VIEW);

  const settles = (ms) => page.waitForNetworkIdle({ idleTime: 800, timeout: ms }).catch(() => {});

  // 1. PDF dossier studio (default home)
  await page.goto('http://127.0.0.1:3000/?mode=pdf_dossier', { waitUntil: 'domcontentloaded' });
  await settles(12000);
  await page.screenshot({ path: `${SHOTS}dossier.png` });
  console.log('✔ dossier.png');

  // 1b. Lightbox popup over the demo post photo (the click→popup feature)
  try {
    await page.click('img[alt="Post attachment"]', { timeout: 4000 });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('img')).some(
        (i) => i.closest('div.fixed.inset-0') && i.complete && i.naturalWidth > 0
      ),
      { timeout: 9000 }
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({ path: `${SHOTS}popup.png` });
    console.log('✔ popup.png');
    await page.keyboard.press('Escape');
  } catch (e) {
    console.log('– popup shot skipped:', String(e).slice(0, 120));
  }

  // 2. Media Vault
  await page.goto('http://127.0.0.1:3000/?mode=media_vault', { waitUntil: 'domcontentloaded' });
  await settles(12000);
  await page.screenshot({ path: `${SHOTS}vault.png` });
  console.log('✔ vault.png');

  // 3. Video studio
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await settles(12000);
  await page.screenshot({ path: `${SHOTS}studio.png` });
  console.log('✔ studio.png');

  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: guessEdge(),
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--hide-scrollbars'],
});
try {
  await shoot(browser);
} finally {
  await browser.close();
}
