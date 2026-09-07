import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import {
  lowestPriceCents,
  type ProductCardData,
  type ProductDetailData,
} from '@/lib/catalog/types';
import { getDb, type Db } from '@/lib/db/client';
import {
  collections,
  productCollections,
  productImages,
  products,
  reviews,
  type Collection,
  type Product,
  type ProductImage,
  type Review,
} from '@/lib/db/schema';
import type { ProductFilters } from '@/lib/shop/filters';

type ProductWithRelations = Product & {
  variants: ProductCardData['variants'];
  images: ProductImage[];
  reviews: Pick<Review, 'rating'>[];
};

function toCard(p: ProductWithRelations): ProductCardData {
  const count = p.reviews.length;
  const average = count ? p.reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  const { reviews: _reviews, variants, images, ...product } = p;
  return {
    product,
    variants: [...variants].sort((a, b) => a.position - b.position),
    images: [...images].sort((a, b) => a.position - b.position),
    rating: { average: Math.round(average * 10) / 10, count },
  };
}

const withCardRelations = {
  variants: true as const,
  images: { orderBy: [asc(productImages.position)] },
  reviews: { columns: { rating: true as const } },
};

function sortCards(items: ProductCardData[], sort: ProductFilters['sort']): ProductCardData[] {
  const byName = (a: ProductCardData, b: ProductCardData) =>
    a.product.name.localeCompare(b.product.name);
  switch (sort) {
    case 'price_asc':
      return items.sort(
        (a, b) => lowestPriceCents(a.variants) - lowestPriceCents(b.variants) || byName(a, b),
      );
    case 'price_desc':
      return items.sort(
        (a, b) => lowestPriceCents(b.variants) - lowestPriceCents(a.variants) || byName(a, b),
      );
    case 'newest':
      return items.sort(
        (a, b) => b.product.createdAt.getTime() - a.product.createdAt.getTime() || byName(a, b),
      );
    default:
      return items.sort(
        (a, b) => Number(b.product.featured) - Number(a.product.featured) || byName(a, b),
      );
  }
}

export async function listProducts(
  filters: ProductFilters = { sort: 'featured' },
  db: Db = getDb(),
): Promise<ProductCardData[]> {
  const conditions = [eq(products.active, true)];
  if (filters.roast) conditions.push(eq(products.roastLevel, filters.roast));
  if (filters.category) conditions.push(eq(products.category, filters.category));
  if (filters.origin) conditions.push(ilike(products.origin, `%${filters.origin}%`));
  if (filters.collection) {
    conditions.push(
      inArray(
        products.id,
        db
          .select({ id: productCollections.productId })
          .from(productCollections)
          .innerJoin(collections, eq(collections.id, productCollections.collectionId))
          .where(eq(collections.slug, filters.collection)),
      ),
    );
  }

  const rows = await db.query.products.findMany({
    where: and(...conditions),
    with: withCardRelations,
  });
  return sortCards(rows.map(toCard), filters.sort);
}

export async function listFeaturedProducts(
  limit = 4,
  db: Db = getDb(),
): Promise<ProductCardData[]> {
  const rows = await db.query.products.findMany({
    where: and(eq(products.active, true), eq(products.featured, true)),
    with: withCardRelations,
    orderBy: [asc(products.name)],
    limit,
  });
  return rows.map(toCard);
}

export async function getProductBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<ProductDetailData | null> {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      variants: true,
      images: { orderBy: [asc(productImages.position)] },
      reviews: { orderBy: [desc(reviews.createdAt)] },
      productCollections: {
        with: { collection: true },
        orderBy: [asc(productCollections.position)],
      },
    },
  });
  if (!row) return null;
  const { productCollections: pcs, reviews: fullReviews, ...rest } = row;
  const card = toCard({ ...rest, reviews: fullReviews });
  return { ...card, collections: pcs.map((pc) => pc.collection), reviews: fullReviews };
}

export async function listRelatedProducts(
  product: Product,
  limit = 4,
  db: Db = getDb(),
): Promise<ProductCardData[]> {
  const rows = await db.query.products.findMany({
    where: and(
      eq(products.active, true),
      ne(products.id, product.id),
      eq(products.category, product.category),
    ),
    with: withCardRelations,
    orderBy: [desc(products.featured), asc(products.name)],
    limit,
  });
  return rows.map(toCard);
}

export async function searchProducts(query: string, db: Db = getDb()): Promise<ProductCardData[]> {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[%_]/g, '')}%`;
  const rows = await db.query.products.findMany({
    where: and(
      eq(products.active, true),
      or(
        ilike(products.name, pattern),
        ilike(products.tagline, pattern),
        ilike(products.origin, pattern),
        ilike(products.region, pattern),
        sql`array_to_string(${products.tastingNotes}, ' ') ilike ${pattern}`,
      ),
    ),
    with: withCardRelations,
    orderBy: [desc(products.featured), asc(products.name)],
  });
  return rows.map(toCard);
}

export async function listCollections(db: Db = getDb()): Promise<Collection[]> {
  return db.query.collections.findMany({ orderBy: [asc(collections.position)] });
}

export async function getCollectionBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<Collection | null> {
  return (await db.query.collections.findFirst({ where: eq(collections.slug, slug) })) ?? null;
}

export async function listOrigins(db: Db = getDb()): Promise<string[]> {
  const rows = await db
    .selectDistinct({ origin: products.origin })
    .from(products)
    .where(and(eq(products.active, true), eq(products.category, 'coffee')))
    .orderBy(asc(products.origin));
  return rows.map((r) => r.origin).filter((o): o is string => Boolean(o));
}

export type RecentReview = Review & { product: Pick<Product, 'slug' | 'name'> };

export async function listRecentReviews(limit = 6, db: Db = getDb()): Promise<RecentReview[]> {
  return db.query.reviews.findMany({
    where: sql`${reviews.rating} >= 4`,
    with: { product: { columns: { slug: true, name: true } } },
    orderBy: [desc(reviews.createdAt)],
    limit,
  });
}

export async function listProductSlugs(
  db: Db = getDb(),
): Promise<Array<{ slug: string; createdAt: Date }>> {
  return db
    .select({ slug: products.slug, createdAt: products.createdAt })
    .from(products)
    .where(eq(products.active, true));
}
