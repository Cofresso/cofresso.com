export const PRODUCT_CATEGORIES = ['coffee', 'equipment', 'merch'] as const;
export const ROAST_LEVELS = ['light', 'medium', 'medium_dark', 'dark'] as const;
export const GRINDS = ['whole_bean', 'drip', 'espresso', 'french_press', 'pour_over'] as const;
export const PURCHASE_TYPES = ['one_time', 'subscription'] as const;
export const DISCOUNT_KINDS = ['percent', 'fixed', 'free_shipping'] as const;
export const ORDER_STATUSES = ['paid', 'fulfilled', 'cancelled'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type RoastLevel = (typeof ROAST_LEVELS)[number];
export type Grind = (typeof GRINDS)[number];
export type PurchaseType = (typeof PURCHASE_TYPES)[number];
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
