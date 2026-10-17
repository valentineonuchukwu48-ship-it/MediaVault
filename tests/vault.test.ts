import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  sealPost,
  verifyChain,
  loadChain,
  recordChange,
  contentHashOf,
  normalizeContent,
} from '../src/server/vaultStore';

const VAULT_FILE = path.resolve('.test-data', 'vault', 'chain.ndjson');

describe('EvidenceVault', () => {
  beforeEach(() => {
    fs.rmSync(path.resolve('.test-data'), { recursive: true, force: true });
  });

  it('starts empty and valid', () => {
    expect(loadChain()).toHaveLength(0);
    expect(verifyChain()).toEqual({ valid: true, count: 0 });
  });

  it('seals a post and keeps the chain valid', () => {
    const { entry, duplicate } = sealPost({
      id: 'p1',
      url: 'https://facebook.com/p1',
      postContent: 'Hello world',
    });
    expect(duplicate).toBe(false);
    expect(entry.seq).toBe(1);
    expect(verifyChain()).toEqual({ valid: true, count: 1 });
  });

  it('is idempotent for identical content', () => {
    sealPost({ id: 'p1', url: 'u', postContent: 'same' });
    const second = sealPost({ id: 'p1', url: 'u', postContent: 'same' });
    expect(second.duplicate).toBe(true);
    expect(loadChain()).toHaveLength(1);
  });

  it('links each entry to the previous hash', () => {
    const a = sealPost({ id: 'p1', url: 'u', postContent: 'first' }).entry;
    const b = sealPost({ id: 'p2', url: 'u', postContent: 'second' }).entry;
    expect(b.prevHash).toBe(a.hash);
  });

  it('detects tampering of a stored entry', () => {
    sealPost({ id: 'p1', url: 'u', postContent: 'original' });
    const line = fs.readFileSync(VAULT_FILE, 'utf8').trim().split('\n')[0];
    const obj = JSON.parse(line);
    obj.snapshot.postContent = 'tampered';
    fs.writeFileSync(VAULT_FILE, JSON.stringify(obj) + '\n');

    const result = verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(1);
  });

  it('records a detected deletion', () => {
    sealPost({ id: 'p1', url: 'u', postContent: 'x' });
    const change = recordChange('p1', 'u', null);
    expect(change?.type).toBe('DELETE_DETECTED');
  });

  it('normalizes and hashes deterministically', () => {
    expect(normalizeContent('  a   b ')).toBe('a b');
    expect(contentHashOf('a b')).toBe(contentHashOf('a   b'));
  });
});
