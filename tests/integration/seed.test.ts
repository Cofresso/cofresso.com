import { count, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { productVariants, products, reviews } from '../../src/lib/db/schema';
import { runSeed } from '../../src/lib/db/seed';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('runSeed', () => {
  it('is idempotent', async () => {
    const before = await db.select({ n: count() }).from(products);
    const summary = await runSeed(db);
    const after = await db.select({ n: count() }).from(products);
    expect(after[0].n).toBe(before[0].n);
    expect(summary.products).toBe(after[0].n);
    const reviewCount = await db.select({ n: count() }).from(reviews);
    expect(reviewCount[0].n).toBe(summary.reviews);
  });

  it('does not clobber stock on re-seed', async () => {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.sku, 'MORNINGFRAME-1'));
    await db
      .update(productVariants)
      .set({ stockQuantity: 7 })
      .where(eq(productVariants.id, variant.id));
    await runSeed(db);
    const [again] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant.id));
    expect(again.stockQuantity).toBe(7);
    await db
      .update(productVariants)
      .set({ stockQuantity: variant.stockQuantity })
      .where(eq(productVariants.id, variant.id));
  });
});
