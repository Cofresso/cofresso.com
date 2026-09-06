import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { addLine, applyDiscountCode, ensureCart } from '../../src/lib/cart/mutations';
import { getCartView } from '../../src/lib/cart/queries';
import { placeOrder } from '../../src/lib/checkout/place-order';
import { getOrderForConfirmation, getOrderForLookup } from '../../src/lib/checkout/queries';
import type { CheckoutInput } from '../../src/lib/checkout/schemas';
import { productVariants } from '../../src/lib/db/schema';
import { TEST_CARDS } from '../../src/lib/payments';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  email: 'ada@example.com',
  shippingName: 'Ada Lovelace',
  address1: '1 Analytical Way',
  address2: undefined,
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94110',
  country: 'US',
  cardNumber: TEST_CARDS.approved,
  cardName: 'Ada Lovelace',
  expMonth: 12,
  expYear: 2030,
  cvc: '123',
  idempotencyKey: randomUUID(),
  ...overrides,
});

async function variantBySku(sku: string) {
  const [v] = await db.select().from(productVariants).where(eq(productVariants.sku, sku));
  return v;
}

async function cartWith(sku: string, quantity = 1) {
  const cartId = await ensureCart(db, null);
  const v = await variantBySku(sku);
  await addLine(db, cartId, {
    variantId: v.id,
    quantity,
    grind: null,
    purchaseType: 'one_time',
    subscriptionIntervalWeeks: null,
  });
  return { cartId, variant: v };
}

describe('placeOrder', () => {
  it('creates an order, decrements stock, clears the cart', async () => {
    const { cartId, variant } = await cartWith('SCALE-1', 2);
    await applyDiscountCode(db, cartId, 'WELCOME10');
    const before = (await variantBySku('SCALE-1')).stockQuantity;

    const result = await placeOrder({ cartId, input: input(), db });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^CF-\d{5,}$/);

    const after = (await variantBySku('SCALE-1')).stockQuantity;
    expect(after).toBe(before - 2);

    const cart = await getCartView(cartId, db);
    expect(cart!.lines).toHaveLength(0);
    expect(cart!.discountCode).toBeNull();

    const order = await getOrderForConfirmation(result.orderNumber, result.lookupToken, db);
    expect(order).not.toBeNull();
    expect(order!.items[0]).toMatchObject({
      variantId: variant.id,
      quantity: 2,
      unitPriceCents: variant.priceCents,
    });
    expect(order!.totals.discountCents).toBe(Math.round(variant.priceCents * 2 * 0.1));
    expect(order!.discountCode).toBe('WELCOME10');
    expect(order!.cardLast4).toBe('4242');

    expect(await getOrderForConfirmation(result.orderNumber, 'wrong-token', db)).toBeNull();
    expect(await getOrderForLookup(result.orderNumber, 'ADA@example.com', db)).not.toBeNull();
    expect(await getOrderForLookup(result.orderNumber, 'someone@else.com', db)).toBeNull();
  });

  it('returns the same order when the idempotency key is replayed', async () => {
    const { cartId } = await cartWith('MUG-1');
    const key = randomUUID();
    const first = await placeOrder({ cartId, input: input({ idempotencyKey: key }), db });
    const second = await placeOrder({ cartId, input: input({ idempotencyKey: key }), db });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.orderNumber).toBe(first.orderNumber);
  });

  it('rejects an empty cart', async () => {
    const cartId = await ensureCart(db, null);
    await expect(placeOrder({ cartId, input: input(), db })).resolves.toMatchObject({
      ok: false,
      code: 'empty_cart',
    });
  });

  it('fails on decline and leaves stock and cart untouched', async () => {
    const { cartId } = await cartWith('FILTERS-1', 3);
    const before = (await variantBySku('FILTERS-1')).stockQuantity;
    const result = await placeOrder({
      cartId,
      input: input({ cardNumber: TEST_CARDS.declined }),
      db,
    });
    expect(result).toMatchObject({ ok: false, code: 'payment_declined' });
    expect((await variantBySku('FILTERS-1')).stockQuantity).toBe(before);
    expect((await getCartView(cartId, db))!.lines).toHaveLength(1);
  });

  it('fails when stock ran out after the item was added', async () => {
    const { cartId, variant } = await cartWith('GRINDER-1', 2);
    await db
      .update(productVariants)
      .set({ stockQuantity: 1 })
      .where(eq(productVariants.id, variant.id));
    const result = await placeOrder({ cartId, input: input(), db });
    expect(result).toMatchObject({ ok: false, code: 'out_of_stock' });
    await db
      .update(productVariants)
      .set({ stockQuantity: variant.stockQuantity })
      .where(eq(productVariants.id, variant.id));
  });
});
