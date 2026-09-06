import {
  boolean,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { products, productVariants } from './catalog';
import { discountKindEnum, grindEnum, orderStatusEnum, purchaseTypeEnum } from './enums';

export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 10001, increment: 1 });

export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  kind: discountKindEnum('kind').notNull(),
  value: integer('value').notNull().default(0),
  minSubtotalCents: integer('min_subtotal_cents').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
});

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull().unique(),
    email: text('email').notNull(),
    status: orderStatusEnum('status').notNull().default('paid'),
    shippingName: text('shipping_name').notNull(),
    shippingAddress1: text('shipping_address1').notNull(),
    shippingAddress2: text('shipping_address2'),
    shippingCity: text('shipping_city').notNull(),
    shippingState: text('shipping_state').notNull(),
    shippingPostalCode: text('shipping_postal_code').notNull(),
    shippingCountry: text('shipping_country').notNull().default('US'),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    shippingCents: integer('shipping_cents').notNull(),
    taxCents: integer('tax_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    discountCode: text('discount_code'),
    paymentProvider: text('payment_provider').notNull(),
    paymentReference: text('payment_reference').notNull(),
    cardLast4: text('card_last4'),
    lookupToken: text('lookup_token').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('orders_email_idx').on(t.email)],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    productSlug: text('product_slug').notNull(),
    variantName: text('variant_name').notNull(),
    imagePath: text('image_path').notNull(),
    grind: grindEnum('grind'),
    purchaseType: purchaseTypeEnum('purchase_type').notNull(),
    subscriptionIntervalWeeks: integer('subscription_interval_weeks'),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export type DiscountCode = typeof discountCodes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
