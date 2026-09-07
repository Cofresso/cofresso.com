# Product imagery: design

Date: 2026-09-06
Status: approved

## Purpose

Give Cofresso real photography: four images per product with a carousel on product pages, hero images for
collections, the homepage and brew guides. Images are generated once with the OpenAI Images API, stored in a
Cloud Storage bucket, and served through the existing global load balancer with Cloud CDN under
`https://cofresso.com/assets/...`.

## Decisions

| Decision     | Choice                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Look         | Editorial studio photography: bags and gear on cream/linen backdrops, soft daylight, brand palette (espresso, latte, cream, copper); a few lifestyle scenes    |
| Storage      | GCS bucket `cofresso-prod-assets`, uniform bucket-level access, public object read, served as a CDN-backed backend bucket on the existing LB under `/assets/*` |
| Per product  | 4 images: `front` (bag on backdrop), `detail` (beans/product close-up), `lifestyle` (brewing scene), `packaging` (bag held in hand)                            |
| Other images | 4 collection heroes, homepage hero + story image, 4 brew-guide covers                                                                                          |
| Format       | WebP, longest edge 1600 px, quality 80; object names are content-addressed (`<slug>-<kind>-<sha8>.webp`) so CDN caching is immutable                           |
| Generation   | One-off `scripts/generate-images.ts` outside the app runtime; parallelism 6; idempotent by manifest entry; writes `content/images.manifest.json`               |
| Data model   | `product_images` table seeded from the manifest; `collections.hero_image_url`; homepage/guide images as typed content                                          |
| Fallback     | Existing SVG art (`products.image_path`) when a product has no images                                                                                          |

## Infrastructure

- `google_storage_bucket.assets` (`cofresso-prod-assets`, `us-central1`, uniform access, `public_access_prevention = "inherited"`, versioning off, CORS GET for any origin).
- `google_storage_bucket_iam_member` `allUsers` → `roles/storage.objectViewer` (required for a backend bucket).
- `google_compute_backend_bucket.assets` with `enable_cdn = true`, `cache_mode = "CACHE_ALL_STATIC"`, default TTL 1 day, max TTL 1 year (objects are content-addressed).
- `google_compute_url_map.https` gains a `host_rule` for `cofresso.com`/`www.cofresso.com` and a `path_matcher` routing `/assets/*` to the backend bucket, everything else to the Cloud Run backend.
- Uploader identity: the generation script runs locally as the developer (`gcloud auth print-access-token`), so no new service account. The applier role set already includes what Terraform needs for buckets? No: add `roles/storage.admin` on this bucket to `terraform-applier` via `google_storage_bucket_iam_member` (the applier's project roles do not include storage). Local applies run as the owner.
- Output `assets_base_url = "https://cofresso.com/assets"`.

## Generation script

`scripts/generate-images.ts` (run with `tsx`, env from `.superpowers/sdd/images/.env` or `OPENAI_API_KEY` in the shell; never committed):

- Inputs: `seedProducts`, `seedCollections`, `brewGuides`, a style guide constant.
- Model: `gpt-image-2` if listed by `GET /v1/models`, else `gpt-image-1`. Size `1536x1024` for lifestyle/hero (3:2), `1024x1024` for front/detail/packaging. Quality `high`.
- Prompt = style guide + subject-specific paragraph (product name, origin, tasting notes, bag label colour from `art.accent`, kind-specific composition). No text rendering requested except the word "Cofresso" on the bag label.
- Pipeline per image: generate (base64) → `sharp` resize to 1600 px longest edge → WebP q80 → sha256 of bytes → upload to `gs://cofresso-prod-assets/products/<slug>/<slug>-<kind>-<sha8>.webp` with `Cache-Control: public, max-age=31536000, immutable` (via `@google-cloud/storage`, ADC from `GOOGLE_OAUTH_ACCESS_TOKEN` or gcloud) → record `{ url, alt, kind, width, height, sha }` in the manifest.
- Concurrency 6; retries 3 with backoff on 429/5xx; `--only <slug|collections|home|guides>` and `--dry-run` flags; skips entries already present in the manifest unless `--force`.
- Alt text is generated deterministically from product data (not by the model).

## Data model

- `product_images`: id uuid, product_id fk cascade, url text, alt text, kind enum (`front`,`detail`,`lifestyle`,`packaging`), width int, height int, position int; unique (product_id, kind). Migration `0002_product_images`.
- `collections.hero_image_url text` nullable; `collections.hero_image_alt text` nullable.
- Seed: `runSeed` reads `content/images.manifest.json` (imported as JSON) and upserts `product_images` by (product_id, kind) and collection heroes. Missing manifest entries leave rows absent (fallback SVG).
- Queries: `ProductCardData` gains `images: ProductImage[]` (position order); `getProductBySlug` includes them; `listCollections`/`getCollectionBySlug` return hero fields.

## UI

- `ProductGallery` (client): main image (`next/image`, `sizes`), thumbnail strip, ArrowLeft/Right, swipe (pointer events), `aria-roledescription="carousel"`, `data-testid` `gallery`, `gallery-main`, `gallery-thumb-<n>`, `gallery-next`, `gallery-prev`. Falls back to the SVG when `images` is empty.
- `ProductCard`: front image; lifestyle image on hover (CSS opacity swap, no JS).
- Collection page: hero banner with `hero_image_url` when present.
- Home: hero uses the generated hero image instead of the SVG collage; story uses the story image; `BrewGuidesTeaser` and guide pages show covers.
- `next.config.ts` `images.remotePatterns` allows `https://cofresso.com/assets/**`; `images.formats` webp/avif.

## Testing

- Unit: manifest schema validation (Zod), alt-text builder, gallery index math; component test for `ProductGallery` (thumbnail click changes main `src`, arrow keys wrap).
- Integration: seed upserts `product_images` from a fixture manifest; `getProductBySlug` returns images in position order.
- E2E: PDP gallery shows 4 thumbnails, clicking the second changes the main image `src`, keyboard right arrow advances; collection hero renders; images return 200 from `/assets/`.
- Playwright and CI hit the real CDN URLs (public, no auth).

## Out of scope

Image editing UI, per-variant images, responsive art direction beyond `sizes`, a private/upload API.
