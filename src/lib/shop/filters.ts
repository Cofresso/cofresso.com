import { z } from 'zod';
import {
  PRODUCT_CATEGORIES,
  ROAST_LEVELS,
  type ProductCategory,
  type RoastLevel,
} from '@/lib/db/schema/values';

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
] as const;

export type ProductSort = (typeof SORT_OPTIONS)[number]['value'];

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  collection: z.preprocess(
    first,
    z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  ),
  roast: z.preprocess(first, z.enum(ROAST_LEVELS).optional()),
  origin: z.preprocess(first, z.string().trim().min(1).max(60).optional()),
  category: z.preprocess(first, z.enum(PRODUCT_CATEGORIES).optional()),
  sort: z.preprocess(
    first,
    z.enum(SORT_OPTIONS.map((o) => o.value) as [ProductSort, ...ProductSort[]]).optional(),
  ),
});

export type ProductFilters = {
  collection?: string;
  roast?: RoastLevel;
  origin?: string;
  category?: ProductCategory;
  sort: ProductSort;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseProductFilters(searchParams: RawSearchParams): ProductFilters {
  const out: ProductFilters = { sort: 'featured' };
  for (const [key, field] of Object.entries(schema.shape)) {
    const result = field.safeParse(searchParams[key]);
    if (result.success && result.data !== undefined) {
      (out as Record<string, unknown>)[key] = result.data;
    }
  }
  return out;
}

export function filtersToSearchParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.collection) params.set('collection', filters.collection);
  if (filters.roast) params.set('roast', filters.roast);
  if (filters.origin) params.set('origin', filters.origin);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  return params;
}
