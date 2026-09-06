import { describe, expect, it } from 'vitest';
import { addToCartSchema } from './schemas';

describe('addToCartSchema', () => {
  const variantId = '3f2d0d3e-2f4a-4a7e-9d5b-4c6c1d2f3a4b';
  it('accepts a one-time whole-bean line', () => {
    const r = addToCartSchema.safeParse({
      variantId,
      quantity: '2',
      grind: 'whole_bean',
      purchaseType: 'one_time',
    });
    expect(r.success).toBe(true);
    if (r.success)
      expect(r.data).toEqual({
        variantId,
        quantity: 2,
        grind: 'whole_bean',
        purchaseType: 'one_time',
        subscriptionIntervalWeeks: null,
      });
  });
  it('requires an interval for subscriptions', () => {
    expect(
      addToCartSchema.safeParse({ variantId, quantity: 1, purchaseType: 'subscription' }).success,
    ).toBe(false);
    const ok = addToCartSchema.safeParse({
      variantId,
      quantity: 1,
      purchaseType: 'subscription',
      subscriptionIntervalWeeks: '4',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.subscriptionIntervalWeeks).toBe(4);
  });
  it('caps quantity and rejects bad ids', () => {
    expect(
      addToCartSchema.safeParse({ variantId, quantity: 11, purchaseType: 'one_time' }).success,
    ).toBe(false);
    expect(
      addToCartSchema.safeParse({ variantId: 'nope', quantity: 1, purchaseType: 'one_time' })
        .success,
    ).toBe(false);
  });
});
