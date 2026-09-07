import { describe, expect, it } from 'vitest';
import { formatCountdown, msUntilLocalMidnight } from './countdown';

describe('msUntilLocalMidnight', () => {
  it('counts the time left in the local day', () => {
    const now = new Date(2026, 8, 6, 23, 59, 30, 0);
    expect(msUntilLocalMidnight(now)).toBe(30_000);
  });

  it('returns a full day at local midnight', () => {
    // 6 September is clear of DST transitions in every zone CI runs in.
    expect(msUntilLocalMidnight(new Date(2026, 8, 6, 0, 0, 0, 0))).toBe(24 * 3_600_000);
  });

  it('rolls over the month boundary', () => {
    const now = new Date(2026, 8, 30, 22, 0, 0, 0);
    expect(msUntilLocalMidnight(now)).toBe(2 * 3_600_000);
  });

  it('is always positive', () => {
    for (const hour of [0, 5, 12, 18, 23])
      expect(msUntilLocalMidnight(new Date(2026, 8, 6, hour, 15, 0, 0))).toBeGreaterThan(0);
  });
});

describe('formatCountdown', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(1_000)).toBe('00:00:01');
    expect(formatCountdown(61_000)).toBe('00:01:01');
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
    expect(formatCountdown(23 * 3_600_000 + 59 * 60_000 + 59_000)).toBe('23:59:59');
  });

  it('truncates sub-second remainders', () => {
    expect(formatCountdown(1_999)).toBe('00:00:01');
  });

  it('clamps negatives to zero', () => {
    expect(formatCountdown(-5_000)).toBe('00:00:00');
  });
});
