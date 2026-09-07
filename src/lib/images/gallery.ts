/** Below this many pixels a pointer drag is treated as a tap, not a swipe. */
export const SWIPE_THRESHOLD_PX = 40;

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (clampIndex(current, length) + 1) % length;
}

export function prevIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (clampIndex(current, length) - 1 + length) % length;
}

/** 1 = advance, -1 = go back, 0 = ignore. */
export function swipeDirection(
  startX: number,
  endX: number,
  threshold = SWIPE_THRESHOLD_PX,
): 1 | -1 | 0 {
  const dx = endX - startX;
  if (Math.abs(dx) <= threshold) return 0;
  return dx < 0 ? 1 : -1;
}
