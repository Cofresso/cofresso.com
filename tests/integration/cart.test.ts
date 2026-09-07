import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addLine,
  applyDiscountCode,
  CartMutationError,
  clearCart,
  ensureCart,
  removeLine,
  setLineQuantity,
} from '../../src/lib/cart/mutations';
import { getCartItemCount, getCartView } from '../../src/lib/cart/queries';
import { primaryImage } from '../../src/lib/catalog/types';
import { getProductBySlug } from '../../src/lib/db/queries/catalog';
import { productImages, products, productVariants } from '../../src/lib/db/schema';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

async function variantBySku(sku: string) {
  const [v] = await db.select().from(productVariants).where(eq(productVariants.sku, sku));
  return v;
}

describe('cart', () => {
  let cartId: string;
  beforeEach(async () => {
    cartId = await ensureCart(db, null);
  });

  it('adds, merges and prices lines', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 2,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'drip',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });

    const view = await getCartView(cartId, db);
    expect(view?.lines).toHaveLength(2);
    const whole = view!.lines.find((l) => l.grind === 'whole_bean')!;
    expect(whole.quantity).toBe(3);
    expect(whole.lineTotalCents).toBe(3 * v.priceCents);
    expect(view!.totals.itemCount).toBe(4);
    expect(await getCartItemCount(cartId, db)).toBe(4);
  });

  it('shows the same lead photograph on a line as the product card', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    const view = await getCartView(cartId, db);
    const detail = await getProductBySlug('morning-frame', db);
    const lead = primaryImage(detail!.images)!;
    expect(view!.lines[0].product.image).toEqual({ src: lead.url, alt: lead.alt });
    expect(view!.lines[0].product.image.src).not.toContain('.svg');
  });

  it('falls back to the SVG art when a product has no photography', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    const [product] = await db.select().from(products).where(eq(products.slug, 'morning-frame'));
    const photos = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    try {
      await db.delete(productImages).where(eq(productImages.productId, product.id));
      const view = await getCartView(cartId, db);
      expect(view!.lines[0].product.image).toEqual({
        src: product.imagePath,
        alt: product.name,
      });
    } finally {
      await db.insert(productImages).values(photos);
    }
  });

  it('applies subscription pricing per line', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'subscription',
      subscriptionIntervalWeeks: 4,
    });
    const view = await getCartView(cartId, db);
    expect(view!.lines[0].effectiveUnitPriceCents).toBe(Math.round(v.priceCents * 0.85));
    expect(view!.totals.subscriptionSavingsCents).toBe(
      v.priceCents - Math.round(v.priceCents * 0.85),
    );
  });

  it('enforces stock', async () => {
    const v = await variantBySku('KETTLE-2');
    await expect(
      addLine(db, cartId, {
        variantId: v.id,
        quantity: 10,
        grind: null,
        purchaseType: 'one_time',
        subscriptionIntervalWeeks: null,
      }),
    ).resolves.toBeUndefined();
    await expect(
      addLine(db, cartId, {
        variantId: v.id,
        quantity: 10,
        grind: null,
        purchaseType: 'one_time',
        subscriptionIntervalWeeks: null,
      }),
    ).rejects.toMatchObject({ code: 'out_of_stock' });
  });

  it('rejects a second distinct line of the same variant that would exceed stock in total', async () => {
    const v = await variantBySku('KETTLE-2'); // stock 18
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 10,
      grind: null,
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    // A distinct line (subscription, not merged with the one_time line above) for the SAME
    // variant: 10 alone is under the 18 in stock, but combined with the existing one_time
    // line's 10 it would total 20 > 18. addLine must check the variant's total allocation
    // across every line, not just the line this call would merge into.
    await expect(
      addLine(db, cartId, {
        variantId: v.id,
        quantity: 10,
        grind: null,
        purchaseType: 'subscription',
        subscriptionIntervalWeeks: 4,
      }),
    ).rejects.toMatchObject({ code: 'out_of_stock' });

    const view = await getCartView(cartId, db);
    expect(view!.lines).toHaveLength(1);
    expect(view!.lines[0].quantity).toBe(10);
  });

  it('updates and removes lines', async () => {
    const v = await variantBySku('MUG-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: null,
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    let view = await getCartView(cartId, db);
    await setLineQuantity(db, cartId, view!.lines[0].id, 3);
    view = await getCartView(cartId, db);
    expect(view!.lines[0].quantity).toBe(3);
    await setLineQuantity(db, cartId, view!.lines[0].id, 0);
    view = await getCartView(cartId, db);
    expect(view!.lines).toHaveLength(0);
    await expect(setLineQuantity(db, cartId, view!.id, 1)).rejects.toBeInstanceOf(
      CartMutationError,
    );
    await removeLine(db, cartId, '00000000-0000-0000-0000-000000000000');
  });

  it('applies and validates discount codes', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    await expect(applyDiscountCode(db, cartId, 'NOPE')).rejects.toMatchObject({
      code: 'invalid_code',
    });
    await expect(applyDiscountCode(db, cartId, 'coframe15')).rejects.toMatchObject({
      code: 'invalid_code',
    }); // min $30
    await applyDiscountCode(db, cartId, 'welcome10');
    const view = await getCartView(cartId, db);
    expect(view!.discountCode).toBe('WELCOME10');
    expect(view!.totals.discountCents).toBe(Math.round(v.priceCents * 0.1));
  });

  it('reports a stored code that no longer applies', async () => {
    const v = await variantBySku('MORNINGFRAME-2'); // 2 lb, above $30
    await addLine(db, cartId, {
      variantId: v.id,
      quantity: 1,
      grind: 'whole_bean',
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    await applyDiscountCode(db, cartId, 'COFRAME15');
    const view = await getCartView(cartId, db);
    await removeLine(db, cartId, view!.lines[0].id);
    const mug = await variantBySku('MUG-1');
    await addLine(db, cartId, {
      variantId: mug.id,
      quantity: 1,
      grind: null,
      purchaseType: 'one_time',
      subscriptionIntervalWeeks: null,
    });
    const after = await getCartView(cartId, db);
    expect(after!.discount).toBeNull();
    expect(after!.discountMessage).toContain('$30.00');
    await clearCart(db, cartId);
    expect((await getCartView(cartId, db))!.lines).toHaveLength(0);
  });
});
