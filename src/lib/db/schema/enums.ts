import { pgEnum } from 'drizzle-orm/pg-core';
import {
  DISCOUNT_KINDS,
  GRINDS,
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  PURCHASE_TYPES,
  ROAST_LEVELS,
} from './values';

export const productCategoryEnum = pgEnum('product_category', PRODUCT_CATEGORIES);
export const roastLevelEnum = pgEnum('roast_level', ROAST_LEVELS);
export const grindEnum = pgEnum('grind', GRINDS);
export const purchaseTypeEnum = pgEnum('purchase_type', PURCHASE_TYPES);
export const discountKindEnum = pgEnum('discount_kind', DISCOUNT_KINDS);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);

export type {
  DiscountKind,
  Grind,
  OrderStatus,
  ProductCategory,
  PurchaseType,
  RoastLevel,
} from './values';
