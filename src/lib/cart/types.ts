import type { Grind, ProductCategory, PurchaseType } from '@/lib/db/schema';
import type { DiscountRule, Totals } from '@/lib/pricing';

export interface CartLine {
  id: string;
  quantity: number;
  grind: Grind | null;
  purchaseType: PurchaseType;
  subscriptionIntervalWeeks: number | null;
  unitPriceCents: number;
  effectiveUnitPriceCents: number;
  lineTotalCents: number;
  variant: { id: string; name: string; sku: string; stockQuantity: number };
  product: { id: string; slug: string; name: string; imagePath: string; category: ProductCategory };
}

export interface CartView {
  id: string;
  discountCode: string | null;
  discount: DiscountRule | null;
  /** Set when a stored code no longer applies (for example the subtotal dropped below its minimum). */
  discountMessage: string | null;
  lines: CartLine[];
  totals: Totals;
}
