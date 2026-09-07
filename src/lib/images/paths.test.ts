import { describe, expect, it } from 'vitest';
import { ASSETS_BASE_URL } from './manifest';
import {
  assetUrl,
  collectionObjectPath,
  guideObjectPath,
  homeObjectPath,
  IMAGE_CACHE_CONTROL,
  IMAGE_CONTENT_TYPE,
  productObjectPath,
  sha8,
} from './paths';

describe('paths', () => {
  it('takes the first eight hex characters of a sha', () => {
    expect(sha8('0123456789abcdef'.repeat(4))).toBe('01234567');
  });

  it('builds content-addressed object paths', () => {
    expect(productObjectPath('morning-frame', 'front', 'deadbeef')).toBe(
      'products/morning-frame/morning-frame-front-deadbeef.webp',
    );
    expect(collectionObjectPath('blends', 'deadbeef')).toBe('collections/blends-deadbeef.webp');
    expect(homeObjectPath('story', 'deadbeef')).toBe('home/story-deadbeef.webp');
    expect(guideObjectPath('pour-over', 'deadbeef')).toBe('guides/pour-over-deadbeef.webp');
  });

  it('builds public URLs under the assets base', () => {
    expect(assetUrl('home/hero-deadbeef.webp')).toBe(`${ASSETS_BASE_URL}/home/hero-deadbeef.webp`);
  });

  it('pins the immutable cache header and content type', () => {
    expect(IMAGE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
    expect(IMAGE_CONTENT_TYPE).toBe('image/webp');
  });
});
