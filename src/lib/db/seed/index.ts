import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  collections,
  discountCodes,
  productCollections,
  productVariants,
  products,
  reviews,
} from '@/lib/db/schema';
import { seedCollections, seedDiscountCodes, seedProducts } from './data';
import { stableId } from './ids';
import { buildSeedReviews } from './reviews';

export interface SeedSummary {
  collections: number;
  products: number;
  variants: number;
  reviews: number;
  discountCodes: number;
}

export async function runSeed(db: Db): Promise<SeedSummary> {
  const seedReviews = buildSeedReviews();

  await db.transaction(async (tx) => {
    for (const c of seedCollections) {
      await tx
        .insert(collections)
        .values({ id: stableId(`collection:${c.slug}`), ...c })
        .onConflictDoUpdate({
          target: collections.slug,
          set: { name: c.name, description: c.description, position: c.position },
        });
    }

    for (const p of seedProducts) {
      const productId = stableId(`product:${p.slug}`);
      const values = {
        id: productId,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        category: p.category,
        origin: p.origin ?? null,
        region: p.region ?? null,
        producer: p.producer ?? null,
        altitudeM: p.altitudeM ?? null,
        process: p.process ?? null,
        roastLevel: p.roastLevel ?? null,
        tastingNotes: p.tastingNotes,
        imagePath: `/products/${p.slug}.svg`,
        featured: p.featured ?? false,
        active: true,
      };
      const { id: _id, slug: _slug, ...updatable } = values;
      await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.slug, set: updatable });

      for (const v of p.variants) {
        const variantId = stableId(`variant:${v.sku}`);
        await tx
          .insert(productVariants)
          .values({
            id: variantId,
            productId,
            sku: v.sku,
            name: v.name,
            weightGrams: v.weightGrams,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents ?? null,
            stockQuantity: v.stockQuantity,
            position: p.variants.indexOf(v),
          })
          .onConflictDoUpdate({
            target: productVariants.sku,
            // Intentionally do not overwrite stock_quantity so orders placed against a
            // seeded database keep their inventory effect.
            set: {
              name: v.name,
              weightGrams: v.weightGrams,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents ?? null,
              position: p.variants.indexOf(v),
            },
          });
      }

      for (const [index, collectionSlug] of p.collections.entries()) {
        await tx
          .insert(productCollections)
          .values({
            productId,
            collectionId: stableId(`collection:${collectionSlug}`),
            position: index,
          })
          .onConflictDoUpdate({
            target: [productCollections.productId, productCollections.collectionId],
            set: { position: index },
          });
      }
    }

    for (const r of seedReviews) {
      const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000);
      await tx
        .insert(reviews)
        .values({
          id: stableId(`review:${r.key}`),
          productId: stableId(`product:${r.productSlug}`),
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: r.verified,
          createdAt,
        })
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
            authorName: r.authorName,
            rating: r.rating,
            title: r.title,
            body: r.body,
            verified: r.verified,
          },
        });
    }

    for (const d of seedDiscountCodes) {
      await tx
        .insert(discountCodes)
        .values({ id: stableId(`discount:${d.code}`), ...d, active: true })
        .onConflictDoUpdate({
          target: discountCodes.code,
          set: { kind: d.kind, value: d.value, minSubtotalCents: d.minSubtotalCents, active: true },
        });
    }

    // Keep the order number sequence ahead of any seeded/legacy data.
    await tx.execute(
      sql`select setval('order_number_seq', greatest(nextval('order_number_seq'), 10001), false)`,
    );
  });

  return {
    collections: seedCollections.length,
    products: seedProducts.length,
    variants: seedProducts.reduce((n, p) => n + p.variants.length, 0),
    reviews: seedReviews.length,
    discountCodes: seedDiscountCodes.length,
  };
}
