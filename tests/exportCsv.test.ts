import { describe, expect, it } from 'vitest';
import { buildVaultCsv, csvCell } from '../src/server/vaultExport';

const noStamp = () => 'not stamped' as const;

describe('csvCell — Excel-safety rules', () => {
  it('quotes cells and doubles inner quotes', () => {
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('neutralises formula injection via a leading quote', () => {
    expect(csvCell('=SUM(1)')).toBe('"\'=SUM(1)"');
    expect(csvCell('@cmd')).toBe('"\'@cmd"');
    expect(csvCell('-1+1')).toBe('"\'-1+1"');
    expect(csvCell('+442553')).toBe('"\'+442553"');
  });

  it('strips control characters and line breaks (one row = one line)', () => {
    expect(csvCell('a\nb\rc\u0000d\tf')).toBe('"a b c d f"');
  });

  it('renders null/undefined as empty quoted cells', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe('buildVaultCsv', () => {
  const entry = {
    seq: 3,
    prevHash: 'a'.repeat(64),
    timestamp: '2026-10-18T10:00:00.000Z',
    type: 'SEAL' as const,
    postId: '123',
    url: 'https://facebook.com/123',
    contentHash: 'b'.repeat(64),
    snapshot: {
      postContent: 'My post, with "quotes" and a formula bait =SUM(1)',
      images: ['http://img1'],
      authorName: 'Ada Obi',
      authorHandle: 'ada.obi',
      postDate: 'Mon Oct 12',
      likesCount: 14,
      commentsCount: 2,
      sharesCount: 0,
    },
    hash: 'c'.repeat(64),
  };

  it('emits the full header and one row per entry', () => {
    const csv = buildVaultCsv([entry], noStamp);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    const header = lines[0].split(',');
    expect(header[0]).toBe('"seq"');
    expect(header[header.length - 1]).toBe('"publicAnchor"');
    expect(lines[1]).toContain('"123"');
    expect(lines[1]).toContain('"SEAL"');
  });

  it('stamps the anchor column and escapes mid-content quotes correctly', () => {
    const csv = buildVaultCsv([entry], () => 'anchored');
    const row = csv.trimEnd().split('\r\n')[1];
    expect(row).toContain('"anchored"');
    expect(row).toContain('and a formula bait =SUM(1)');
    expect(row).toContain('"Ada Obi"');
    expect(row).toContain('"14"');
    expect(row).toContain('"0"'); // shares rendered as a proper number
    expect(row).toContain('"1"'); // image count
  });

  it('never lets a formula-bait content string inject into a row', () => {
    const bait = { ...entry, snapshot: { ...entry.snapshot, postContent: '=INJECT()' } };
    const row = buildVaultCsv([bait], noStamp).trimEnd().split('\r\n')[1];
    expect(row).toContain('"\'=INJECT()"');
  });

  it('truncates long previews with an ellipsis marker', () => {
    const long = 'x'.repeat(500);
    const csv = buildVaultCsv([{ ...entry, snapshot: { ...entry.snapshot, postContent: long } }], noStamp);
    const row = csv.trimEnd().split('\r\n')[1];
    expect((row.match(/…"/g) || []).length).toBe(1);
    expect(row.length).toBeLessThan(600);
  });
});
