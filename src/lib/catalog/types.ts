import type { Collection, Product, ProductVariant, Review } from '@/lib/db/schema';

export interface ProductRating {
  average: number;
  count: number;
}

export interface ProductCardData {
  product: Product;
  variants: ProductVariant[];
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
