/**
 * Court-grade time proof — public timestamp anchoring (OpenTimestamps).
 *
 * The vault hash chain proves integrity, but only relative to this machine.
 * Public anchoring removes the last trust assumption:
 *
 *   1. Each sealed entry's canonical JSON body (the exact hash the chain
 *      stores) is submitted to a free OpenTimestamps calendar.
 *   2. Hours later the pending receipt upgrades itself into a Bitcoin block
 *      attestation — "this exact evidence line existed on or before <block
 *      date>" — with no account, no key, no cost.
 *   3. Anyone (lawyer, court, journalist) verifies with the OFFICIAL `ots`
 *      tools and a downloaded preimage + receipt pair. No trust in this app
 *      is required at any step.
 *
 * Stored at DATA_DIR/vault/stamps.json, keyed by entry hash.
 * Official tools: `pip install ots`, `ots verify <hash>.ots`.
 */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DATA_DIR, ensureDataDirs } from './paths';
import { canonical, loadChain } from './vaultStore';

const STAMPS_FILE = path.join(DATA_DIR, 'vault', 'stamps.json');
const MAX_BATCH = 250;

export type StampStatus = 'pending' | 'anchored';

export interface StampRecord {
  /** Entry hash (also the preimage file name / sha256 subject). */
  hash: string;
  seq: number;
  postId: string;
  url: string;
  status: StampStatus;
  submittedAt: string;
  /** base64 of the canonical entry body (exact receipt preimage). */
  preimageB64: string;
  /** base64 of the serialized .ots receipt. */
  receiptB64: string;
  anchoredAt?: string;
  blockHeight?: number;
}

type StampStore = Record<string, StampRecord>;

function loadStore(): StampStore {
  try {
    if (fs.existsSync(STAMPS_FILE)) return JSON.parse(fs.readFileSync(STAMPS_FILE, 'utf8')) as StampStore;
  } catch {
    /* torn write — fall back */
  }
  return {};
}

