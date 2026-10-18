/**
 * Deletion Radar — scheduled re-checks of archived posts.
 *
 * What got us here: people seal a post into the vault today; weeks later
 * Facebook silently deletes or edits it. The vault already records those
 * facts when told to scan (`/api/vault/scan`), but nobody remembers to
 * press the button. The radar is the button that presses itself:
 *
 *   - a watch list (DATA_DIR/radar/watch.json) of taskId → post URL
 *   - a periodic scan that re-fetches each watched post anonymously,
 *     exactly the way logged-out crawlers see it
 *   - content changes  (different text than the baseline) → EDIT alert
 *   - vanished/login-gated twice in a row → DELETED alert, and the full
 *     original is appended to the vault as DELETE_DETECTED, preserved
 *   - every alert is broadcast to every open app window (desktop AND the
 *     phone over Wi-Fi) over Server-Sent Events (/api/radar/stream)
 *
 * Scan heuristics are deliberately conservative: one failed fetch means
 * "unknown" (rate limit / network hiccup); two consecutive misses are
 * needed before declaring a deletion.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Response } from 'express';
import { DATA_DIR, ensureDataDirs } from './paths';
import { recordChange, latestForPost, contentHashOf } from './vaultStore';

export type RadarStatus = 'ok' | 'edited' | 'deleted' | 'unknown';

export interface RadarTask {
  postId: string;
  url: string;
  /** Hash of the most recent successfully-read text; null until first read. */
  baselineHash: string | null;
  status: RadarStatus;
  lastChecked: string | null;
  consecutiveMisses: number;
}

export interface RadarEvent {
  type: 'RADAR_EDIT' | 'RADAR_DELETE';
  postId: string;
  seq?: number;
  at: string;
  detail: string;
}

const RADAR_DIR = path.join(DATA_DIR, 'radar');
const WATCH_FILE = path.join(RADAR_DIR, 'watch.json');
const EVENTS_FILE = path.join(RADAR_DIR, 'events.json');
const MAX_EVENTS = 200;

const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    /* torn write — fall back */
  }
  return fallback;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(RADAR_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function loadTasks(): RadarTask[] {
  return readJson<RadarTask[]>(WATCH_FILE, []);
}

function saveTasks(tasks: RadarTask[]): void {
  writeJson(WATCH_FILE, tasks);
}

function loadEvents(): RadarEvent[] {
  return readJson<RadarEvent[]>(EVENTS_FILE, []);
}

// ---------------------------------------------------------------------------
// Live re-fetch — what the anonymous public sees for this URL, right now.
// (The vault stores what the user saw; the radar compares the two worlds.)
// ---------------------------------------------------------------------------

async function refetchPostText(
  url: string
): Promise<{ visible: boolean; content: string }> {
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': CRAWLER_UA, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) html = await res.text();
  } catch {
    return { visible: false, content: '' };
  }
  if (!html) return { visible: false, content: '' };

  const tag = (prop: string): string => {
    const m =
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["'](.*?)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["'](.*?)["'][^>]*property=["']${prop}["']`, 'i'));
    return m ? m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim() : '';
  };

  const title = tag('og:title');
  const description = tag('og:description');

  // Facebook answers OK with a login wall when anonymous visitors are locked
  // out — treat that as "not visible to the world", not as deleted text.
  const looksLoginWalled =
    /log (in|into)|sign up/i.test(title) ||
    /see posts, photos and more on facebook|log in to facebook/i.test(description) ||
    /^facebook$/i.test(title.trim());

  if (looksLoginWalled) return { visible: false, content: '' };
  const content = description || title;
  return content ? { visible: true, content } : { visible: false, content: '' };
}

// ---------------------------------------------------------------------------
// Alerts: persisted history + live SSE broadcast
// ---------------------------------------------------------------------------

const sseClients = new Set<Response>();

function pushEvent(evt: RadarEvent): void {
  const events = loadEvents();
  events.unshift(evt);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  writeJson(EVENTS_FILE, events);
  const frame = `data: ${JSON.stringify(evt)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function radarEventStream(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: ${JSON.stringify({ type: 'HELLO', at: new Date().toISOString(), detail: 'radar connected' })}\n\n`);
  sseClients.add(res);
  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      /* closed */
    }
  }, 25000);
  res.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
}

// ---------------------------------------------------------------------------
// Watch-list management (called from routes)
// ---------------------------------------------------------------------------

/** Derive a stable-ish post id the same way the engine's URL utilities do. */
export function derivePostId(inputUrl: string): string {
  const pathMatch = inputUrl.match(/(?:posts|photos|permalink|videos|reel)\/([0-9a-zA-Z_]+)/i);
  if (pathMatch) return pathMatch[1];
  try {
    const parsed = new URL(inputUrl);
    const story = parsed.searchParams.get('story_fbid') || parsed.searchParams.get('fbid');
    if (story) return story;
    if (parsed.searchParams.get('href')) return derivePostId(decodeURIComponent(parsed.searchParams.get('href') as string));
  } catch {
    /* not a URL */
  }
  if (inputUrl.includes('fbid=')) {
    const m = inputUrl.match(/fbid=(\d+)/);
    if (m) return m[1];
  }
  return `radar_${crypto.randomBytes(4).toString('hex')}`;
}

