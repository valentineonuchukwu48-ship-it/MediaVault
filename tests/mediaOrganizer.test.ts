import { describe, expect, it } from 'vitest';
import { dateFromFilename, folderName, parseExifDate } from '../src/server/mediaOrganizer';

describe('dateFromFilename — phone & camera conventions', () => {
  it('reads WhatsApp exports', () => {
    expect(dateFromFilename('IMG-20240512-WA0011.jpg').slice(0, 10)).toBe('2024-05-12');
  });

  it('reads Android camera names with a time signature', () => {
    expect(dateFromFilename('IMG_20240512_123456.jpg')).toBe(
      new Date(Date.UTC(2024, 4, 12, 12, 34, 56)).toISOString(),
    );
  });

  it('reads video names', () => {
    expect(dateFromFilename('VID_20301105_071233.mp4').slice(0, 10)).toBe('2030-11-05');
  });

  it('reads screenshot names', () => {
    expect(dateFromFilename('Screenshot_2026-01-09-14-30-05-840_com.android.png').slice(0, 10)).toBe('2026-01-09');
  });

  it('reads Windows camera names', () => {
    expect(dateFromFilename('2024-05-12 14.03.22.jpg').slice(0, 10)).toBe('2024-05-12');
  });

  it('rejects impossible dates and random numbers', () => {
    expect(dateFromFilename('holiday_20241332_x.jpg')).toBe('');
    expect(dateFromFilename('rose_mary.jpg')).toBe('');
  });

  it('rejects a lone year with no month/day behind it (the Invalid-time killer)', () => {
    expect(dateFromFilename('dreamobjects_logo-horiz-2013.png')).toBe('');
    expect(dateFromFilename('jamb-chem-1999')).toBe('');
    expect(dateFromFilename('wassce-2015-mathematics-indices-surds-quadratics.mp4')).toBe('');
  });
});

describe('parseExifDate', () => {
  it('parses the EXIF format', () => {
    expect(parseExifDate('2024:05:12 14:03:22')).toBe(new Date(Date.UTC(2024, 4, 12, 14, 3, 22)).toISOString());
  });

  it('rejects junk', () => {
    expect(parseExifDate('not a date')).toBe('');
    expect(parseExifDate(undefined)).toBe('');
    expect(parseExifDate('2024:13:40 90:00:00')).toBe('');
  });
});

describe('folderName', () => {
  it('buckets by month', () => {
    expect(folderName('2024-05-12T14:03:22Z', 'month')).toBe('2024-05');
  });

  it('buckets by day', () => {
    expect(folderName('2024-05-12T14:03:22Z', 'day')).toBe('2024-05-12');
  });

  it('parks undated files', () => {
    expect(folderName('', 'month')).toBe('Undated');
    expect(folderName('', 'day')).toBe('Undated');
  });
});
