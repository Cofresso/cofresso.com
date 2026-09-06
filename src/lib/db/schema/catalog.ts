import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { productCategoryEnum, roastLevelEnum } from './enums';

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull(),
    description: text('description').notNull(),
    category: productCategoryEnum('category').notNull(),
    origin: text('origin'),
    region: text('region'),
    producer: text('producer'),
    altitudeM: integer('altitude_m'),
    process: text('process'),
    roastLevel: roastLevelEnum('roast_level'),
    tastingNotes: text('tasting_notes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    imagePath: text('image_path').notNull(),
    featured: boolean('featured').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('products_category_idx').on(t.category),
    index('products_featured_idx').on(t.featured),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    weightGrams: integer('weight_grams'),
    priceCents: integer('price_cents').notNull(),
    compareAtPriceCents: integer('compare_at_price_cents'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_variants_product_idx').on(t.productId)],
);

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
});

export const productCollections = pgTable(
  'product_collections',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reviews_product_idx').on(t.productId)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type Review = typeof reviews.$inferSelect;
