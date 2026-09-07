// The single place the generated manifest is imported. Next inlines the JSON at
// build time and esbuild inlines it into dist/db.mjs, so no runtime file read
// is needed and the Docker image needs no extra COPY.
import manifestJson from '../../../content/images.manifest.json';
import {
  parseManifest,
  sortProductImages,
  type ImagesManifest,
  type ManifestImage,
  type ManifestProductImage,
} from './manifest';
import type { HomeImageName } from './paths';

let cached: ImagesManifest | undefined;

/** Validated view of `content/images.manifest.json`. Throws if the file is malformed. */
export function contentImages(): ImagesManifest {
  cached ??= parseManifest(manifestJson);
  return cached;
}

export function homeImage(name: HomeImageName): ManifestImage | null {
  return contentImages().home[name] ?? null;
}

export function guideImage(slug: string): ManifestImage | null {
  return contentImages().guides[slug] ?? null;
}

export function collectionImage(slug: string): ManifestImage | null {
  return contentImages().collections[slug] ?? null;
}

export function productImagesFor(slug: string): ManifestProductImage[] {
  return sortProductImages(contentImages().products[slug] ?? []);
}
