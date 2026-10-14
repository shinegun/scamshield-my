import { describe, expect, it } from 'vitest';
import { recentWindow } from './session';

const line = (n: number, len: number) => ({ text: String(n).padEnd(len, '.') });

describe('recentWindow', () => {
  it('keeps at least two lines, even when the last one is long', () => {
    const lines = [line(1, 50), line(2, 50), line(3, 900)];
    expect(recentWindow(lines).map((l) => l.text[0])).toEqual(['2', '3']);
  });

  it('reaches back to about 600 characters of short back-and-forth', () => {
    const lines = Array.from({ length: 40 }, (_, i) => line(i % 10, 40));
    // 40-character lines: 15 of them make 600.
    expect(recentWindow(lines)).toHaveLength(15);
  });

  it('returns the whole call when it is shorter than the window', () => {
    expect(recentWindow([line(1, 30)])).toHaveLength(1);
    expect(recentWindow([])).toEqual([]);
  });
});
