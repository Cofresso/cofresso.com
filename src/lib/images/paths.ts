import type { ImageKind } from '@/lib/db/schema/values';
import { ASSETS_BASE_URL } from './manifest';

export type HomeImageName = 'hero' | 'story';

/** One year, immutable: object names carry a content hash, so they never change meaning. */
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const IMAGE_CONTENT_TYPE = 'image/webp';

/**
 * The load balancer's backend bucket forwards the full request path to Cloud
 * Storage, so a public URL under `${ASSETS_BASE_URL}/products/...` resolves to
 * the object `assets/products/...` inside the bucket, not `products/...`.
 */
export const BUCKET_PREFIX = 'assets';

export function sha8(sha: string): string {
  return sha.slice(0, 8);
}

export function assetUrl(objectPath: string): string {
  return `${ASSETS_BASE_URL}/${objectPath}`;
}

/** Prefixes a public-facing object path with the bucket prefix the load balancer expects. */
export function bucketObjectName(objectPath: string): string {
  return `${BUCKET_PREFIX}/${objectPath}`;
}

export function productObjectPath(slug: string, kind: ImageKind, hash: string): string {
  return `products/${slug}/${slug}-${kind}-${hash}.webp`;
}

export function collectionObjectPath(slug: string, hash: string): string {
  return `collections/${slug}-${hash}.webp`;
}

export function homeObjectPath(name: HomeImageName, hash: string): string {
  return `home/${name}-${hash}.webp`;
}

export function guideObjectPath(slug: string, hash: string): string {
  return `guides/${slug}-${hash}.webp`;
}
