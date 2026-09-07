import { describe, expect, it } from 'vitest';
import { clampIndex, nextIndex, prevIndex, SWIPE_THRESHOLD_PX, swipeDirection } from './gallery';

describe('nextIndex and prevIndex', () => {
  it('wraps in both directions', () => {
    expect(nextIndex(0, 4)).toBe(1);
    expect(nextIndex(3, 4)).toBe(0);
    expect(prevIndex(0, 4)).toBe(3);
    expect(prevIndex(3, 4)).toBe(2);
  });

  it('is a no-op for an empty or single-image gallery', () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });

  it('recovers from an out-of-range current index', () => {
    expect(nextIndex(9, 4)).toBe(0);
    expect(prevIndex(-2, 4)).toBe(3);
  });
});

describe('clampIndex', () => {
  it('keeps the index inside the collection', () => {
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(7, 4)).toBe(3);
    expect(clampIndex(-3, 4)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
  });
});

describe('swipeDirection', () => {
  it('maps a leftward swipe to next and a rightward swipe to previous', () => {
    expect(swipeDirection(300, 100)).toBe(1);
    expect(swipeDirection(100, 300)).toBe(-1);
  });

  it('ignores movement below the threshold', () => {
    expect(swipeDirection(100, 100)).toBe(0);
    expect(swipeDirection(100, 100 + SWIPE_THRESHOLD_PX - 1)).toBe(0);
    expect(swipeDirection(100, 100 + SWIPE_THRESHOLD_PX + 1)).toBe(-1);
    expect(swipeDirection(100, 130, 10)).toBe(-1);
  });
});