function saveStore(store: StampStore): void {
  fs.mkdirSync(path.dirname(STAMPS_FILE), { recursive: true });
  fs.writeFileSync(STAMPS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// The official client is CJS without .d.ts — ambient types live in src/types/.
// Imported lazily (dynamic import) so cold boot stays instant.
type OT = typeof import('opentimestamps/index.js');
let otModule: OT | null = null;
async function ot(): Promise<OT> {
  if (!otModule) {
    // CJS interop: some bundler/TS combinations expose the export under `default`.
    const mod = (await import('opentimestamps/index.js')) as unknown as { default?: OT } & OT;
    otModule = (mod.default ?? mod) as OT;
  }
  return otModule;
}

interface EntryBody {
  seq: number;
  prevHash: string;
  timestamp: string;
  type: string;
  postId: string;
  url: string;
  contentHash: string;
  snapshot: unknown;
}

/** Exact receipt preimage: the canonical entry body (entry minus its hash field). */
function entryPreimage(entry: EntryBody & { hash?: string }): Buffer {
  const { hash: _omit, ...body } = entry as EntryBody & { hash?: string };
  return Buffer.from(canonical(body), 'utf8');
}

function serializeDetached(detached: unknown): Buffer {
  return Buffer.from((detached as { serializeToBytes: () => Uint8Array }).serializeToBytes());
}

export interface StampOverview {
  entries: number;
  stamped: number;
  anchored: number;
  pending: number;
}

export function stampOverview(): StampOverview {
  const records = Object.values(loadStore());
  const anchored = records.filter((r) => r.status === 'anchored').length;
  return {
    entries: loadChain().length,
    stamped: records.length,
    anchored,
    pending: records.length - anchored,
  };
}

export interface StampListRecord {
  hash: string;
  seq: number;
  postId: string;
  type: string;
  url: string;
  status: StampStatus;
  submittedAt: string;
  anchoredAt?: string;
  blockHeight?: number;
}

export function listStamps(): { overview: StampOverview; records: StampListRecord[] } {
  const entries = new Map(loadChain().map((e) => [e.hash, e]));
  const records = Object.values(loadStore())
    .map((r) => ({
      hash: r.hash,
      seq: r.seq,
      postId: r.postId,
      type: entries.get(r.hash)?.type ?? 'SEAL',
      url: r.url,
      status: r.status,
      submittedAt: r.submittedAt,
      anchoredAt: r.anchoredAt,
      blockHeight: r.blockHeight,
    }))
    .sort((a, b) => b.seq - a.seq);
  return { overview: stampOverview(), records };
}

/** Submit every not-yet-stamped entry to the public calendars (newest first, batched). */
export async function stampUnstampedEntries(): Promise<{ stamped: number }> {
  const lib = await ot();
  const chain = loadChain();
  if (chain.length === 0) return { stamped: 0 };

  const store = loadStore();
  const unstamped = chain.filter((e) => !store[e.hash]).slice(-MAX_BATCH);
  if (unstamped.length === 0) return { stamped: 0 };

  const detachedFiles = unstamped.map((entry) =>
    lib.DetachedTimestampFile.fromHash(new lib.Ops.OpSHA256(), Buffer.from(entry.hash, 'hex'))
  );
  // One calendar call: the library builds a merkle tree across the batch.
  await lib.stamp(detachedFiles);

  const submittedAt = new Date().toISOString();
  for (let i = 0; i < unstamped.length; i++) {
    const entry = unstamped[i];
    store[entry.hash] = {
      hash: entry.hash,
      seq: entry.seq,
      postId: entry.postId,
      url: entry.url,
      status: 'pending',
      submittedAt,
      preimageB64: entryPreimage(entry).toString('base64'),
      receiptB64: serializeDetached(detachedFiles[i]).toString('base64'),
    };
  }
  saveStore(store);
  return { stamped: unstamped.length };
}

/**
 * Pull deeper (Bitcoin-block) attestations into pending receipts. Pending
 * receipts typically anchor within a few hours of submission.
 */
export async function upgradeStamps(): Promise<{ upgraded: number; anchored: number; pending: number }> {
  const lib = await ot();
  const store = loadStore();
  let upgraded = 0;

  for (const rec of Object.values(store)) {
    if (rec.status !== 'pending') continue;
    let detached: unknown;
    try {
      detached = lib.DetachedTimestampFile.deserialize(Buffer.from(rec.receiptB64, 'base64'));
    } catch {
      continue;
    }
    let receiptChanged = false;
    let aborted = false;
    for (let round = 0; round < 2; round++) {
      try {
        const didUpgrade = await lib.upgrade(detached, { timeout: 9000 });
        receiptChanged = receiptChanged || didUpgrade;
        if (!didUpgrade) break;
      } catch {
        aborted = true; // offline / calendar hiccup — next tick will retry
        break;
      }
    }
    if (!detached || aborted) continue;

    let info = '';
    try {
      info = lib.info(detached);
    } catch {
      continue;
    }
    if (!info.includes('PendingAttestation')) {
      receiptChanged = true;
      rec.status = 'anchored';
      rec.anchoredAt = new Date().toISOString();
      try {
        // Confirm the receipt against its subject and read the exact block time.
        const subject = lib.DetachedTimestampFile.fromHash(new lib.Ops.OpSHA256(), Buffer.from(rec.hash, 'hex'));
        const verdict = await lib.verify(detached, subject, { ignoreBitcoinNode: true, timeout: 9000 });
        const btc = verdict?.bitcoin;
        if (btc?.timestamp) rec.anchoredAt = new Date(btc.timestamp * 1000).toISOString();
        if (btc?.height) rec.blockHeight = btc.height;
      } catch {
        /* keep the fall-back anchoredAt */
      }
    }
    if (receiptChanged) {
      rec.receiptB64 = serializeDetached(detached).toString('base64');
      upgraded++;
    }
  }

  saveStore(store);
  const records = Object.values(store);
  const anchored = records.filter((r) => r.status === 'anchored').length;
  return { upgraded, anchored, pending: records.length - anchored };
}

function getRecord(hash: string): StampRecord | null {
  return loadStore()[hash] ?? null;
}

export function receiptOf(hash: string): Buffer | null {
  const rec = getRecord(hash);
  return rec ? Buffer.from(rec.receiptB64, 'base64') : null;
}

export function preimageOf(hash: string): Buffer | null {
  const rec = getRecord(hash);
  return rec ? Buffer.from(rec.preimageB64, 'base64') : null;
}

function howToVerifyText(): string {
  return [
    'HOW TO VERIFY THESE TIMESTAMPS (no trust in FacebookGrabContents needed)',
    '========================================================================',
    '',
    'Every pair of files here is one sealed archive entry:',
    '',
    '  <hash>       the exact evidence line (canonical JSON, one line)',
    '  <hash>.ots   its public OpenTimestamps receipt',
    '',
    'The SHA-256 of each evidence line equals its file name and equals the',
    '`hash` field inside the line — the chain math from the app itself.',
    '',
    'Verify with the official, independent OpenTimestamps tools:',
    '',
    '  1. pip install ots     (or download the OpenTimestamps CLI)',
    '  2. ots verify <hash>.ots',
    '     -> "Success! Bitcoin block NNNNNN attests existence as of YYYY-MM-DD"',
    '        BitcoinBlockHeaderAttestation means existence is anchored in the',
    '        Bitcoin blockchain — nobody can forge or backdate it.',
    '  3. If the receipt is still PENDING when you downloaded it:',
    '     ots upgrade <hash>.ots   (then verify again; upgrades are free)',
    '',
    'Optional independent cross-checks:',
    '',
    '  4. sha256sum <hash>        -> equals the file name',
    '  5. Recompute the chain: each line`s `prevHash` equals the previous',
    '     line`s `hash` (GENESIS for the first). The app`s zero-trust',
    '     verifier bundle does this in any browser.',
    '',
    'All stamping was done via the free OpenTimestamps public calendars',
    '(https://opentimestamps.org). Nothing was sent anywhere else.',
    '',
  ].join('\r\n');
}

/**
 * One-click court package: every receipt + its preimage + plain-language
 * verification instructions, in a single ZIP.
 */
export async function buildReceiptsZip(): Promise<Buffer | null> {
  const store = loadStore();
  const records = Object.values(store).sort((a, b) => b.seq - a.seq);
  if (records.length === 0) return null;

  const zip = new JSZip();
  for (const rec of records) {
    zip.file(rec.hash, Buffer.from(rec.preimageB64, 'base64'));
    zip.file(`${rec.hash}.ots`, Buffer.from(rec.receiptB64, 'base64'));
  }
  zip.file('HOW-TO-VERIFY.txt', howToVerifyText());
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Boot the silent maintenance loop: auto-submit new sealed entries and
 * auto-upgrade pending receipts (no user action needed after the first
 * anchor click). Disable with STAMP_DISABLE=1.
 */
export function startStampsLoop(): void {
  if (process.env.STAMP_DISABLE === '1') return;
  ensureDataDirs();
  const tick = async (): Promise<void> => {
    try {
      await stampUnstampedEntries();
      await upgradeStamps();
    } catch (err) {
      console.warn('[stamps] loop error (will retry next tick):', (err as Error)?.message || err);
    }
  };
  const ticker = setInterval(tick, 6 * 60 * 60 * 1000); // every 6 hours
  ticker.unref();
  const warmup = setTimeout(tick, 60_000);
  warmup.unref();
}
