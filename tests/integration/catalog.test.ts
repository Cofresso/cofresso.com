import { afterAll, describe, expect, it } from 'vitest';
import { lowestPriceCents, primaryImage } from '../../src/lib/catalog/types';
import {
  getCollectionBySlug,
  getProductBySlug,
  listCollections,
  listFeaturedProducts,
  listOrigins,
  listProducts,
  listRecentReviews,
  listRelatedProducts,
  searchProducts,
} from '../../src/lib/db/queries/catalog';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('catalog queries', () => {
  it('lists active products featured-first by default', async () => {
    const items = await listProducts(undefined, db);
    expect(items.length).toBeGreaterThanOrEqual(18);
    expect(items[0].product.featured).toBe(true);
    expect(items.every((i) => i.variants.length > 0)).toBe(true);
  });

  it('filters by collection, roast and origin', async () => {
    const gear = await listProducts({ collection: 'equipment', sort: 'featured' }, db);
    expect(gear.every((i) => i.product.category !== 'coffee')).toBe(true);
    const light = await listProducts({ roast: 'light', sort: 'featured' }, db);
    expect(light.every((i) => i.product.roastLevel === 'light')).toBe(true);
    const kenya = await listProducts({ origin: 'kenya', sort: 'featured' }, db);
    expect(kenya.map((i) => i.product.slug)).toEqual(['kenya-nyeri']);
  });

  it('sorts by price', async () => {
    const asc = await listProducts({ sort: 'price_asc' }, db);
    const prices = asc.map((i) => lowestPriceCents(i.variants));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('loads a product with sorted variants, reviews and collections', async () => {
    const p = await getProductBySlug('morning-frame', db);
    expect(p).not.toBeNull();
    expect(p!.variants.map((v) => v.name)).toEqual(['12 oz', '2 lb', '5 lb']);
    expect(p!.reviews.length).toBeGreaterThan(0);
    expect(p!.collections.map((c) => c.slug)).toEqual(['blends']);
    expect(p!.rating.count).toBe(p!.reviews.length);
    expect(await getProductBySlug('does-not-exist', db)).toBeNull();
  });

  it('finds related products in the same category excluding itself', async () => {
    const p = await getProductBySlug('gooseneck-kettle', db);
    const related = await listRelatedProducts(p!.product, 3, db);
    expect(related).toHaveLength(3);
    expect(
      related.every(
        (r) => r.product.category !== 'coffee' && r.product.slug !== 'gooseneck-kettle',
      ),
    ).toBe(true);
  });

  it('searches names, origins and tasting notes', async () => {
    expect((await searchProducts('ethiopia', db)).map((i) => i.product.slug)).toContain(
      'ethiopia-yirgacheffe',
    );
    expect((await searchProducts('jasmine', db)).map((i) => i.product.slug)).toContain(
      'ethiopia-yirgacheffe',
    );
    expect(await searchProducts('   ', db)).toEqual([]);
    expect(await searchProducts('zzzz-nothing', db)).toEqual([]);
  });

  it('lists collections, origins, featured and recent reviews', async () => {
    expect((await listCollections(db)).map((c) => c.slug)).toEqual([
      'single-origin',
      'blends',
      'decaf',
      'equipment',
    ]);
    expect((await getCollectionBySlug('blends', db))?.name).toBe('Blends');
    expect(await listOrigins(db)).toContain('Kenya');
    expect((await listFeaturedProducts(4, db)).length).toBe(4);
    const recent = await listRecentReviews(5, db);
    expect(recent).toHaveLength(5);
    expect(recent[0].product.slug).toBeTruthy();
  });

  it('returns product images in position order on cards and detail', async () => {
    const items = await listProducts(undefined, db);
    for (const item of items) {
      const positions = item.images.map((i) => i.position);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(new Set(item.images.map((i) => i.kind)).size).toBe(item.images.length);
      for (const image of item.images) {
        expect(image.productId).toBe(item.product.id);
        expect(image.url).toContain('/assets/');
        expect(image.alt.length).toBeGreaterThan(0);
      }
    }

    const detail = await getProductBySlug('morning-frame', db);
    expect(detail!.images.map((i) => i.position)).toEqual(
      detail!.images.map((_, i) => i).slice(0, detail!.images.length),
    );
    if (detail!.images.length > 0) expect(primaryImage(detail!.images)!.kind).toBe('front');
  });

  it('exposes collection hero columns', async () => {
    const list = await listCollections(db);
    for (const collection of list) {
      expect(collection).toHaveProperty('heroImageUrl');
      expect(collection).toHaveProperty('heroImageAlt');
      if (collection.heroImageUrl) expect(collection.heroImageUrl).toContain('/assets/');
    }
    const blends = await getCollectionBySlug('blends', db);
    expect(blends).toHaveProperty('heroImageUrl');
  });
});
