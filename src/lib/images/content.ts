// The single place the generated manifest is imported. Next inlines the JSON at
// build time and esbuild inlines it into dist/db.mjs, so no runtime file read
// is needed and the Docker image needs no extra COPY.
import manifestJson from '../../../content/images.manifest.json';
import { parseManifest, type ImagesManifest } from './manifest';

let cached: ImagesManifest | undefined;

/** Validated view of `content/images.manifest.json`. Throws if the file is malformed. */
export function contentImages(): ImagesManifest {
  cached ??= parseManifest(manifestJson);
  return cached;
}
