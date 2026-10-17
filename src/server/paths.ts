/**
 * Central path + binary resolution for FacebookGrabContents.
 *
 * The app runs in three environments, and every one of them needs *writable*
 * storage for the vault, uploads, generated audio and merged videos:
 *
 *   1. Plain web dev        -> <repo>/data            (FGC_* unset, cwd = repo)
 *   2. Packaged desktop app -> %APPDATA%/.../data     (Electron sets FGC_DATA_DIR)
 *   3. Docker/server        -> /data                  (container sets FGC_DATA_DIR)
 *
 * A packaged app's own install folder is READ-ONLY (it lives inside an asar
 * archive), so nothing runtime-generated may ever be written next to the code.
 * Everything dynamic goes through DATA_DIR here; only shipped, immutable assets
 * (the built frontend, sample clips) are read from the app folder.
 */
import fs from 'fs';
import path from 'path';

const IS_WINDOWS = process.platform === 'win32';

/** Root of the app's shipped code/assets (repo in dev, app folder when packaged). */
export const APP_ROOT = process.env.FGC_APP_ROOT || process.cwd();

/** Writable, persistent per-user storage. */
export const DATA_DIR = process.env.FGC_DATA_DIR || path.resolve(APP_ROOT, 'data');

/** Folder holding the bundled media binaries (ffmpeg/ffprobe/yt-dlp). */
export const BIN_DIR = process.env.FGC_BIN_DIR || path.resolve(APP_ROOT, 'bin');

/** Built frontend (index.html + assets) served in production. */
export const DIST_DIR = process.env.FGC_DIST_DIR || path.resolve(APP_ROOT, 'dist');

/** Immutable shipped assets, used in dev before a build exists. */
export const PUBLIC_DIR = process.env.FGC_PUBLIC_DIR || path.resolve(APP_ROOT, 'public');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const AUDIO_DIR = path.join(DATA_DIR, 'audio');
export const MERGED_DIR = path.join(DATA_DIR, 'merged_outputs');
export const TEMP_DIR = path.join(DATA_DIR, 'tmp');
export const VAULT_DIR = path.join(DATA_DIR, 'vault');
export const EXPORT_DIR = path.join(DATA_DIR, 'exports');

/** Create every runtime directory up-front so no request can race a missing dir. */
export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, UPLOADS_DIR, AUDIO_DIR, MERGED_DIR, TEMP_DIR, VAULT_DIR, EXPORT_DIR]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* best effort — a failure surfaces later with a clearer error */
    }
  }
}

function firstExisting(candidates: (string | undefined)[], fallback: string): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

function binName(tool: string): string {
  return IS_WINDOWS ? `${tool}.exe` : tool;
}

/**
 * Locate a bundled media binary. Search order:
 *   1. explicit env override (FGC_FFMPEG_PATH / FGC_FFPROBE_PATH / FGC_YTDLP_PATH)
 *   2. the bundled bin/ folder
 *   3. the legacy in-repo locations (so an existing checkout keeps working)
 *   4. bare name -> resolved from PATH (last resort)
 */
export const FFMPEG_PATH =
  process.env.FGC_FFMPEG_PATH ||
  firstExisting(
    [path.join(BIN_DIR, binName('ffmpeg')), path.resolve(APP_ROOT, binName('ffmpeg')), path.resolve(APP_ROOT, 'bin', binName('ffmpeg'))],
    'ffmpeg',
  );

export const FFPROBE_PATH =
  process.env.FGC_FFPROBE_PATH ||
  firstExisting(
    [path.join(BIN_DIR, binName('ffprobe')), path.resolve(APP_ROOT, binName('ffprobe')), path.resolve(APP_ROOT, 'bin', binName('ffprobe'))],
    'ffprobe',
  );

export const YTDLP_PATH =
  process.env.FGC_YTDLP_PATH ||
  firstExisting(
    [
      path.join(BIN_DIR, binName('yt-dlp')),
      path.resolve(APP_ROOT, binName('yt-dlp')),
      path.resolve(APP_ROOT, 'bin', binName('yt-dlp')),
      '/bin_tools/yt-dlp',
      '/tmp/yt-dlp',
    ],
    'yt-dlp',
  );

/** True once the app has been built (dist/index.html exists). */
export function hasBuiltFrontend(): boolean {
  try {
    return fs.existsSync(path.join(DIST_DIR, 'index.html'));
  } catch {
    return false;
  }
}
