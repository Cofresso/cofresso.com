import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { productVariants } from './catalog';
import { grindEnum, purchaseTypeEnum } from './enums';

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  discountCode: text('discount_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    grind: grindEnum('grind'),
    purchaseType: purchaseTypeEnum('purchase_type').notNull().default('one_time'),
    subscriptionIntervalWeeks: integer('subscription_interval_weeks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cart_items_cart_idx').on(t.cartId),
    // NULLS NOT DISTINCT so two identical whole-bean lines merge instead of duplicating.
    // NOTE: the installed drizzle-orm (0.45.2) only exposes .nullsNotDistinct() on the
    // table-level `unique()` constraint builder, not on `uniqueIndex()` (see
    // node_modules/drizzle-orm/pg-core/indexes.d.ts vs unique-constraint.d.ts). A unique
    // constraint is backed by a unique index in Postgres, so this is semantically
    // equivalent for both the merge-on-conflict use case and `ON CONFLICT (...)` targeting.
    unique('cart_items_line_key')
      .on(t.cartId, t.variantId, t.grind, t.purchaseType, t.subscriptionIntervalWeeks)
      .nullsNotDistinct(),
  ],
);

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
