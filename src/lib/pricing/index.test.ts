import { describe, expect, it } from 'vitest';
import {
  computeDiscountCents,
  computeTotals,
  effectiveUnitPriceCents,
  formatPrice,
  lineTotalCents,
} from './index';
import type { PricingConfig, PricingLine } from './types';

const cfg: PricingConfig = {
  subscriptionDiscountPercent: 15,
  shippingFlatCents: 600,
  freeShippingThresholdCents: 4500,
  taxRate: 0.08,
};

const line = (
  unitPriceCents: number,
  quantity = 1,
  purchaseType: PricingLine['purchaseType'] = 'one_time',
): PricingLine => ({
  unitPriceCents,
  quantity,
  purchaseType,
});

describe('effectiveUnitPriceCents', () => {
  it('returns the list price for one-time purchases', () => {
    expect(effectiveUnitPriceCents(line(1800), cfg)).toBe(1800);
  });
  it('applies the subscription discount rounded to the cent', () => {
    expect(effectiveUnitPriceCents(line(1800, 1, 'subscription'), cfg)).toBe(1530);
    expect(effectiveUnitPriceCents(line(1999, 1, 'subscription'), cfg)).toBe(1699);
  });
});

describe('lineTotalCents', () => {
  it('multiplies by quantity', () => {
    expect(lineTotalCents(line(1800, 3), cfg)).toBe(5400);
    expect(lineTotalCents(line(1800, 2, 'subscription'), cfg)).toBe(3060);
  });
});

describe('computeDiscountCents', () => {
  it('handles percent, fixed and free shipping', () => {
    expect(computeDiscountCents({ kind: 'percent', value: 10, minSubtotalCents: 0 }, 5400)).toBe(
      540,
    );
    expect(computeDiscountCents({ kind: 'fixed', value: 1000, minSubtotalCents: 0 }, 5400)).toBe(
      1000,
    );
    expect(computeDiscountCents({ kind: 'fixed', value: 10000, minSubtotalCents: 0 }, 5400)).toBe(
      5400,
    );
    expect(
      computeDiscountCents({ kind: 'free_shipping', value: 0, minSubtotalCents: 0 }, 5400),
    ).toBe(0);
    expect(computeDiscountCents(null, 5400)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('charges flat shipping under the threshold and tax on the discounted subtotal', () => {
    const t = computeTotals([line(1800, 2)], null, cfg);
    expect(t).toMatchObject({
      itemCount: 2,
      subtotalCents: 3600,
      subscriptionSavingsCents: 0,
      discountCents: 0,
      discountedSubtotalCents: 3600,
      shippingCents: 600,
      taxCents: 288,
      totalCents: 4488,
      freeShippingRemainingCents: 900,
      freeShippingUnlocked: false,
    });
  });

  it('unlocks free shipping at the threshold', () => {
    const t = computeTotals([line(4500)], null, cfg);
    expect(t.shippingCents).toBe(0);
    expect(t.freeShippingUnlocked).toBe(true);
    expect(t.freeShippingRemainingCents).toBe(0);
  });

  it('applies subscription savings before the discount code', () => {
    const t = computeTotals(
      [line(2000, 2, 'subscription')],
      { kind: 'percent', value: 10, minSubtotalCents: 0 },
      cfg,
    );
    expect(t.subscriptionSavingsCents).toBe(600);
    expect(t.subtotalCents).toBe(3400);
    expect(t.discountCents).toBe(340);
    expect(t.discountedSubtotalCents).toBe(3060);
    expect(t.shippingCents).toBe(600);
    expect(t.taxCents).toBe(245);
    expect(t.totalCents).toBe(3905);
  });

  it('free shipping code zeroes shipping and nothing else', () => {
    const t = computeTotals(
      [line(1000)],
      { kind: 'free_shipping', value: 0, minSubtotalCents: 0 },
      cfg,
    );
    expect(t.discountCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(1080);
  });

  it('a discount can drop the subtotal below the free-shipping threshold', () => {
    const t = computeTotals([line(4600)], { kind: 'fixed', value: 500, minSubtotalCents: 0 }, cfg);
    expect(t.discountedSubtotalCents).toBe(4100);
    expect(t.shippingCents).toBe(600);
  });

  it('never goes negative', () => {
    const t = computeTotals([line(500)], { kind: 'fixed', value: 99999, minSubtotalCents: 0 }, cfg);
    expect(t.discountedSubtotalCents).toBe(0);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(600);
  });

  it('handles an empty cart', () => {
    const t = computeTotals([], null, cfg);
    expect(t.totalCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.itemCount).toBe(0);
  });
});

describe('formatPrice', () => {
  it('formats cents as USD', () => {
    expect(formatPrice(1800)).toBe('$18.00');
    expect(formatPrice(4488)).toBe('$44.88');
    expect(formatPrice(0)).toBe('$0.00');
  });
});
