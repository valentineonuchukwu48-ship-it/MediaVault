/**
 * Download the media binaries the app shells out to (ffmpeg, ffprobe, yt-dlp)
 * into ./bin so electron-builder can ship them via extraResources.
 *
 *   node scripts/fetch-binaries.mjs                 # current platform
 *   node scripts/fetch-binaries.mjs --platform win32
 *   node scripts/fetch-binaries.mjs --force         # re-download even if present
 *
 * Extraction uses the system `tar` (bsdtar on Windows/macOS, GNU tar on Linux).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binDir = path.join(root, 'bin');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PLATFORM = arg('platform', process.platform);
const ARCH = arg('arch', process.arch);
const FORCE = process.argv.includes('--force');
const IS_WIN = PLATFORM === 'win32';

const SUFFIX = IS_WIN ? '.exe' : '';

function log(msg) {
  console.log(`[fetch-binaries] ${msg}`);
}

async function download(url, dest) {
  log(`download ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  log(`saved ${path.basename(dest)} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

/** Recursively find the first file with the given name under dir. */
function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return path.join(entry.parentPath || entry.path, entry.name);
    }
  }
  return null;
}

function extract(archive, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const isZip = archive.toLowerCase().endsWith('.zip');
  const args = isZip ? ['-xf', archive, '-C', outDir] : ['-xf', archive, '-C', outDir];
  execFileSync('tar', args, { stdio: 'inherit' });
}

function install(from, toName) {
  const target = path.join(binDir, toName);
  fs.copyFileSync(from, target);
  if (!IS_WIN) fs.chmodSync(target, 0o755);
  log(`installed ${toName}`);
}

async function has(name) {
  return fs.existsSync(path.join(binDir, name));
}

async function fetchYtDlp() {
  const name = `yt-dlp${SUFFIX}`;
  if (!FORCE && (await has(name))) return log(`${name} already present`);
  const urlMap = {
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  };
  const archMap = {
    'linux-arm64': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64',
  };
  const url = archMap[`${PLATFORM}-${ARCH}`] || urlMap[PLATFORM];
  if (!url) throw new Error(`No yt-dlp build for ${PLATFORM}/${ARCH}`);
  const tmp = path.join(os.tmpdir(), name);
  await download(url, tmp);
  install(tmp, name);
}

async function fetchFfmpegWindows() {
  if (!FORCE && (await has('ffmpeg.exe')) && (await has('ffprobe.exe'))) return log('ffmpeg/ffprobe already present');
  const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
  const zip = path.join(os.tmpdir(), 'ffmpeg-win.zip');
  await download(url, zip);
  const outDir = path.join(os.tmpdir(), 'ffmpeg-win');
  fs.rmSync(outDir, { recursive: true, force: true });
  extract(zip, outDir);
  for (const tool of ['ffmpeg.exe', 'ffprobe.exe']) {
    const found = findFile(outDir, tool);
    if (!found) throw new Error(`${tool} not found in ${url}`);
    install(found, tool);
  }
}

async function fetchFfmpegLinux() {
  if (!FORCE && (await has('ffmpeg')) && (await has('ffprobe'))) return log('ffmpeg/ffprobe already present');
  const arch = ARCH === 'arm64' ? 'arm64' : 'amd64';
  const url = `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${arch}-static.tar.xz`;
  const tarFile = path.join(os.tmpdir(), 'ffmpeg-linux.tar.xz');
  await download(url, tarFile);
  const outDir = path.join(os.tmpdir(), 'ffmpeg-linux');
  fs.rmSync(outDir, { recursive: true, force: true });
  extract(tarFile, outDir);
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const found = findFile(outDir, tool);
    if (!found) throw new Error(`${tool} not found in ${url}`);
    install(found, tool);
  }
}

async function fetchFfmpegMac() {
  if (!FORCE && (await has('ffmpeg')) && (await has('ffprobe'))) return log('ffmpeg/ffprobe already present');
  for (const [tool, url] of [
    ['ffmpeg', 'https://evermeet.cx/ffmpeg/getrelease/zip'],
    ['ffprobe', 'https://evermeet.cx/ffprobe/getrelease/zip'],
  ]) {
    const zip = path.join(os.tmpdir(), `${tool}-mac.zip`);
    await download(url, zip);
    const outDir = path.join(os.tmpdir(), `${tool}-mac`);
    fs.rmSync(outDir, { recursive: true, force: true });
    extract(zip, outDir);
    const found = findFile(outDir, tool);
    if (!found) throw new Error(`${tool} not found in ${url}`);
    install(found, tool);
  }
}

fs.mkdirSync(binDir, { recursive: true });
log(`target ${PLATFORM}/${ARCH} -> ${binDir}`);

await fetchYtDlp();
if (PLATFORM === 'win32') await fetchFfmpegWindows();
else if (PLATFORM === 'darwin') await fetchFfmpegMac();
else await fetchFfmpegLinux();

log('done');
