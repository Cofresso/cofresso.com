import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import { collectionImage, contentImages, guideImage, homeImage, productImagesFor } from './content';
import { ASSETS_BASE_URL, imagesManifestSchema } from './manifest';

describe('contentImages', () => {
  it('parses the committed manifest', () => {
    expect(imagesManifestSchema.safeParse(contentImages()).success).toBe(true);
  });

  it('is cached, so the JSON is validated once', () => {
    expect(contentImages()).toBe(contentImages());
  });

  it('serves every recorded url from the CDN and uses known kinds', () => {
    const manifest = contentImages();
    const entries = [
      ...Object.values(manifest.products).flat(),
      ...Object.values(manifest.collections),
      ...Object.values(manifest.home),
      ...Object.values(manifest.guides),
    ];
    for (const entry of entries) {
      expect(entry.url.startsWith(`${ASSETS_BASE_URL}/`)).toBe(true);
      expect(entry.alt.length).toBeGreaterThan(0);
    }
    for (const images of Object.values(manifest.products)) {
      for (const image of images) expect(IMAGE_KINDS).toContain(image.kind);
    }
  });

  it('returns null rather than undefined for absent lookups', () => {
    expect(homeImage('hero')).toEqual(contentImages().home.hero ?? null);
    expect(guideImage('no-such-guide')).toBeNull();
    expect(collectionImage('no-such-collection')).toBeNull();
    expect(productImagesFor('no-such-product')).toEqual([]);
  });

  it('returns product images in gallery order', () => {
    for (const slug of Object.keys(contentImages().products)) {
      const kinds = productImagesFor(slug).map((i) => i.kind);
      const expected = IMAGE_KINDS.filter((k) => kinds.includes(k));
      expect(kinds).toEqual(expected);
    }
  });
});
