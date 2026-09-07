/**
 * Run `worker` over `items` with at most `limit` in flight, returning results
 * in input order. The worker is expected to handle its own failures: a
 * rejection here rejects the whole run.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const width = Math.max(1, Math.min(limit || 1, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: width }, run));
  return results;
}
