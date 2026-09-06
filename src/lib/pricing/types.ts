export type PricingPurchaseType = 'one_time' | 'subscription';

export interface PricingLine {
  unitPriceCents: number;
  quantity: number;
  purchaseType: PricingPurchaseType;
}

export type DiscountRuleKind = 'percent' | 'fixed' | 'free_shipping';

export interface DiscountRule {
  kind: DiscountRuleKind;
  /** Percent (0-100) for `percent`, cents for `fixed`, ignored for `free_shipping`. */
  value: number;
  minSubtotalCents: number;
}

export interface PricingConfig {
  subscriptionDiscountPercent: number;
  shippingFlatCents: number;
  freeShippingThresholdCents: number;
  taxRate: number;
}

export interface Totals {
  itemCount: number;
  /** Sum of line totals after subscription savings, before discount codes. */
  subtotalCents: number;
  subscriptionSavingsCents: number;
  discountCents: number;
  discountedSubtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShippingRemainingCents: number;
  freeShippingUnlocked: boolean;
}
