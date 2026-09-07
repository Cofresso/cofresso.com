import { describe, expect, it } from 'vitest';
import {
  ASSETS_BASE_URL,
  EMPTY_MANIFEST,
  imagesManifestSchema,
  parseManifest,
  serializeManifest,
  sortProductImages,
  type ImagesManifest,
  type ManifestProductImage,
} from './manifest';

const sha = 'a'.repeat(64);

function entry(overrides: Partial<ManifestProductImage> = {}): ManifestProductImage {
  return {
    kind: 'front',
    url: `${ASSETS_BASE_URL}/products/morning-frame/morning-frame-front-aaaaaaaa.webp`,
    alt: 'A bag of Cofresso Morning Frame',
    width: 1024,
    height: 1024,
    sha,
    ...overrides,
  };
}

const full: ImagesManifest = {
  generatedAt: '2026-09-06T12:00:00.000Z',
  model: 'gpt-image-2',
  products: { 'morning-frame': [entry()] },
  collections: {
    blends: {
      url: `${ASSETS_BASE_URL}/collections/blends-bbbbbbbb.webp`,
      alt: 'Blends collection',
      width: 1536,
      height: 1024,
      sha: 'b'.repeat(64),
    },
  },
  home: {
    hero: {
      url: `${ASSETS_BASE_URL}/home/hero-cccccccc.webp`,
      alt: 'Cofresso bar',
      width: 1536,
      height: 1024,
      sha: 'c'.repeat(64),
    },
  },
  guides: {
    'pour-over': {
      url: `${ASSETS_BASE_URL}/guides/pour-over-dddddddd.webp`,
      alt: 'Pour over',
      width: 1536,
      height: 1024,
      sha: 'd'.repeat(64),
    },
  },
};

describe('imagesManifestSchema', () => {
  it('accepts a fully populated manifest', () => {
    expect(imagesManifestSchema.parse(full)).toEqual(full);
  });

  it('accepts an empty manifest and fills the collections', () => {
    const parsed = imagesManifestSchema.parse({
      generatedAt: '1970-01-01T00:00:00.000Z',
      model: 'none',
    });
    expect(parsed).toEqual(EMPTY_MANIFEST);
  });

  it('rejects urls outside the assets base', () => {
    const bad = { ...full, products: { x: [entry({ url: 'https://evil.example/a.webp' })] } };
    expect(imagesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown kinds, bad shas and non-positive dimensions', () => {
    expect(
      imagesManifestSchema.safeParse({
        ...full,
        products: { x: [{ ...entry(), kind: 'back' }] },
      }).success,
    ).toBe(false);
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ sha: 'nope' })] } })
        .success,
    ).toBe(false);
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ width: 0 })] } }).success,
    ).toBe(false);
  });

  it('rejects an empty alt string', () => {
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ alt: '' })] } }).success,
    ).toBe(false);
  });
});

describe('parseManifest', () => {
  it('treats null and undefined as empty', () => {
    expect(parseManifest(null)).toEqual(EMPTY_MANIFEST);
    expect(parseManifest(undefined)).toEqual(EMPTY_MANIFEST);
  });

  it('throws on malformed input', () => {
    expect(() => parseManifest({ generatedAt: 'yesterday', model: 'x' })).toThrow();
  });
});

describe('serializeManifest', () => {
  it('is deterministic, key-sorted and newline-terminated', () => {
    const text = serializeManifest(full);
    expect(text).toBe(serializeManifest(structuredClone(full)));
    expect(text.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual([
      'collections',
      'generatedAt',
      'guides',
      'home',
      'model',
      'products',
    ]);
    expect(parseManifest(JSON.parse(text))).toEqual(full);
  });
});

describe('sortProductImages', () => {
  it('orders by IMAGE_KINDS, not by input order', () => {
    const images = [
      entry({ kind: 'packaging' }),
      entry({ kind: 'detail' }),
      entry({ kind: 'front' }),
      entry({ kind: 'lifestyle' }),
    ];
    expect(sortProductImages(images).map((i) => i.kind)).toEqual([
      'front',
      'detail',
      'lifestyle',
      'packaging',
    ]);
  });
});
