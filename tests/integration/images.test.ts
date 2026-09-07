import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ASSETS_BASE_URL,
  EMPTY_MANIFEST,
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

  it('fully reconciles to empty: deletes all rows and clears the hero when the manifest is empty', async () => {
    // Establish a known non-empty state deterministically (a fixture, never
    // the on-disk manifest), then reconcile against EMPTY_MANIFEST. This
    // exercises the `keptKinds.length === 0` branch in runSeed, which the
    // notInArray-based deletion in the previous test does not reach.
    await runSeed(db, { manifest: fixture(['front', 'detail', 'lifestyle', 'packaging']) });
    const summary = await runSeed(db, { manifest: EMPTY_MANIFEST });
    expect(await imagesFor('morning-frame')).toEqual([]);
    expect(summary.productImages).toBe(0);
    expect(summary.collectionHeroes).toBe(0);
    const [blends] = await db.select().from(collections).where(eq(collections.slug, 'blends'));
    expect(blends.heroImageUrl).toBeNull();
    expect(blends.heroImageAlt).toBeNull();
  });

  it('resolves against the real manifest when no override is given', async () => {
    // Smoke check only: content/images.manifest.json is owned by the
    // background generation script and may be empty or fully populated at
    // any given time, so this must not assert anything derived from its
    // current contents (that would just re-run production logic to compute
    // what it asserts). It only proves the no-argument call is wired up.
    const summary = await runSeed(db);
    expect(summary.productImages).toBeGreaterThanOrEqual(0);
    expect(summary.collectionHeroes).toBeGreaterThanOrEqual(0);
  });

  it('reports counts in the summary', async () => {
    const summary = await runSeed(db, { manifest: fixture(['front', 'detail']) });
    expect(summary.productImages).toBe(2);
    expect(summary.collectionHeroes).toBe(1);
  });
});
