/**
 * Render the application icon (build-resources/icon.png) with ffmpeg so the
 * installer, taskbar and window have a real brand mark instead of the default
 * Electron logo. electron-builder converts this PNG into the platform formats.
 *
 * Non-fatal: if ffmpeg is unavailable, packaging still succeeds with the
 * default icon.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'build-resources');
const outFile = path.join(outDir, 'icon.png');

// The rendered icon is committed to the repo, so only regenerate it when it is
// missing. Keeps CI deterministic and removes the ffmpeg dependency on
// runners that don't ship it.
if (fs.existsSync(outFile)) {
  console.log('[make-icon] build-resources/icon.png already exists; skipping');
  process.exit(0);
}

const FONT_CANDIDATES = [
  'C:/Windows/Fonts/seguisb.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
  'C:/Windows/Fonts/arial.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];

function firstFont() {
  for (const f of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(f)) return f;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const font = firstFont();
if (!font) {
  console.warn('[make-icon] no suitable font found; skipping icon generation');
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

// Keep the font reference relative and run ffmpeg from the font's folder so we
// never have to escape the drive colon ("C:") inside a filter string.
const fontDir = path.dirname(font);
const fontFile = path.basename(font);

const filter = [
  // Soft dark vignette at the bottom for depth.
  'drawbox=x=0:y=730:w=1024:h=294:color=0x020617@0.35:t=fill',
  // Monogram.
  `drawtext=fontfile=${fontFile}:text=FG:fontcolor=white:fontsize=430:x=(w-text_w)/2:y=(h-text_h)/2-40`,
  // Small caption bar (ASCII only — safest across font/ffmpeg builds).
  `drawtext=fontfile=${fontFile}:text=GRAB - MERGE - ARCHIVE:fontcolor=0xdbeafe:fontsize=42:x=(w-text_w)/2:y=880`,
].join(',');

const args = [
  '-y',
  '-f', 'lavfi',
  // Diagonal brand gradient used as the source image.
  '-i', 'gradients=s=1024x1024:c0=0x4338ca:c1=0x06b6d4:x0=0:y0=0:x1=1024:y1=1024',
  '-vf', filter,
  '-frames:v', '1',
  '-update', '1',
  outFile,
];

try {
  execFileSync('ffmpeg', args, { stdio: 'inherit', cwd: fontDir });
  console.log(`[make-icon] wrote ${outFile}`);
} catch (err) {
  console.warn(`[make-icon] ffmpeg failed (${err.message}); using default icon`);
}
