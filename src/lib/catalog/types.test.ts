import { describe, expect, it } from 'vitest';
import type { ProductImage } from '@/lib/db/schema';
import { hoverImage, imageOfKind, primaryImage, thumbnailImage } from './types';

function image(kind: ProductImage['kind'], position: number): ProductImage {
  return {
    id: `img-${kind}`,
    productId: 'p1',
    url: `https://cofresso.com/assets/products/x/x-${kind}-deadbeef.webp`,
    alt: `x ${kind}`,
    kind,
    width: 1024,
    height: 1024,
    position,
  };
}

const all = [image('lifestyle', 2), image('front', 0), image('detail', 1)];

describe('image selectors', () => {
  it('finds an image by kind', () => {
    expect(imageOfKind(all, 'detail')?.id).toBe('img-detail');
    expect(imageOfKind(all, 'packaging')).toBeUndefined();
    expect(imageOfKind([], 'front')).toBeUndefined();
  });

  it('prefers the front image, then the lowest position', () => {
    expect(primaryImage(all)?.kind).toBe('front');
    expect(primaryImage([image('detail', 1), image('lifestyle', 2)])?.kind).toBe('detail');
    expect(primaryImage([])).toBeUndefined();
  });

  it('uses lifestyle for the hover swap, falling back to detail', () => {
    expect(hoverImage(all)?.kind).toBe('lifestyle');
    expect(hoverImage([image('front', 0), image('detail', 1)])?.kind).toBe('detail');
    expect(hoverImage([image('front', 0)])).toBeUndefined();
  });

  it('builds the thumbnail from the lead photograph, else the SVG art', () => {
    const product = { name: 'Morning Frame', imagePath: '/products/morning-frame.svg' };
    expect(thumbnailImage(product, all)).toEqual({
      src: 'https://cofresso.com/assets/products/x/x-front-deadbeef.webp',
      alt: 'x front',
    });
    expect(thumbnailImage(product, [image('lifestyle', 2)])).toEqual({
      src: 'https://cofresso.com/assets/products/x/x-lifestyle-deadbeef.webp',
      alt: 'x lifestyle',
    });
    expect(thumbnailImage(product, [])).toEqual({
      src: '/products/morning-frame.svg',
      alt: 'Morning Frame',
    });
  });
});
