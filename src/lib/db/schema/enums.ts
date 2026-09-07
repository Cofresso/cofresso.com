import { pgEnum } from 'drizzle-orm/pg-core';
import {
  DISCOUNT_KINDS,
  GRINDS,
  IMAGE_KINDS,
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
export const imageKindEnum = pgEnum('image_kind', IMAGE_KINDS);

export type {
  DiscountKind,
  Grind,
  ImageKind,
  OrderStatus,
  ProductCategory,
  PurchaseType,
  RoastLevel,
} from './values';
