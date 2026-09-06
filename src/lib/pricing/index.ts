import { siteConfig } from '@/lib/config';
import type { DiscountRule, PricingConfig, PricingLine, Totals } from './types';

export * from './types';
export * from './discounts';

export const defaultPricingConfig: PricingConfig = siteConfig.pricing;

export function subscriptionUnitPriceCents(unitPriceCents: number, cfg: PricingConfig): number {
  return Math.round((unitPriceCents * (100 - cfg.subscriptionDiscountPercent)) / 100);
}

export function effectiveUnitPriceCents(
  line: PricingLine,
  cfg: PricingConfig = defaultPricingConfig,
): number {
  return line.purchaseType === 'subscription'
    ? subscriptionUnitPriceCents(line.unitPriceCents, cfg)
    : line.unitPriceCents;
}

export function lineTotalCents(
  line: PricingLine,
  cfg: PricingConfig = defaultPricingConfig,
): number {
  return effectiveUnitPriceCents(line, cfg) * line.quantity;
}

export function computeDiscountCents(rule: DiscountRule | null, subtotalCents: number): number {
  if (!rule) return 0;
  switch (rule.kind) {
    case 'percent':
      return Math.min(subtotalCents, Math.round((subtotalCents * rule.value) / 100));
    case 'fixed':
      return Math.min(subtotalCents, Math.max(0, rule.value));
    case 'free_shipping':
      return 0;
  }
}

export function computeTotals(
  lines: PricingLine[],
  rule: DiscountRule | null,
  cfg: PricingConfig = defaultPricingConfig,
): Totals {
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const listSubtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const subtotalCents = lines.reduce((n, l) => n + lineTotalCents(l, cfg), 0);
  const subscriptionSavingsCents = listSubtotal - subtotalCents;
  const discountCents = computeDiscountCents(rule, subtotalCents);
  const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);

  const freeShippingUnlocked = discountedSubtotalCents >= cfg.freeShippingThresholdCents;
  const freeShippingRemainingCents = Math.max(
    0,
    cfg.freeShippingThresholdCents - discountedSubtotalCents,
  );
  const shippingCents =
    itemCount === 0 || freeShippingUnlocked || rule?.kind === 'free_shipping'
      ? 0
      : cfg.shippingFlatCents;

  const taxCents = Math.round(discountedSubtotalCents * cfg.taxRate);
  const totalCents = discountedSubtotalCents + shippingCents + taxCents;

  return {
    itemCount,
    subtotalCents,
    subscriptionSavingsCents,
    discountCents,
    discountedSubtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    freeShippingRemainingCents,
    freeShippingUnlocked,
  };
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}
