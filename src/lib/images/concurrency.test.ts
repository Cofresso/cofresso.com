import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  it('preserves input order in the results', async () => {
    const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      await tick();
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
  });

  it('never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      6,
      async (i) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
        return i;
      },
    );
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });

  it('handles an empty list and a limit below one', async () => {
    expect(await mapWithConcurrency([], 6, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n)).toEqual([1, 2]);
  });

  it('passes the index to the worker', async () => {
    expect(await mapWithConcurrency(['a', 'b'], 2, async (v, i) => `${i}${v}`)).toEqual([
      '0a',
      '1b',
    ]);
  });
});
