/**
 * EvidenceVault — an append-only, tamper-evident archive store.
 *
 * Every sealed post becomes an entry in a hash chain. Each entry's `hash`
 * covers its own data PLUS the previous entry's hash, so altering any historical
 * entry breaks every link after it — cryptographically detectable.
 *
 * Chain model:  GENESIS -> E1(prev=GENESIS) -> E2(prev=hash(E1)) -> E3(prev=hash(E2)) ...
 *
 * Storage is NDJSON (one JSON object per line) for crash-safety: a partial
 * last line is discarded on load rather than corrupting the whole chain.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { VAULT_DIR } from './paths';

export type VaultEntryType = 'SEAL' | 'EDIT_DETECTED' | 'DELETE_DETECTED' | 'NOTE';

export interface VaultSnapshot {
  postContent: string;
  images: string[];
  authorName: string;
  authorHandle: string;
  postDate: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}

export interface VaultEntry {
  seq: number;
  prevHash: string;
  timestamp: string;
  type: VaultEntryType;
  postId: string;
  url: string;
  /** SHA-256 of the normalized post content (the thing being proven). */
  contentHash: string;
  /** Full captured snapshot stored so deletions can be reconstructed. */
  snapshot: VaultSnapshot;
  /** SHA-256 over the canonical serialization of everything above (excl. hash). */
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  count: number;
  brokenAtSeq?: number;
  reason?: string;
}

const CHAIN_FILE = path.join(VAULT_DIR, 'chain.ndjson');
const GENESIS = 'GENESIS';

/** Stable stringify (sorted keys) so hashing is deterministic. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

/** Normalize content before hashing: NFC + collapse whitespace + trim. */
export function normalizeContent(text: string): string {
  return (text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function contentHashOf(text: string): string {
  return crypto.createHash('sha256').update(normalizeContent(text), 'utf8').digest('hex');
}

function computeEntryHash(entry: Omit<VaultEntry, 'hash'>): string {
  return crypto.createHash('sha256').update(canonical(entry), 'utf8').digest('hex');
}

function ensureStore(): void {
  if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
}

/** Load the chain, discarding any corrupt/partial trailing line. */
export function loadChain(): VaultEntry[] {
  ensureStore();
  if (!fs.existsSync(CHAIN_FILE)) return [];
  const raw = fs.readFileSync(CHAIN_FILE, 'utf8');
  const entries: VaultEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as VaultEntry);
    } catch {
      // ignore a torn final write
    }
  }
  return entries;
}

function appendEntry(entry: VaultEntry): void {
  ensureStore();
  fs.appendFileSync(CHAIN_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Recompute every hash and validate every prevHash link.
 * Returns the first break found (or valid=true).
 */
export function verifyChain(): ChainVerification {
  const entries = loadChain();
  let prev = GENESIS;
  for (const e of entries) {
    const { hash, ...body } = e;
    const expectedHash = computeEntryHash(body);
    if (e.prevHash !== prev) {
      return { valid: false, count: entries.length, brokenAtSeq: e.seq, reason: 'Broken link: prevHash does not match previous entry hash' };
    }
    if (e.hash !== expectedHash) {
      return { valid: false, count: entries.length, brokenAtSeq: e.seq, reason: 'Content tampered: stored hash does not match recomputed hash' };
    }
    prev = e.hash;
  }
  return { valid: true, count: entries.length };
}

function buildEntry(
  type: VaultEntryType,
  postId: string,
  url: string,
  snapshot: VaultSnapshot
): VaultEntry {
  const chain = loadChain();
  const prevHash = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const body: Omit<VaultEntry, 'hash'> = {
    seq: chain.length + 1,
    prevHash,
    timestamp: new Date().toISOString(),
    type,
    postId,
    url,
    contentHash: contentHashOf(snapshot.postContent),
    snapshot,
  };
  return { ...body, hash: computeEntryHash(body) };
}

export interface SealResult {
  entry: VaultEntry;
  duplicate: boolean;
}

/** Seal (archive+hash) a post. Re-sealing identical content is idempotent. */
export function sealPost(post: {
  id: string;
  url: string;
  postContent: string;
  images?: string[];
  authorName?: string;
  authorHandle?: string;
  postDate?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
}): SealResult {
  const chain = loadChain();
  const newHash = contentHashOf(post.postContent);
  // Idempotency: if the latest entry for this post has identical content, reuse it.
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].postId === post.id) {
      if (chain[i].contentHash === newHash) {
        return { entry: chain[i], duplicate: true };
      }
      break;
    }
  }
  const snapshot: VaultSnapshot = {
    postContent: post.postContent,
    images: post.images || [],
    authorName: post.authorName || '',
    authorHandle: post.authorHandle || '',
    postDate: post.postDate || '',
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || 0,
    sharesCount: post.sharesCount || 0,
  };
  const entry = buildEntry('SEAL', post.id, post.url, snapshot);
  appendEntry(entry);
  return { entry, duplicate: false };
}

/** Record that a previously-sealed post changed or disappeared. */
export function recordChange(
  postId: string,
  url: string,
  latestSnapshot: VaultSnapshot | null
): VaultEntry | null {
  const chain = loadChain();
  let last: VaultEntry | undefined;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].postId === postId) {
      last = chain[i];
      break;
    }
  }
  if (!last) return null;
  const newHash = latestSnapshot ? contentHashOf(latestSnapshot.postContent) : '';
  if (latestSnapshot && newHash === last.contentHash) return null; // no change
  const type: VaultEntryType = latestSnapshot ? 'EDIT_DETECTED' : 'DELETE_DETECTED';
  const snapshot = latestSnapshot || last.snapshot;
  const entry = buildEntry(type, postId, url, snapshot);
  appendEntry(entry);
  return entry;
}

export function getChain(limit = 200): VaultEntry[] {
  const chain = loadChain();
  return chain.slice(-limit).reverse();
}

/** Latest sealed entry for a given post. */
export function latestForPost(postId: string): VaultEntry | undefined {
  const chain = loadChain();
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].postId === postId) return chain[i];
  }
  return undefined;
}
