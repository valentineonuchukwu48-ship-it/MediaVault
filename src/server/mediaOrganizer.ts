/**
 * Media Organizer — the MediaVault core.
 *
 * Scans a folder of photos/videos, works out when each file was captured
 * (EXIF -> filename pattern -> file modified time) and, on request, moves
 * files into dated folders. Every organize run is journaled and reversible.
 *
 * Safety model, in order:
 *   1. Scan/preview never writes anything.
 *   2. Organize only moves files the scan saw, only under the scanned root,
 *      and only into `By Date/` folders it dereferences fresh each call.
 *   3. Destination collisions get an " (n)" suffix — nothing is overwritten.
 *   4. Every move is recorded in a journal file (dataDir/organizer-journals)
 *      so a run can be undone exactly, file-for-file.
 *   5. Cross-device moves (rename fails EXDEV) fall back to copy + verify +
 *      unlink; if the copy fails the original stays untouched.
 */
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import ExifReader from 'exifreader';

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.avif', '.heic', '.heif', '.tif', '.tiff',
]);
const VIDEO_EXTS = new Set([
  '.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.3gp', '.3g2', '.mpg', '.mpeg', '.wmv',
]);

const SCAN_MAX_DEPTH = 6;
const SCAN_MAX_FILES = 200_000;
const SESSION_MAX = 8;
const JOURNAL_KEEP = 10;

export interface MediaFileRecord {
  name: string;
  abs: string;
  rel: string;
  kind: 'photo' | 'video';
  size: number;
  /** ISO string when a date could be worked out, '' otherwise */
  date: string;
  dateSource: 'exif' | 'filename' | 'modified' | 'unknown';
}

interface MediaSession {
  root: string;
  files: MediaFileRecord[];
  created: number;
}

interface JournalMove {
  from: string;
  to: string;
}

interface Journal {
  id: string;
  root: string;
  created: number;
  mode: 'day' | 'month';
  moved: JournalMove[];
  failed: JournalMove[];
}

/** Folder names that already look like a prior organize run — never re-scan them. */
const ORGANIZED_DIR_RE = /^(19|20)\d{2}-\d{2}( \(\d+\)-\d{2})?(-\d{2}( \(\d+\))?)?$/;

