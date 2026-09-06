import type { Db } from '@/lib/db/client';

export interface SeedSummary {
  collections: number;
  products: number;
  variants: number;
  reviews: number;
  discountCodes: number;
}

export async function runSeed(_db: Db): Promise<SeedSummary> {
  return { collections: 0, products: 0, variants: 0, reviews: 0, discountCodes: 0 };
}
