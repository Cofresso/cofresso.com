import { z } from 'zod';
import { IMAGE_KINDS, type ImageKind } from '@/lib/db/schema/values';

/** Public base URL of the CDN-backed assets bucket (see infra/loadbalancer.tf). */
export const ASSETS_BASE_URL = 'https://cofresso.com/assets';

const imageEntrySchema = z.object({
  url: z.string().url().startsWith(`${ASSETS_BASE_URL}/`),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha: z.string().regex(/^[0-9a-f]{64}$/),
});

const productImageEntrySchema = imageEntrySchema.extend({
  kind: z.enum(IMAGE_KINDS),
});

export const imagesManifestSchema = z.object({
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  products: z.record(z.string(), z.array(productImageEntrySchema)).default({}),
  collections: z.record(z.string(), imageEntrySchema).default({}),
  home: z
    .object({ hero: imageEntrySchema.optional(), story: imageEntrySchema.optional() })
    .default({}),
  guides: z.record(z.string(), imageEntrySchema).default({}),
});

export type ManifestImage = z.infer<typeof imageEntrySchema>;
export type ManifestProductImage = z.infer<typeof productImageEntrySchema>;
export type ImagesManifest = z.infer<typeof imagesManifestSchema>;

/** A repository with no generated imagery yet. Every consumer falls back to SVG art. */
export const EMPTY_MANIFEST: ImagesManifest = {
  generatedAt: '1970-01-01T00:00:00.000Z',
  model: 'none',
  products: {},
  collections: {},
  home: {},
  guides: {},
};

/** Parse untrusted JSON. Nullish input is "no imagery yet"; malformed input throws. */
export function parseManifest(value: unknown): ImagesManifest {
  if (value === null || value === undefined) return EMPTY_MANIFEST;
  return imagesManifestSchema.parse(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/**
 * Stable on-disk form: keys sorted so regenerating one product produces a
 * one-line diff instead of a reshuffled file. Matches Prettier's JSON output.
 */
export function serializeManifest(manifest: ImagesManifest): string {
  return `${JSON.stringify(sortKeys(manifest), null, 2)}\n`;
}

const KIND_ORDER = new Map<ImageKind, number>(IMAGE_KINDS.map((k, i) => [k, i]));

/** Gallery display order: front, detail, lifestyle, packaging. */
export function sortProductImages(images: readonly ManifestProductImage[]): ManifestProductImage[] {
  return [...images].sort((a, b) => (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0));
}
