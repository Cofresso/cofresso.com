import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ASSETS_BASE_URL,
  sortProductImages,
  type ImagesManifest,
} from '../../src/lib/images/manifest';
import { collections, productImages, products } from '../../src/lib/db/schema';
import { runSeed } from '../../src/lib/db/seed';
import { stableId } from '../../src/lib/db/seed/ids';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(async () => {
  // Leave the database as the other suites expect it: reseed from the
  // committed manifest (empty until the generation run has happened).
  await runSeed(db);
  await close();
});

const sha = (n: string) => n.repeat(64).slice(0, 64);

function fixture(kinds: Array<'front' | 'detail' | 'lifestyle' | 'packaging'>): ImagesManifest {
  return {
    generatedAt: '2026-09-06T12:00:00.000Z',
    model: 'gpt-image-2',
    products: {
      'morning-frame': kinds.map((kind, i) => ({
        kind,
        url: `${ASSETS_BASE_URL}/products/morning-frame/morning-frame-${kind}-1234567${i}.webp`,
        alt: `Morning Frame ${kind}`,
        width: kind === 'lifestyle' ? 1536 : 1024,
        height: 1024,
        sha: sha(String(i)),
      })),
    },
    collections: {
      blends: {
        url: `${ASSETS_BASE_URL}/collections/blends-abcdef12.webp`,
        alt: 'Cofresso Blends collection',
        width: 1536,
        height: 1024,
        sha: sha('a'),
      },
    },
    home: {},
    guides: {},
  };
}

const morningFrameId = stableId('product:morning-frame');

async function imagesFor(slug: string) {
  const [product] = await db.select().from(products).where(eq(products.slug, slug));
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.position));
}

describe('runSeed with an images manifest', () => {
  beforeAll(async () => {
    await runSeed(db, { manifest: fixture(['front', 'detail', 'lifestyle', 'packaging']) });
  });

  it('inserts one row per manifest entry in gallery order', async () => {
    const rows = await imagesFor('morning-frame');
    expect(rows.map((r) => r.kind)).toEqual(['front', 'detail', 'lifestyle', 'packaging']);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
    expect(rows[0].productId).toBe(morningFrameId);
    expect(rows[0].url).toContain('/assets/products/morning-frame/morning-frame-front-');
    expect(rows[0].alt).toBe('Morning Frame front');
    expect(rows[2].width).toBe(1536);
  });

  it('sets the collection hero and leaves other collections null', async () => {
    const [blends] = await db.select().from(collections).where(eq(collections.slug, 'blends'));
    expect(blends.heroImageUrl).toContain('/assets/collections/blends-');
    expect(blends.heroImageAlt).toBe('Cofresso Blends collection');
    const [decaf] = await db.select().from(collections).where(eq(collections.slug, 'decaf'));
    expect(decaf.heroImageUrl).toBeNull();
    expect(decaf.heroImageAlt).toBeNull();
  });

  it('is idempotent: re-seeding the same manifest upserts in place', async () => {
    const before = await imagesFor('morning-frame');
    await runSeed(db, { manifest: fixture(['front', 'detail', 'lifestyle', 'packaging']) });
    const after = await imagesFor('morning-frame');
    expect(after).toHaveLength(4);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
  });

  it('reconciles: kinds dropped from the manifest are removed', async () => {
    await runSeed(db, { manifest: fixture(['front', 'lifestyle']) });
    const rows = await imagesFor('morning-frame');
    expect(rows.map((r) => r.kind)).toEqual(['front', 'lifestyle']);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
  });

  it('reconciles against the real manifest when no override is given', async () => {
    // The background generation script is the only writer of
    // content/images.manifest.json and may have already populated it, so
    // this asserts against contentImages() rather than assuming it is
    // still empty (see AGENTS coordination note in the task brief).
    const summary = await runSeed(db);
    const manifest = (await import('../../src/lib/images/content')).contentImages();
    const expectedKinds = sortProductImages(manifest.products['morning-frame'] ?? []).map(
      (i) => i.kind,
    );
    expect((await imagesFor('morning-frame')).map((r) => r.kind)).toEqual(expectedKinds);
    const [blends] = await db.select().from(collections).where(eq(collections.slug, 'blends'));
    expect(blends.heroImageUrl).toBe(manifest.collections.blends?.url ?? null);
    expect(summary.productImages).toBe(Object.values(manifest.products).flat().length);
  });

  it('reports counts in the summary', async () => {
    const summary = await runSeed(db, { manifest: fixture(['front', 'detail']) });
    expect(summary.productImages).toBe(2);
    expect(summary.collectionHeroes).toBe(1);
  });
});