export async function addRadarTask(inputUrl: string, postId?: string): Promise<RadarTask> {
  const url = inputUrl.trim();
  const id = (postId && postId.trim()) || derivePostId(url);
  const tasks = loadTasks();

  let task = tasks.find((t) => t.url === url || t.postId === id);
  const firstRead = await refetchPostText(url);

  if (task) {
    // Re-seed the baseline so re-watching does not fire stale alerts.
    task.baselineHash = firstRead.visible ? contentHashOf(firstRead.content) : null;
    task.status = firstRead.visible ? 'ok' : 'unknown';
    task.lastChecked = new Date().toISOString();
    task.consecutiveMisses = 0;
  } else {
    task = {
      postId: id,
      url,
      baselineHash: firstRead.visible ? contentHashOf(firstRead.content) : null,
      status: firstRead.visible ? 'ok' : 'unknown',
      lastChecked: new Date().toISOString(),
      consecutiveMisses: firstRead.visible ? 0 : 1,
    };
    tasks.push(task);
  }
  saveTasks(tasks);
  return task;
}

export function removeRadarTask(postId: string): boolean {
  const tasks = loadTasks();
  const next = tasks.filter((t) => t.postId !== postId);
  const removed = next.length !== tasks.length;
  if (removed) saveTasks(next);
  return removed;
}

export function listRadarTasks(): { tasks: RadarTask[]; events: RadarEvent[] } {
  return { tasks: loadTasks(), events: loadEvents().slice(0, 50) };
}

// ---------------------------------------------------------------------------
// Scan engine
// ---------------------------------------------------------------------------

async function scanTask(task: RadarTask): Promise<void> {
  const read = await refetchPostText(task.url);
  task.lastChecked = new Date().toISOString();

  if (!read.visible) {
    // Unknown ≠ deleted. Two consecutive anonymous misses (rate-limit
    // flukes, hiccups) must agree before we declare the post gone.
    task.consecutiveMisses += 1;
    if (task.consecutiveMisses >= 2 && task.baselineHash) {
      const evt = recordChange(task.postId, task.url, null);
      task.status = 'deleted';
      if (evt) {
        pushEvent({
          type: 'RADAR_DELETE',
          postId: task.postId,
          seq: evt.seq,
          at: new Date().toISOString(),
          detail: 'No longer publicly visible — original preserved in the vault.',
        });
      }
    } else if (task.status !== 'deleted') {
      task.status = 'unknown';
    }
    return;
  }

  const hash = contentHashOf(read.content);
  task.consecutiveMisses = 0;

  if (task.baselineHash === null) {
    // First successful public read — set the baseline, never alert on it.
    task.baselineHash = hash;
    if (task.status !== 'deleted') task.status = 'ok';
    return;
  }

  if (hash === task.baselineHash) {
    task.status = 'ok';
    return;
  }

  // Content changed in public: vault gets the new snapshot, alert goes out.
  const latest = latestForPost(task.postId);
  const change =
    latest &&
    recordChange(task.postId, task.url, {
      ...latest.snapshot,
      postContent: read.content,
    });
  task.baselineHash = hash;
  task.status = 'edited';
  if (change) {
    pushEvent({
      type: 'RADAR_EDIT',
      postId: task.postId,
      seq: change.seq,
      at: new Date().toISOString(),
      detail: 'Text changed publicly since the last check — both versions are in the vault.',
    });
  }
}

let scanning = false;

export async function runRadarScan(): Promise<{ checked: number; alerts: number }> {
  if (scanning) return { checked: 0, alerts: 0 };
  scanning = true;
  let alerts = 0;
  try {
    const tasks = loadTasks();
    const before = loadEvents().length;
    for (const task of tasks) {
      if (task.status === 'deleted') continue; // nothing left to watch
      try {
        await scanTask(task);
      } catch (err) {
        console.warn(`[radar] scan failed for ${task.postId}:`, err);
      }
      await new Promise((r) => setTimeout(r, 800)); // pace politely
    }
    saveTasks(tasks);
    alerts = Math.max(0, loadEvents().length - before);
    return { checked: tasks.length, alerts };
  } finally {
    scanning = false;
  }
}

/**
 * Boot the periodic scan. Interval is generous (Facebook hates hammering):
 * RADAR_INTERVAL_MS env, default 15 minutes, with a 45 s warm-up delay.
 */
export function startRadarLoop(): void {
  ensureDataDirs();
  const interval = Number(process.env.RADAR_INTERVAL_MS || 15 * 60 * 1000);
  const ticker = setInterval(() => {
    runRadarScan().catch((err) => console.warn('[radar] loop error:', err));
  }, Math.max(interval, 60_000));
  ticker.unref();
  const warmup = setTimeout(() => {
    runRadarScan().catch(() => {});
  }, 45_000);
  warmup.unref();
}
