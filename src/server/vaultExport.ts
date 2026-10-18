/**
 * Vault → spreadsheet export (CSV, Excel-safe).
 *
 * Business users live in Excel. This module turns the sealed chain into a
 * clean, auditable spreadsheet: one row per chain entry, engagement columns
 * (likes/comments/shares), content hashes, and the public-anchor state —
 * the receipts-based "when was this provably archived" column.
 *
 * Excel-safety rules (learned the hard way across every report-generation
 * tool ever written):
 *   - quote every cell, double any inner quote;
 *   - prefix cells that could execute as formulas (=, +, -, @, tab) with ' —
 *     a spreadsheet of archives must never compute anything;
 *   - strip control characters, collapse line breaks (one row = one line);
 *   - the BOM is added by the route so Excel opens UTF-8 correctly on Windows.
 */
import type { VaultEntry } from './vaultStore';

export type StampStateOf = (hash: string) => 'pending' | 'anchored' | 'not stamped';

const PREVIEW_LENGTH = 220;

/** Escape + formula-harden one cell. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Control characters (except tab, which we also neutralise as a separator
  // risk) and any kind of line break must not survive — one row is one line.
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  if (/^[=+\-@\t]/.test(s) || /^[=+\-@\t]/.test(s.replace(/^\uFEFF/, ''))) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

const COLUMNS: Record<keyof CsvRow, 1> = {
  seq: 1,
  sealedAtUtc: 1,
  entryType: 1,
  postId: 1,
  postUrl: 1,
  author: 1,
  authorHandle: 1,
  postDate: 1,
  likes: 1,
  comments: 1,
  shares: 1,
  images: 1,
  contentLength: 1,
  contentPreview: 1,
  contentHash: 1,
  entryHash: 1,
  prevHash: 1,
  publicAnchor: 1,
};

export interface CsvRow {
  seq: number;
  sealedAtUtc: string;
  entryType: string;
  postId: string;
  postUrl: string;
  author: string;
  authorHandle: string;
  postDate: string;
  likes: string;
  comments: string;
  shares: string;
  images: string;
  contentLength: string;
  contentPreview: string;
  contentHash: string;
  entryHash: string;
  prevHash: string;
  publicAnchor: string;
}

function rowOf(entry: VaultEntry, stampStateOf: StampStateOf): CsvRow {
  const snap = entry.snapshot ?? ({} as VaultEntry['snapshot']);
  const content = snap.postContent ?? '';
  const preview =
    content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH).trimEnd()}…` : content;
  return {
    seq: entry.seq,
    sealedAtUtc: entry.timestamp,
    entryType: entry.type,
    postId: entry.postId,
    postUrl: entry.url,
    author: snap.authorName ?? '',
    authorHandle: snap.authorHandle ?? '',
    postDate: snap.postDate ?? '',
    likes: snap.likesCount === undefined || snap.likesCount === null ? '' : String(snap.likesCount),
    comments: snap.commentsCount === undefined || snap.commentsCount === null ? '' : String(snap.commentsCount),
    shares: snap.sharesCount === undefined || snap.sharesCount === null ? '' : String(snap.sharesCount),
    images: Array.isArray(snap.images) && snap.images.length ? String(snap.images.length) : '',
    contentLength: String(content.length),
    contentPreview: preview,
    contentHash: entry.contentHash ?? '',
    entryHash: entry.hash ?? '',
    prevHash: entry.prevHash ?? '',
    publicAnchor: stampStateOf(entry.hash ?? ''),
  };
}

/** The whole spreadsheet as one UTF-8 string (no BOM — the route adds it). */
export function buildVaultCsv(entries: VaultEntry[], stampStateOf: StampStateOf): string {
  const columns = Object.keys(COLUMNS);
  const lines = [columns.map((col) => csvCell(col)).join(',')];
  for (const entry of entries) {
    const row = rowOf(entry, stampStateOf);
    lines.push(columns.map((col) => csvCell((row as unknown as Record<string, unknown>)[col])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
