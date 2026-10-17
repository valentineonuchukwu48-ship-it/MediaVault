import { describe, it, expect } from 'vitest';
import { cleanVideoUrl } from '../src/server/videoService';

describe('cleanVideoUrl', () => {
  it('passes a plain URL through unchanged', () => {
    expect(cleanVideoUrl('https://www.facebook.com/watch?v=123')).toBe(
      'https://www.facebook.com/watch?v=123',
    );
  });

  it('extracts the href from an embed iframe', () => {
    const embed =
      '<iframe src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Ffb.com%2Fv%2F1&show_text=false"></iframe>';
    expect(cleanVideoUrl(embed)).toContain('fb.com/v/1');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanVideoUrl('  https://x.com/a  ')).toBe('https://x.com/a');
  });
});
