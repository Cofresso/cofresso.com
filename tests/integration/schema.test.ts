import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('schema', () => {
  it('has every table from the design', async () => {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'cart_items',
        'carts',
        'collections',
        'discount_codes',
        'newsletter_subscribers',
        'order_items',
        'orders',
        'product_collections',
        'product_variants',
        'products',
        'reviews',
      ]),
    );
  });

  it('starts order numbers at 10001', async () => {
    const [row] = await db.execute<{ nextval: string }>(sql`select nextval('order_number_seq')`);
    expect(Number(row.nextval)).toBeGreaterThanOrEqual(10001);
  });
});
