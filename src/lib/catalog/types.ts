import type {
  Collection,
  ImageKind,
  Product,
  ProductImage,
  ProductVariant,
  Review,
} from '@/lib/db/schema';

export interface ProductRating {
  average: number;
  count: number;
}

export interface ProductCardData {
  product: Product;
  variants: ProductVariant[];
  /** Generated photography in gallery order. Empty means "fall back to product.imagePath". */
  images: ProductImage[];
  rating: ProductRating;
}

export interface ProductDetailData extends ProductCardData {
  collections: Collection[];
  reviews: Review[];
}

export function lowestPriceCents(variants: ProductVariant[]): number {
  return variants.reduce((min, v) => Math.min(min, v.priceCents), variants[0]?.priceCents ?? 0);
}

export function defaultVariant(variants: ProductVariant[]): ProductVariant | undefined {
  return (
    [...variants].sort((a, b) => a.position - b.position).find((v) => v.stockQuantity > 0) ??
    variants[0]
  );
}

export function imageOfKind(
  images: readonly ProductImage[],
  kind: ImageKind,
): ProductImage | undefined {
  return images.find((i) => i.kind === kind);
}

/** The card and PDP lead image. */
export function primaryImage(images: readonly ProductImage[]): ProductImage | undefined {
  return imageOfKind(images, 'front') ?? [...images].sort((a, b) => a.position - b.position)[0];
}

/** The card's hover swap: a scene if we have one, otherwise a close-up. */
export function hoverImage(images: readonly ProductImage[]): ProductImage | undefined {
  return imageOfKind(images, 'lifestyle') ?? imageOfKind(images, 'detail');
}

/** A renderable image: the `src` is a CDN URL for generated photography or a local SVG path. */
export interface ThumbnailImage {
  src: string;
  alt: string;
}

/**
 * The image every non-gallery surface (cart lines, checkout summary, order history)
 * shows for a product: the same lead photograph the card and PDP use, falling back to
 * the product's SVG art when the manifest has nothing for it.
 */
export function thumbnailImage(
  product: Pick<Product, 'name' | 'imagePath'>,
  images: readonly ProductImage[],
): ThumbnailImage {
  const lead = primaryImage(images);
  return lead ? { src: lead.url, alt: lead.alt } : { src: product.imagePath, alt: product.name };
}