function isMediaKindOf(ext: string): 'photo' | 'video' | null {
  if (IMAGE_EXTS.has(ext)) return 'photo';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

/** Parse "2024:05:12 14:03:22" (EXIF) and friends into ISO, or ''. */
export function parseExifDate(raw: string | undefined): string {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return '';
  const h = m[4] ? Number(m[4]) : 0;
  const mi = m[5] ? Number(m[5]) : 0;
  const s = m[6] ? Number(m[6]) : 0;
  if (h > 23 || mi > 59 || s > 59) return '';
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString();
}

/**
 * Phone/camera filename conventions:
 *   IMG-20240512-WA0011.jpg · IMG_20240512_123456.jpg · VID_yyyymmdd_hhmmss.mp4
 *   Screenshot_20240512-152300.png · 2024-05-12 14.03.22.jpg · PXL_20240512_130145.mp4
 */
export function dateFromFilename(name: string): string {
  // Work on maximal digit runs, then interpret them:
  //   • a lone 4-digit run 19xx/20xx        -> year, parts follow as runs (~separated styles)
  //   • one run of YYYYMMDD or YYYYMMDDHHMMSS -> compact phone/camera styles
  const runs = name.match(/\d+/g) || [];
  for (let i = 0; i < runs.length; i++) {
    const digits = runs[i];
    let year = 0;
    let month = 0;
    let day = 0;
    let hour = 0;
    let minute = 0;
    let second = 0;

    if (/^(19|20)\d{2}$/.test(digits)) {
      year = Number(digits);
      // Parts follow as separate 2-digit runs: Screenshot_2026-01-09-14-30-05…
      const parts: number[] = [];
      for (let k = i + 1; k < runs.length && parts.length < 5; k++) {
        if (!/^\d{2}$/.test(runs[k])) break;
        parts.push(Number(runs[k]));
      }
      month = parts[0];
      day = parts[1];
      hour = parts[2] ?? 0;
      minute = parts[3] ?? 0;
      second = parts[4] ?? 0;
    } else {
      const m = digits.match(/^((?:19|20)\d{2})(\d{4})(\d{6})?$/);
      if (!m) continue;
      year = Number(m[1]);
      month = Number(m[2].slice(0, 2));
      day = Number(m[2].slice(2, 4));
      const time = m[3] ? (m[3].match(/^(\d{2})(\d{2})(\d{2})$/) as RegExpMatchArray | null) : null;
      // Android writes the clock as a second run: IMG_20240512_123456.jpg
      let merged: RegExpMatchArray | null = time;
      if (!merged && runs[i + 1] && /^\d{6}$/.test(runs[i + 1])) {
        merged = runs[i + 1].match(/^(\d{2})(\d{2})(\d{2})$/);
      }
      if (merged) {
        const h = Number(merged[1]);
        const mi = Number(merged[2]);
        const s = Number(merged[3]);
        if (h <= 23 && mi <= 59 && s <= 59) {
          hour = h;
          minute = mi;
          second = s;
        } else {
          // Out-of-range clock means this run pair isn't a timestamp — skip whole candidate.
          continue;
        }
      }
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    if (hour > 23 || minute > 59 || second > 59) continue;
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }
  return '';
}

async function statDate(abs: string): Promise<string> {
  try {
    const st = await fsp.stat(abs);
    return st.mtime.toISOString();
  } catch {
    return '';
  }
}

async function extractDate(abs: string, name: string, kind: 'photo' | 'video'): Promise<{ date: string; dateSource: MediaFileRecord['dateSource'] }> {
  if (kind === 'photo') {
    try {
      const tags = await ExifReader.load(abs, { expanded: false }) as unknown as Record<string, { description?: string }>;
      const single = (tag: string): string | undefined => {
        const t = (tags as Record<string, unknown>)[tag];
        if (Array.isArray(t)) return undefined;
        return (t as { description?: string })?.description;
      };
      const fromExif =
        parseExifDate(single('DateTimeOriginal')) ||
        parseExifDate(single('DateTime')) ||
        parseExifDate(single('DateTimeDigitized'));
      if (fromExif) return { date: fromExif, dateSource: 'exif' };
    } catch {
      /* unsupported format (HEIC variants, corrupt file...) -> fall through */
    }
  }
  const fromName = dateFromFilename(name);
  if (fromName) return { date: fromName, dateSource: 'filename' };
  const modified = await statDate(abs);
  if (modified) return { date: modified, dateSource: 'modified' };
  return { date: '', dateSource: 'unknown' };
}

function listMediaFiles(root: string): { files: MediaFileRecord[]; skippedDirs: string[] } {
  const files: MediaFileRecord[] = [];
  const skippedDirs: string[] = [];

  const visit = (dir: string, depth: number): void => {
    if (files.length >= SCAN_MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      /* unreadable folder — report and continue */
      skippedDirs.push(dir);
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;
      if (entry.isDirectory()) {
        if (depth >= SCAN_MAX_DEPTH) continue;
        if (ORGANIZED_DIR_RE.test(entry.name) && dir === root) continue;
        visit(abs, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const kind = isMediaKindOf(ext);
        if (!kind) continue;
        files.push({
          name: entry.name,
          abs,
          rel: path.relative(root, abs),
          kind,
          size: 0,
          date: '',
          dateSource: 'unknown',
        });
        if (files.length >= SCAN_MAX_FILES) return;
      }
    }
  };

  visit(root, 0);
  return { files, skippedDirs };
}

/** YYYY-MM / YYYY-MM-DD from ISO, unbiased by local timezone. */
export function folderName(iso: string, mode: 'day' | 'month'): string {
  if (!iso) return 'Undated';
  const t = iso.slice(0, 10);
  const [y, m, d] = t.split('-');
  if (!y || !m || (mode === 'day' && !d)) return 'Undated';
  return mode === 'day' ? `${y}-${m}-${d}` : `${y}-${m}`;
}

function uniqueTarget(dir: string, name: string, taken: Set<string>): string {
  let candidate = path.join(dir, name);
  if (!taken.has(candidate) && !fs.existsSync(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let n = 1; n < 10_000; n++) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
    if (!taken.has(candidate) && !fs.existsSync(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Could not find a free name for ${name}`);
}

async function moveOne(from: string, to: string): Promise<void> {
  try {
    await fsp.rename(from, to);
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV') throw err;
  }
  // Cross-device: copy, verify byte count, then remove the original.
  await fsp.copyFile(from, to);
  const [a, b] = await Promise.all([fsp.stat(from), fsp.stat(to)]);
  if (a.size !== b.size) {
    await fsp.rm(to, { force: true });
    throw new Error(`copy size mismatch for ${path.basename(from)}`);
  }
  await fsp.unlink(from);
}

function ensureWithinRoot(root: string, target: string): void {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Refusing to touch files outside the selected folder');
  }
}

function journalsDir(dataDir: string): string {
  return path.join(dataDir, 'organizer-journals');
}

function pruneJournals(dataDir: string): void {
  try {
    const dir = journalsDir(dataDir);
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (all.length <= JOURNAL_KEEP) return;
    const withTime = all.map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
    withTime.sort((a, b) => b.t - a.t);
    for (const stale of withTime.slice(JOURNAL_KEEP)) {
      try { fs.unlinkSync(path.join(dir, stale.f)); } catch { /* fine */ }
    }
  } catch { /* fine */ }
}

interface OrganizerDeps {
  dataDir: string;
  /** App-suggested starting points (engine's own outputs, user folders). */
  quickPicks?: Array<{ label: string; path: string }>;
}

export function createMediaRouter({ dataDir, quickPicks = [] }: OrganizerDeps): Router {
  const router = Router();
  const sessions = new Map<string, MediaSession>();
  let scanning = false;

  const sessionFor = (rootId: unknown): MediaSession | null => {
    const id = typeof rootId === 'string' ? rootId : '';
    return sessions.get(id) || null;
  };

  /** Where the app suggests you start: engine outputs + the usual user folders. */
  router.get('/defaults', (_req: Request, res: Response) => {
    res.json({ quickPicks });
  });

  router.post('/scan', async (req: Request, res: Response) => {
    const raw = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
    if (!raw) return res.status(400).json({ error: 'Send the folder you want to organise in "dir".' });
    if (scanning) return res.status(409).json({ error: 'A scan is already running.' });

    const root = path.resolve(raw);
    let st: fs.Stats;
    try {
      st = await fsp.stat(root);
    } catch {
      return res.status(400).json({ error: `Folder not found: ${root}` });
    }
    if (!st.isDirectory()) return res.status(400).json({ error: `Not a folder: ${root}` });

    scanning = true;
    try {
      const { files, skippedDirs } = listMediaFiles(root);
      const photos = files.filter((f) => f.kind === 'photo');
      for (const file of photos) {
        const exif = await extractDate(file.abs, file.name, 'photo');
        file.date = exif.date;
        file.dateSource = exif.dateSource;
      }
      for (const file of files.filter((f) => f.kind === 'video')) {
        const meta = await extractDate(file.abs, file.name, 'video');
        file.date = meta.date;
        file.dateSource = meta.dateSource;
      }

      // Fill sizes (photos already looped; do everything here in one pass).
      for (const file of files) {
        try { file.size = (await fsp.stat(file.abs)).size; } catch { file.size = 0; }
      }

      // Keep only the freshest N sessions.
      if (sessions.size >= SESSION_MAX) {
        const oldest = [...sessions.entries()].sort((a, b) => a[1].created - b[1].created)[0];
        sessions.delete(oldest?.[0] ?? '');
      }
      const rootId = crypto.randomBytes(8).toString('hex');
      sessions.set(rootId, { root, files, created: Date.now() });

      // Group summary by month for the timeline preview.
      const byMonth = new Map<string, { photos: number; videos: number; bytes: number }>();
      let undated = 0;
      for (const file of files) {
        const month = file.date ? file.date.slice(0, 7) : 'undated';
        if (month === 'undated') undated++;
        const entry = byMonth.get(month) || { photos: 0, videos: 0, bytes: 0 };
        if (file.kind === 'photo') entry.photos++;
        else entry.videos++;
        entry.bytes += file.size;
        byMonth.set(month, entry);
      }
      const months = [...byMonth.entries()]
        .filter(([m]) => m !== 'undated')
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, v]) => ({ month, ...v }));

      return res.json({
        rootId,
        root,
        total: files.length,
        photos: photos.length,
        videos: files.length - photos.length,
        undated,
        skippedDirs: skippedDirs.slice(0, 5),
        truncated: files.length >= SCAN_MAX_FILES,
        months,
        files: files.map((f) => ({
          name: f.name,
          rel: f.rel,
          kind: f.kind,
          size: f.size,
          date: f.date,
          dateSource: f.dateSource,
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: String((err as Error).message || err) });
    } finally {
      scanning = false;
    }
  });

  /** Serve a scanned media file (previews in the gallery). */
  router.get('/file', (req: Request, res: Response) => {
    const session = sessionFor(req.query.rootId);
    if (!session) return res.status(404).json({ error: 'Scan expired — scan the folder again.' });
    const rel = typeof req.query.p === 'string' ? req.query.p : '';
    if (!rel) return res.status(400).json({ error: 'Missing p' });
    const abs = path.resolve(session.root, rel);
    if (abs !== session.root) ensureWithinRoot(session.root, abs);
    try {
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File is gone' });
    } catch {
      return res.status(404).json({ error: 'File is gone' });
    }
    res.sendFile(abs);
  });

  /** Compute the movements an organize would perform — nothing is written. */
  function planMoves(mode: 'day' | 'month', session: MediaSession): { dir: JournalMove['to']; files: JournalMove[] }[] {
    const groups = new Map<string, JournalMove[]>();
    const taken = new Set<string>();
    const base = path.join(session.root, 'By Date');
    for (const file of session.files) {
      try {
        // Gone since the scan (already moved / deleted) -> nothing to do.
        if (!fs.existsSync(file.abs)) continue;
      } catch {
        continue;
      }
      const folder = folderName(file.date, mode);
      const targetDir = path.join(base, folder);
      const sourceDir = path.dirname(file.abs);
      // Skip files already sitting in their correct dated folder.
      try {
        if (sourceDir === targetDir) {
          const takenFolder = new Set(fs.readdirSync(targetDir));
          takenFolder.forEach((f) => taken.add(path.join(targetDir, f)));
          continue;
        }
      } catch { /* dir may not exist yet */ }
      const to = uniqueTarget(targetDir, file.name, taken);
      const list = groups.get(targetDir) || [];
      list.push({ from: file.abs, to });
      groups.set(targetDir, list);
    }
    const dirList = [...groups.keys()].sort();
    return dirList.map((dir) => ({ dir, files: groups.get(dir) as JournalMove[] }));
  }

  router.post('/preview', (req: Request, res: Response) => {
    const session = sessionFor(req.body?.rootId);
    if (!session) return res.status(404).json({ error: 'Scan expired — scan the folder again.' });
    const mode: 'day' | 'month' = req.body?.mode === 'day' ? 'day' : 'month';
    try {
      const plan = planMoves(mode, session);
      return res.json({
        mode,
        folders: plan.map((entry) => ({ dir: entry.dir, count: entry.files.length })),
        sample: plan.slice(0, 40).map((entry) => ({ dir: entry.dir, sample: entry.files[0]?.from ?? '' })),
        total: plan.reduce((sum, entry) => sum + entry.files.length, 0),
      });
    } catch (err) {
      return res.status(500).json({ error: String((err as Error).message || err) });
    }
  });

  router.post('/apply', async (req: Request, res: Response) => {
    const session = sessionFor(req.body?.rootId);
    if (!session) return res.status(404).json({ error: 'Scan expired — scan the folder again.' });
    const mode: 'day' | 'month' = req.body?.mode === 'day' ? 'day' : 'month';

    try {
      const plan = planMoves(mode, session);
      const journal: Journal = {
        id: crypto.randomBytes(8).toString('hex'),
        root: session.root,
        created: Date.now(),
        mode,
        moved: [],
        failed: [],
      };
      for (const entry of plan) {
        try { fs.mkdirSync(entry.dir, { recursive: true }); } catch { /* moveOne surfaces */ }
        for (const move of entry.files) {
          ensureWithinRoot(session.root, move.from);
          ensureWithinRoot(session.root, move.to);
          try {
            await moveOne(move.from, move.to);
            journal.moved.push(move);
          } catch (err) {
            journal.failed.push({ from: `${move.from}`, to: `${(err as Error).message || err}` });
          }
        }
      }
      try {
        fs.mkdirSync(journalsDir(dataDir), { recursive: true });
        fs.writeFileSync(path.join(journalsDir(dataDir), `${journal.id}.json`), JSON.stringify(journal, null, 2));
        pruneJournals(dataDir);
      } catch { /* undo unavailable but the run itself still succeeded */ }

      return res.json({
        ok: true,
        undoId: journal.id,
        moved: journal.moved.length,
        failed: journal.failed.length,
        failures: journal.failed.slice(0, 10),
        folders: [...new Set(journal.moved.map((m) => path.dirname(m.to)))].length,
      });
    } catch (err) {
      return res.status(500).json({ error: String((err as Error).message || err) });
    }
  });

  router.post('/undo', async (req: Request, res: Response) => {
    const id = typeof req.body?.undoId === 'string' ? req.body.undoId : '';
    if (!id) return res.status(400).json({ error: 'Send "undoId".' });
    const journalPath = path.join(journalsDir(dataDir), `${id}.json`);
    let journal: Journal;
    try {
      journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as Journal;
    } catch {
      return res.status(404).json({ error: 'That organize run can no longer be undone (journal removed).' });
    }
    let restored = 0;
    const failed: Array<{ from: string; error: string }> = [];
    for (const move of [...journal.moved].reverse()) {
      try {
        if (!fs.existsSync(move.to)) continue; // already gone (user tidied manually)
        const back = move.from;
        try { fs.mkdirSync(path.dirname(back), { recursive: true }); } catch { /* surfaced below */ }
        await moveOne(move.to, back);
        restored++;
      } catch (err) {
        failed.push({ from: move.to, error: String((err as Error).message || err) });
      }
    }
    if (failed.length === 0) {
      try { fs.unlinkSync(journalPath); } catch { /* fine */ }
    }
    return res.json({ ok: true, restored, failed });
  });

  return router;
}
