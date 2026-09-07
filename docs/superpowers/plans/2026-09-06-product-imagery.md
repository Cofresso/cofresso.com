# Product Imagery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Cofresso real photography — four generated images per product with a carousel on the product page, plus hero images for collections, the homepage and the brew guides — generated once with the OpenAI Images API, stored in a public GCS bucket, and served through the existing global load balancer with Cloud CDN at `https://cofresso.com/assets/...`.

**Architecture:** A one-off Node script (`scripts/generate-images.ts`) reads the existing seed data and brew-guide content, builds deterministic prompts, calls `POST /v1/images/generations`, pipes the bytes through `sharp` to WebP, content-addresses the object name with a sha256 prefix, uploads to `gs://cofresso-prod-assets/...`, and writes `content/images.manifest.json`. Terraform adds the bucket plus a CDN-backed backend bucket and a `/assets/*` path rule on the existing URL map. The app never calls OpenAI: the seed imports the manifest to fill a new `product_images` table and `collections.hero_image_url`, and the homepage/guide images are read from the manifest as typed content. All orchestration logic lives in pure, unit-tested modules under `src/lib/images`; the script is a thin adapter that injects the real OpenAI, sharp and Storage clients.

**Tech Stack:** Terraform (google provider ~> 7.0), Next.js 16 / React 19, TypeScript strict, Drizzle ORM + Postgres, Zod 4, `openai`, `@google-cloud/storage`, `google-auth-library`, `sharp`, `tsx`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-product-imagery-design.md`

## Global Constraints

Verbatim values from the spec. Do not paraphrase these into different numbers.

- **Look:** Editorial studio photography: bags and gear on cream/linen backdrops, soft daylight, brand palette (espresso `#4A2C24`, latte `#A08977`, cream `#F6F1EB`, copper `#C8763A`); a few lifestyle scenes.
- **Storage:** GCS bucket `cofresso-prod-assets`, uniform bucket-level access, `public_access_prevention = "inherited"`, versioning off, CORS GET for any origin, public object read (`allUsers` → `roles/storage.objectViewer`), served as a CDN-backed backend bucket on the existing LB under `/assets/*`.
- **CDN:** `enable_cdn = true`, `cache_mode = "CACHE_ALL_STATIC"`, default TTL 86400 (1 day), max TTL 31536000 (1 year), client TTL 86400.
- **Per product:** 4 images — `front` (bag on backdrop), `detail` (beans/product close-up), `lifestyle` (brewing scene), `packaging` (bag held in hand).
- **Other images:** 4 collection heroes, homepage hero + story image, 4 brew-guide covers. Total 18 products × 4 + 4 + 2 + 4 = **82 images**.
- **Format:** WebP, longest edge 1600 px, quality 80. Object names are content-addressed so CDN caching is immutable: `products/<slug>/<slug>-<kind>-<sha8>.webp`, `collections/<slug>-<sha8>.webp`, `home/<name>-<sha8>.webp`, `guides/<slug>-<sha8>.webp`.
- **Object metadata:** `Cache-Control: public, max-age=31536000, immutable`. Public URL: `https://cofresso.com/assets/<path>`.
- **Generation:** one-off `scripts/generate-images.ts` outside the app runtime; parallelism 6; retries 3 with backoff on 429/5xx; idempotent by manifest entry (skip unless `--force`); flags `--only <slug|collections|home|guides>`, `--dry-run`, `--force`; writes `content/images.manifest.json`.
- **Model:** `gpt-image-2` if listed by `GET /v1/models`, else `gpt-image-1`. Size `1536x1024` for lifestyle/hero (3:2), `1024x1024` for front/detail/packaging. `quality: 'high'`. gpt-image models return base64 in `data[0].b64_json` (no `response_format`).
- **Prompt** = style guide + subject-specific paragraph (product name, origin, tasting notes, bag label colour from `art.accent`, kind-specific composition). No text rendering requested except the word "Cofresso" on the bag label.
- **Alt text** is generated deterministically from product data, never by the model.
- **Data model:** `product_images` (id uuid, product_id fk cascade, url text, alt text, kind enum `front`/`detail`/`lifestyle`/`packaging`, width int, height int, position int; unique `(product_id, kind)`), migration `0002_product_images`; `collections.hero_image_url text` nullable; `collections.hero_image_alt text` nullable.
- **Fallback:** existing SVG art (`products.image_path`) when a product has no images.
- **Secrets:** `OPENAI_API_KEY` comes from the environment or `.superpowers/sdd/images/.env` (git-ignored). Never printed, never committed, never added to `src/lib/env.ts` (it is not runtime server env).
- **Out of scope:** image editing UI, per-variant images, responsive art direction beyond `sizes`, a private/upload API.

Repo rules that still apply (`AGENTS.md`): reads go through query modules; client components never import `src/lib/db/client`; pure logic stays pure and unit tested; schema changes ship with a generated migration in the same commit; tests accompany changes; Conventional Commits; verify with `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`, plus `pnpm build && pnpm test:e2e` for UI changes.

## Delivery order

Three landings, in this order:

1. **PR 1 — infra (Task 1).** Merge and let `.github/workflows/infra.yml` apply it. Nothing else can work until `/assets/*` serves objects.
2. **The generation run (Tasks 2 and 3).** Tasks 2 and 3 land the pure modules and the script; the final step of Task 3 is the actual paid run, executed by a human or an agent that holds `OPENAI_API_KEY` and can write to the bucket. It commits `content/images.manifest.json`.
3. **PR 2 — app (Tasks 4–8).** Schema, seed, queries, UI, e2e, docs. These tasks are written so they can be implemented against an **empty** manifest (every consumer falls back to the SVG art), so they are not blocked if the run in step 2 slips — only the new e2e assertions are skipped when the manifest is empty.

---

## File structure

```
infra/loadbalancer.tf                     MODIFY  bucket, backend bucket, url map path matcher
infra/iam.tf                              MODIFY  applier roles/storage.admin on the assets bucket
infra/outputs.tf                          MODIFY  assets_base_url
infra/README.md                           MODIFY  mention the assets bucket

content/images.manifest.json              NEW     generated manifest (committed)

src/lib/images/manifest.ts                NEW     Zod schema, parse, serialize, ASSETS_BASE_URL
src/lib/images/manifest.test.ts           NEW
src/lib/images/paths.ts                   NEW     object path + public URL builders
src/lib/images/paths.test.ts              NEW
src/lib/images/alt.ts                     NEW     deterministic alt text
src/lib/images/alt.test.ts                NEW
src/lib/images/prompts.ts                 NEW     style guide, prompt + size builders
src/lib/images/prompts.test.ts            NEW
src/lib/images/retry.ts                   NEW     withRetry / isRetryableError
src/lib/images/retry.test.ts              NEW
src/lib/images/concurrency.ts             NEW     mapWithConcurrency
src/lib/images/concurrency.test.ts        NEW
src/lib/images/generate.ts                NEW     job planning + run loop (deps injected)
src/lib/images/generate.test.ts           NEW
src/lib/images/content.ts                 NEW     the single JSON import site
src/lib/images/content.test.ts            NEW
src/lib/images/gallery.ts                 NEW     carousel index math
src/lib/images/gallery.test.ts            NEW

scripts/generate-images.ts                NEW     CLI: OpenAI + sharp + GCS adapters

src/lib/db/schema/values.ts               MODIFY  IMAGE_KINDS / ImageKind
src/lib/db/schema/enums.ts                MODIFY  imageKindEnum
src/lib/db/schema/catalog.ts              MODIFY  productImages, collections hero columns
src/lib/db/schema/relations.ts            MODIFY  products.images / productImages.product
drizzle/0002_product_images.sql           NEW     generated
drizzle/meta/0002_snapshot.json           NEW     generated
drizzle/meta/_journal.json                MODIFY  generated
src/lib/db/seed/index.ts                  MODIFY  seed product_images + collection heroes
src/lib/db/queries/catalog.ts             MODIFY  load images with every product
src/lib/catalog/types.ts                  MODIFY  ProductCardData.images + helpers
src/lib/catalog/types.test.ts             NEW

src/components/product/product-gallery.tsx        NEW     client carousel
src/components/product/product-gallery.test.tsx   NEW
src/components/product/collection-hero.tsx        NEW
src/components/product/product-card.tsx           MODIFY  front + lifestyle hover swap
src/components/marketing/hero.tsx                 MODIFY  generated hero image
src/components/marketing/story.tsx                MODIFY  generated story image
src/components/marketing/brew-guides-teaser.tsx   MODIFY  guide covers
src/app/(shop)/products/[slug]/page.tsx           MODIFY  gallery + OG/JSON-LD images
src/app/(shop)/collections/[slug]/page.tsx        MODIFY  hero banner
src/app/(marketing)/page.tsx                      MODIFY  pass home images
src/app/(marketing)/brew-guides/[slug]/page.tsx   MODIFY  cover banner
next.config.ts                                    MODIFY  remotePatterns + formats

tests/integration/images.test.ts          NEW     seed + query integration
tests/e2e/imagery.spec.ts                 NEW     gallery, collection hero, /assets/ 200
package.json                              MODIFY  images:generate script + devDeps
.env.example                              MODIFY  generation-only variables
README.md AGENTS.md docs/architecture.md  MODIFY  how to regenerate, manifest, CDN path
```

---

### Task 1: Terraform — assets bucket, CDN backend bucket, `/assets/*` path matcher, applier IAM, output

**Files:**

- Modify: `infra/loadbalancer.tf`, `infra/iam.tf`, `infra/outputs.tf`, `infra/README.md`
- Test: none (Terraform; verification is `fmt`/`validate`/`plan` plus a post-apply CDN probe)

**Interfaces:**

- Consumes: `var.project_id` (`cofresso-prod`), `var.region` (`us-central1`), `var.domain` (`cofresso.com`), `google_compute_backend_service.web`, `google_compute_url_map.https`, `google_service_account.applier`.
- Produces:
  - `google_storage_bucket.assets` — name `cofresso-prod-assets` (`"${var.project_id}-assets"`)
  - `google_storage_bucket_iam_member.assets_public` — `allUsers` → `roles/storage.objectViewer`
  - `google_compute_backend_bucket.assets` — `cofresso-assets-backend`, CDN on
  - `google_compute_url_map.https` — gains `host_rule` + `path_matcher "main"` with `path_rule { paths = ["/assets/*"] }`
  - `google_storage_bucket_iam_member.applier_assets` — applier SA → `roles/storage.admin`
  - Terraform output `assets_base_url = "https://cofresso.com/assets"`
  - The contract every later task depends on: `GET https://cofresso.com/assets/<object>` returns the object with its stored `Cache-Control`, and every other path still routes to Cloud Run.

- [ ] **Step 1: Append the bucket, public read and backend bucket to `infra/loadbalancer.tf`**

Add at the end of `infra/loadbalancer.tf`:

```hcl
# ---------------------------------------------------------------------------
# Static assets (generated product photography), served at /assets/* by the
# same load balancer that fronts Cloud Run. Objects are content-addressed
# (<name>-<sha8>.webp) and uploaded with an immutable Cache-Control, so the
# CDN may hold them for a year.
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "assets" {
  name          = "${var.project_id}-assets"
  location      = upper(var.region)
  storage_class = "STANDARD"

  # A backend bucket needs objects readable by allUsers, so object ACLs stay
  # off and access is granted once, at the bucket level, in the IAM member
  # below. "inherited" keeps the (absent) org-level public access prevention.
  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  # Content addressing makes overwrites impossible in practice; versioning
  # would only pay for bytes nobody can reach.
  versioning {
    enabled = false
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  labels = {
    app  = "cofresso"
    role = "assets"
  }
}

resource "google_storage_bucket_iam_member" "assets_public" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "assets" {
  name        = "cofresso-assets-backend"
  description = "Generated product imagery, served at https://${var.domain}/assets/*"
  bucket_name = google_storage_bucket.assets.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 86400
    max_ttl           = 31536000
    client_ttl        = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }
}
```

Notes for the implementer:

- `upper(var.region)` resolves to `US-CENTRAL1`. The provider upper-cases `location` in state anyway; writing it uppercase avoids a confusing no-op diff.
- `client_ttl` must be ≤ `default_ttl` and `default_ttl` ≤ `max_ttl`. `86400 ≤ 86400 ≤ 31536000` satisfies both.
- If the apply is rejected with `constraints/iam.allowedPolicyMemberDomains` (domain-restricted sharing), the `allUsers` binding needs an org-policy exception for this project. Stop and escalate rather than switching the bucket to signed URLs — the spec requires a public backend bucket.

- [ ] **Step 2: Replace the URL map in `infra/loadbalancer.tf` with a host rule and path matcher**

Replace this block:

```hcl
resource "google_compute_url_map" "https" {
  name            = "cofresso-https"
  default_service = google_compute_backend_service.web.id
}
```

with:

```hcl
resource "google_compute_url_map" "https" {
  name = "cofresso-https"

  # Requests that do not match a host rule (health probes by IP, for example)
  # still reach Cloud Run.
  default_service = google_compute_backend_service.web.id

  host_rule {
    hosts        = [var.domain, "www.${var.domain}"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.web.id

    path_rule {
      paths   = ["/assets/*"]
      service = google_compute_backend_bucket.assets.id
    }
  }
}
```

This is an in-place update of the existing URL map (same name, same default service); the forwarding rule, proxy and certificate are untouched.

- [ ] **Step 3: Grant the applier service account admin on the new bucket in `infra/iam.tf`**

The applier's project role set deliberately excludes storage roles, so Terraform cannot manage this bucket without an explicit binding. Add at the end of `infra/iam.tf`, directly after `google_storage_bucket_iam_member.applier_state`:

```hcl
# The applier's project roles deliberately exclude storage, so managing the
# public assets bucket (and its IAM policy) needs one explicit grant. Scoped
# to this bucket: a compromised apply cannot reach the state bucket's siblings.
resource "google_storage_bucket_iam_member" "applier_assets" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.applier.email}"
}
```

- [ ] **Step 4: Add the output in `infra/outputs.tf`**

Append:

```hcl
output "assets_base_url" {
  description = "Public base URL for generated imagery (see scripts/generate-images.ts)"
  value       = "https://${var.domain}/assets"
}
```

- [ ] **Step 5: Document the bucket in `infra/README.md`**

Replace the "What is here" paragraph:

```markdown
Cloud Run (`cofresso-web`, `cofresso-web-preview`, migration jobs), Cloud SQL Postgres 16, Artifact Registry, global HTTPS load balancer with Cloud CDN and a managed certificate, Cloud DNS zone, Workload Identity Federation for GitHub Actions, an uptime check and alert policy.
```

with:

```markdown
Cloud Run (`cofresso-web`, `cofresso-web-preview`, migration jobs), Cloud SQL Postgres 16, Artifact Registry, global HTTPS load balancer with Cloud CDN and a managed certificate, Cloud DNS zone, Workload Identity Federation for GitHub Actions, an uptime check and alert policy.

`cofresso-prod-assets` holds the generated product imagery. It is public-read and fronted by a CDN-backed backend bucket, so the URL map sends `/assets/*` there and everything else to Cloud Run. Objects are content-addressed and uploaded with `Cache-Control: public, max-age=31536000, immutable` by `scripts/generate-images.ts` (see the repository README).
```

- [ ] **Step 6: Format and validate**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery/infra
terraform fmt -recursive
terraform fmt -check -recursive -diff
terraform init -backend=false
terraform validate
```

Expected: `fmt -check` prints nothing and exits 0; `validate` prints `Success! The configuration is valid.`

- [ ] **Step 7: Plan (optional locally, authoritative in CI)**

Only if you hold owner credentials for `cofresso-prod`; otherwise skip and read the plan comment CI posts on the PR.

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery/infra
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
terraform init
terraform plan -lock=false
```

Expected: `Plan: 4 to add, 1 to change, 0 to destroy.` plus `Changes to Outputs: + assets_base_url = "https://cofresso.com/assets"`. The four additions are the bucket, the `allUsers` binding, the backend bucket and the applier binding; the change is `google_compute_url_map.https` gaining `host_rule` and `path_matcher` **in place** (no `-/+ destroy and then create create replacement`). If the URL map shows as a replacement, stop: that would drop traffic. Re-check that `name` is still `cofresso-https`.

- [ ] **Step 8: Commit and open PR 1**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
git add -A
git commit -m "feat(infra): serve generated imagery from a CDN-backed assets bucket at /assets"
```

- [ ] **Step 9: After CI applies on merge, verify the CDN path by hand**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery/infra
terraform output -raw assets_base_url; echo

printf 'cofresso cdn probe\n' > /tmp/cofresso-probe.txt
gcloud storage cp /tmp/cofresso-probe.txt gs://cofresso-prod-assets/probe.txt \
  --cache-control="public, max-age=60" --content-type=text/plain

curl -I https://cofresso.com/assets/probe.txt
curl -sS -o /dev/null -w 'home=%{http_code}\n' https://cofresso.com/
```

Expected: `terraform output` prints `https://cofresso.com/assets`. `curl -I` prints `HTTP/2 200`, `content-type: text/plain`, `cache-control: public, max-age=60`, and a `via: 1.1 google` header (a second request also shows `age:`). `home=200` proves the default route still reaches Cloud Run. A `404` on the probe with a `x-guploader-uploadid` header means the path rule matched but the object is missing; a Next.js 404 page means the path rule did **not** match — re-check `paths = ["/assets/*"]`.

Then clean up:

```bash
gcloud storage rm gs://cofresso-prod-assets/probe.txt
```

Propagation of a new URL map takes a couple of minutes; retry the `curl` for up to five minutes before treating it as a failure.

---

### Task 2: Manifest schema, path builders, alt text and prompt builders (pure, TDD)

**Files:**

- Create: `src/lib/images/manifest.ts`, `src/lib/images/paths.ts`, `src/lib/images/alt.ts`, `src/lib/images/prompts.ts`
- Create: `content/images.manifest.json` (empty but valid — every later task imports it)
- Modify: `src/lib/db/schema/values.ts` (add `IMAGE_KINDS` / `ImageKind`)
- Test: `src/lib/images/manifest.test.ts`, `src/lib/images/paths.test.ts`, `src/lib/images/alt.test.ts`, `src/lib/images/prompts.test.ts`

**Interfaces:**

- Consumes: `zod`; `SeedProduct` / `SeedCollection` shapes from `src/lib/db/seed/data.ts` (structurally, via narrow local interfaces — no import of the data itself); `BrewGuide` from `src/content/brew-guides`.
- Produces:
  - `src/lib/db/schema/values.ts`: `IMAGE_KINDS = ['front','detail','lifestyle','packaging'] as const`; `type ImageKind = (typeof IMAGE_KINDS)[number]`
  - `src/lib/images/manifest.ts`:
    - `ASSETS_BASE_URL = 'https://cofresso.com/assets'`
    - `imagesManifestSchema` (Zod)
    - `type ManifestImage = { url: string; alt: string; width: number; height: number; sha: string }`
    - `type ManifestProductImage = ManifestImage & { kind: ImageKind }`
    - `type ImagesManifest = { generatedAt: string; model: string; products: Record<string, ManifestProductImage[]>; collections: Record<string, ManifestImage>; home: { hero?: ManifestImage; story?: ManifestImage }; guides: Record<string, ManifestImage> }`
    - `EMPTY_MANIFEST: ImagesManifest`
    - `parseManifest(value: unknown): ImagesManifest` (nullish → `EMPTY_MANIFEST`, invalid → throws)
    - `serializeManifest(manifest: ImagesManifest): string` (key-sorted, 2-space, trailing newline)
    - `sortProductImages(images: readonly ManifestProductImage[]): ManifestProductImage[]` (IMAGE_KINDS order)
  - `src/lib/images/paths.ts`: `sha8(sha: string): string`; `assetUrl(objectPath: string): string`; `productObjectPath(slug, kind, sha8)`; `collectionObjectPath(slug, sha8)`; `homeObjectPath(name: HomeImageName, sha8)`; `guideObjectPath(slug, sha8)`; `type HomeImageName = 'hero' | 'story'`; `IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'`; `IMAGE_CONTENT_TYPE = 'image/webp'`
  - `src/lib/images/alt.ts`: `type AltProduct = { name: string; origin?: string | null; tastingNotes: readonly string[]; category: ProductCategory }`; `productAltText(product: AltProduct, kind: ImageKind): string`; `collectionAltText(c: { name: string; description: string }): string`; `homeAltText(name: HomeImageName): string`; `guideAltText(g: { title: string; method: string }): string`
  - `src/lib/images/prompts.ts`: `STYLE_GUIDE: string`; `type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'`; `KIND_SIZES: Record<ImageKind, ImageSize>`; `HERO_SIZE: ImageSize`; `type PromptProduct`; `productPrompt(p: PromptProduct, kind: ImageKind): string`; `collectionPrompt(c: { slug: string; name: string; description: string }): string`; `homePrompt(name: HomeImageName): string`; `guidePrompt(g: { slug: string; title: string; method: string }): string`

- [ ] **Step 1: Add the image kinds to the schema value tuples**

`src/lib/db/schema/values.ts` — append to the constants and the type exports so the tuple has a single home (Task 4 turns it into a `pgEnum`, Task 2 only needs the values):

```ts
export const PRODUCT_CATEGORIES = ['coffee', 'equipment', 'merch'] as const;
export const ROAST_LEVELS = ['light', 'medium', 'medium_dark', 'dark'] as const;
export const GRINDS = ['whole_bean', 'drip', 'espresso', 'french_press', 'pour_over'] as const;
export const PURCHASE_TYPES = ['one_time', 'subscription'] as const;
export const DISCOUNT_KINDS = ['percent', 'fixed', 'free_shipping'] as const;
export const ORDER_STATUSES = ['paid', 'fulfilled', 'cancelled'] as const;
/** Order matters: it is the display order of a product gallery. */
export const IMAGE_KINDS = ['front', 'detail', 'lifestyle', 'packaging'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type RoastLevel = (typeof ROAST_LEVELS)[number];
export type Grind = (typeof GRINDS)[number];
export type PurchaseType = (typeof PURCHASE_TYPES)[number];
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ImageKind = (typeof IMAGE_KINDS)[number];
```

`src/lib/images/*` imports the file directly (`@/lib/db/schema/values`) rather than the `@/lib/db/schema` barrel, so nothing in these modules pulls in Drizzle or the db client. Keep it that way — `scripts/generate-images.ts` imports them.

- [ ] **Step 2: Write the manifest test first**

`src/lib/images/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ASSETS_BASE_URL,
  EMPTY_MANIFEST,
  imagesManifestSchema,
  parseManifest,
  serializeManifest,
  sortProductImages,
  type ImagesManifest,
  type ManifestProductImage,
} from './manifest';

const sha = 'a'.repeat(64);

function entry(overrides: Partial<ManifestProductImage> = {}): ManifestProductImage {
  return {
    kind: 'front',
    url: `${ASSETS_BASE_URL}/products/morning-frame/morning-frame-front-aaaaaaaa.webp`,
    alt: 'A bag of Cofresso Morning Frame',
    width: 1024,
    height: 1024,
    sha,
    ...overrides,
  };
}

const full: ImagesManifest = {
  generatedAt: '2026-09-06T12:00:00.000Z',
  model: 'gpt-image-2',
  products: { 'morning-frame': [entry()] },
  collections: {
    blends: {
      url: `${ASSETS_BASE_URL}/collections/blends-bbbbbbbb.webp`,
      alt: 'Blends collection',
      width: 1536,
      height: 1024,
      sha: 'b'.repeat(64),
    },
  },
  home: {
    hero: {
      url: `${ASSETS_BASE_URL}/home/hero-cccccccc.webp`,
      alt: 'Cofresso bar',
      width: 1536,
      height: 1024,
      sha: 'c'.repeat(64),
    },
  },
  guides: {
    'pour-over': {
      url: `${ASSETS_BASE_URL}/guides/pour-over-dddddddd.webp`,
      alt: 'Pour over',
      width: 1536,
      height: 1024,
      sha: 'd'.repeat(64),
    },
  },
};

describe('imagesManifestSchema', () => {
  it('accepts a fully populated manifest', () => {
    expect(imagesManifestSchema.parse(full)).toEqual(full);
  });

  it('accepts an empty manifest and fills the collections', () => {
    const parsed = imagesManifestSchema.parse({
      generatedAt: '1970-01-01T00:00:00.000Z',
      model: 'none',
    });
    expect(parsed).toEqual(EMPTY_MANIFEST);
  });

  it('rejects urls outside the assets base', () => {
    const bad = { ...full, products: { x: [entry({ url: 'https://evil.example/a.webp' })] } };
    expect(imagesManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown kinds, bad shas and non-positive dimensions', () => {
    expect(
      imagesManifestSchema.safeParse({
        ...full,
        products: { x: [{ ...entry(), kind: 'back' }] },
      }).success,
    ).toBe(false);
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ sha: 'nope' })] } })
        .success,
    ).toBe(false);
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ width: 0 })] } }).success,
    ).toBe(false);
  });

  it('rejects an empty alt string', () => {
    expect(
      imagesManifestSchema.safeParse({ ...full, products: { x: [entry({ alt: '' })] } }).success,
    ).toBe(false);
  });
});

describe('parseManifest', () => {
  it('treats null and undefined as empty', () => {
    expect(parseManifest(null)).toEqual(EMPTY_MANIFEST);
    expect(parseManifest(undefined)).toEqual(EMPTY_MANIFEST);
  });

  it('throws on malformed input', () => {
    expect(() => parseManifest({ generatedAt: 'yesterday', model: 'x' })).toThrow();
  });
});

describe('serializeManifest', () => {
  it('is deterministic, key-sorted and newline-terminated', () => {
    const text = serializeManifest(full);
    expect(text).toBe(serializeManifest(structuredClone(full)));
    expect(text.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual([
      'collections',
      'generatedAt',
      'guides',
      'home',
      'model',
      'products',
    ]);
    expect(parseManifest(JSON.parse(text))).toEqual(full);
  });
});

describe('sortProductImages', () => {
  it('orders by IMAGE_KINDS, not by input order', () => {
    const images = [
      entry({ kind: 'packaging' }),
      entry({ kind: 'detail' }),
      entry({ kind: 'front' }),
      entry({ kind: 'lifestyle' }),
    ];
    expect(sortProductImages(images).map((i) => i.kind)).toEqual([
      'front',
      'detail',
      'lifestyle',
      'packaging',
    ]);
  });
});
```

- [ ] **Step 3: Implement the manifest module**

`src/lib/images/manifest.ts`:

```ts
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
```

Run: `pnpm test:unit src/lib/images/manifest` → PASS (10 assertions across 8 tests).

- [ ] **Step 4: Create the empty manifest file**

`content/images.manifest.json` — exactly this content (key-sorted so `serializeManifest` output diffs cleanly against it):

```json
{
  "collections": {},
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "guides": {},
  "home": {},
  "model": "none",
  "products": {}
}
```

This file must exist from now on: `src/lib/images/content.ts` (Task 4) imports it statically, and both `next build` and the esbuild bundle of `scripts/db.ts` inline it.

- [ ] **Step 5: Path builders — test first**

`src/lib/images/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ASSETS_BASE_URL } from './manifest';
import {
  assetUrl,
  collectionObjectPath,
  guideObjectPath,
  homeObjectPath,
  IMAGE_CACHE_CONTROL,
  IMAGE_CONTENT_TYPE,
  productObjectPath,
  sha8,
} from './paths';

describe('paths', () => {
  it('takes the first eight hex characters of a sha', () => {
    expect(sha8('0123456789abcdef'.repeat(4))).toBe('01234567');
  });

  it('builds content-addressed object paths', () => {
    expect(productObjectPath('morning-frame', 'front', 'deadbeef')).toBe(
      'products/morning-frame/morning-frame-front-deadbeef.webp',
    );
    expect(collectionObjectPath('blends', 'deadbeef')).toBe('collections/blends-deadbeef.webp');
    expect(homeObjectPath('story', 'deadbeef')).toBe('home/story-deadbeef.webp');
    expect(guideObjectPath('pour-over', 'deadbeef')).toBe('guides/pour-over-deadbeef.webp');
  });

  it('builds public URLs under the assets base', () => {
    expect(assetUrl('home/hero-deadbeef.webp')).toBe(`${ASSETS_BASE_URL}/home/hero-deadbeef.webp`);
  });

  it('pins the immutable cache header and content type', () => {
    expect(IMAGE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
    expect(IMAGE_CONTENT_TYPE).toBe('image/webp');
  });
});
```

- [ ] **Step 6: Implement the path builders**

`src/lib/images/paths.ts`:

```ts
import type { ImageKind } from '@/lib/db/schema/values';
import { ASSETS_BASE_URL } from './manifest';

export type HomeImageName = 'hero' | 'story';

/** One year, immutable: object names carry a content hash, so they never change meaning. */
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const IMAGE_CONTENT_TYPE = 'image/webp';

export function sha8(sha: string): string {
  return sha.slice(0, 8);
}

export function assetUrl(objectPath: string): string {
  return `${ASSETS_BASE_URL}/${objectPath}`;
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
```

Run: `pnpm test:unit src/lib/images/paths` → PASS.

- [ ] **Step 7: Alt text — test first**

`src/lib/images/alt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import {
  collectionAltText,
  guideAltText,
  homeAltText,
  productAltText,
  type AltProduct,
} from './alt';

const coffee: AltProduct = {
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
  category: 'coffee',
};

const gear: AltProduct = {
  name: 'Gooseneck Kettle',
  origin: null,
  tastingNotes: [],
  category: 'equipment',
};

describe('productAltText', () => {
  it('describes each kind of coffee shot', () => {
    expect(productAltText(coffee, 'front')).toBe(
      'A bag of Cofresso Ethiopia Yirgacheffe coffee from Ethiopia on a cream linen backdrop',
    );
    expect(productAltText(coffee, 'detail')).toBe(
      'Close-up of roasted Ethiopia Yirgacheffe coffee beans, which taste of jasmine and bergamot',
    );
    expect(productAltText(coffee, 'lifestyle')).toBe(
      'A pour-over brewing scene with a bag of Cofresso Ethiopia Yirgacheffe on a sunlit kitchen counter',
    );
    expect(productAltText(coffee, 'packaging')).toBe(
      'Hands holding a bag of Cofresso Ethiopia Yirgacheffe with the label facing the camera',
    );
  });

  it('describes equipment without coffee language', () => {
    expect(productAltText(gear, 'front')).toBe(
      'A Cofresso Gooseneck Kettle on a cream linen backdrop',
    );
    expect(productAltText(gear, 'detail')).toBe('Close-up detail of a Cofresso Gooseneck Kettle');
    expect(productAltText(gear, 'lifestyle')).toBe(
      'A Cofresso Gooseneck Kettle in use on a sunlit kitchen counter',
    );
    expect(productAltText(gear, 'packaging')).toBe('Hands holding a Cofresso Gooseneck Kettle');
  });

  it('omits the origin and tasting notes when absent', () => {
    const plain: AltProduct = { name: 'House Blend', tastingNotes: [], category: 'coffee' };
    expect(productAltText(plain, 'front')).toBe(
      'A bag of Cofresso House Blend coffee on a cream linen backdrop',
    );
    expect(productAltText(plain, 'detail')).toBe('Close-up of roasted House Blend coffee beans');
  });

  it('produces screen-reader friendly strings for every kind', () => {
    for (const product of [coffee, gear]) {
      for (const kind of IMAGE_KINDS) {
        const alt = productAltText(product, kind);
        expect(alt.length).toBeGreaterThan(10);
        expect(alt.length).toBeLessThanOrEqual(160);
        expect(alt.endsWith('.')).toBe(false);
        expect(alt.startsWith(alt.trim())).toBe(true);
      }
    }
  });
});

describe('other alt text', () => {
  it('describes collections, home images and guides', () => {
    expect(collectionAltText({ name: 'Blends', description: 'Balanced profiles.' })).toBe(
      'Cofresso Blends collection: balanced profiles',
    );
    expect(homeAltText('hero')).toBe(
      'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop',
    );
    expect(homeAltText('story')).toBe(
      'A Cofresso roaster weighing green coffee beside a sample roaster',
    );
    expect(guideAltText({ title: 'French Press', method: 'Immersion' })).toBe(
      'Brewing coffee with the French Press method',
    );
  });
});
```

- [ ] **Step 8: Implement the alt-text builder**

`src/lib/images/alt.ts`:

```ts
import type { ImageKind, ProductCategory } from '@/lib/db/schema/values';
import type { HomeImageName } from './paths';

/**
 * The narrowest shape needed to describe a product, so both seed data
 * (`SeedProduct`) and database rows (`Product`) satisfy it.
 */
export interface AltProduct {
  name: string;
  origin?: string | null;
  tastingNotes: readonly string[];
  category: ProductCategory;
}

/** Trailing punctuation is dropped: screen readers pause on the element boundary anyway. */
function trim(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
}

function firstNotes(notes: readonly string[]): string | null {
  const picked = notes.slice(0, 2);
  if (picked.length === 0) return null;
  return picked.join(' and ');
}

export function productAltText(product: AltProduct, kind: ImageKind): string {
  const { name, category } = product;
  if (category === 'coffee') {
    const origin = product.origin ? ` from ${product.origin}` : '';
    const notes = firstNotes(product.tastingNotes);
    switch (kind) {
      case 'front':
        return trim(`A bag of Cofresso ${name} coffee${origin} on a cream linen backdrop`);
      case 'detail':
        return trim(
          `Close-up of roasted ${name} coffee beans${notes ? `, which taste of ${notes}` : ''}`,
        );
      case 'lifestyle':
        return trim(
          `A pour-over brewing scene with a bag of Cofresso ${name} on a sunlit kitchen counter`,
        );
      case 'packaging':
        return trim(`Hands holding a bag of Cofresso ${name} with the label facing the camera`);
    }
  }
  switch (kind) {
    case 'front':
      return trim(`A Cofresso ${name} on a cream linen backdrop`);
    case 'detail':
      return trim(`Close-up detail of a Cofresso ${name}`);
    case 'lifestyle':
      return trim(`A Cofresso ${name} in use on a sunlit kitchen counter`);
    case 'packaging':
      return trim(`Hands holding a Cofresso ${name}`);
  }
}

export function collectionAltText(collection: { name: string; description: string }): string {
  const summary = collection.description.split('.')[0]?.trim() ?? '';
  const lowered = summary ? summary.charAt(0).toLowerCase() + summary.slice(1) : '';
  return trim(`Cofresso ${collection.name} collection${lowered ? `: ${lowered}` : ''}`);
}

export function homeAltText(name: HomeImageName): string {
  return name === 'hero'
    ? 'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop'
    : 'A Cofresso roaster weighing green coffee beside a sample roaster';
}

export function guideAltText(guide: { title: string; method: string }): string {
  return trim(`Brewing coffee with the ${guide.title} method`);
}
```

`guideAltText` takes `method` in its parameter type even though the body uses `title`: callers pass the whole guide, and the parameter documents what is safe to rely on. Keep it — the test pins the output.

Run: `pnpm test:unit src/lib/images/alt` → PASS.

- [ ] **Step 9: Prompt builders — test first**

`src/lib/images/prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import {
  collectionPrompt,
  guidePrompt,
  HERO_SIZE,
  homePrompt,
  KIND_SIZES,
  productPrompt,
  STYLE_GUIDE,
  type PromptProduct,
} from './prompts';

const coffee: PromptProduct = {
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  region: 'Yirgacheffe',
  tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
  category: 'coffee',
  roastLevel: 'light',
  art: { shape: 'bag', accent: '#D9A441' },
};

const gear: PromptProduct = {
  name: 'Gooseneck Kettle',
  tastingNotes: [],
  category: 'equipment',
  art: { shape: 'kettle', accent: '#33201A' },
};

describe('KIND_SIZES', () => {
  it('uses 3:2 for lifestyle and square for the rest', () => {
    expect(KIND_SIZES).toEqual({
      front: '1024x1024',
      detail: '1024x1024',
      lifestyle: '1536x1024',
      packaging: '1024x1024',
    });
    expect(HERO_SIZE).toBe('1536x1024');
  });
});

describe('productPrompt', () => {
  it('always carries the style guide and forbids stray text', () => {
    for (const kind of IMAGE_KINDS) {
      const prompt = productPrompt(coffee, kind);
      expect(prompt.startsWith(STYLE_GUIDE)).toBe(true);
      expect(prompt).toContain('no other text, letters or numbers');
      expect(prompt).toContain('"Cofresso"');
      expect(prompt.length).toBeLessThanOrEqual(4000);
    }
  });

  it('includes the label colour, origin, roast and tasting notes for coffee', () => {
    const prompt = productPrompt(coffee, 'front');
    expect(prompt).toContain('#D9A441');
    expect(prompt).toContain('Ethiopia');
    expect(prompt).toContain('light roast');
    expect(prompt).toContain('jasmine, bergamot, lemon drop');
  });

  it('describes equipment by its art shape instead of a bag', () => {
    const prompt = productPrompt(gear, 'front');
    expect(prompt).toContain('gooseneck pour-over kettle');
    expect(prompt).not.toContain('roast');
    expect(prompt).not.toContain('tastes of');
  });

  it('varies the composition per kind', () => {
    const prompts = IMAGE_KINDS.map((k) => productPrompt(coffee, k));
    expect(new Set(prompts).size).toBe(IMAGE_KINDS.length);
    expect(productPrompt(coffee, 'lifestyle')).toContain('landscape');
    expect(productPrompt(coffee, 'packaging')).toContain('hands');
  });

  it('is deterministic', () => {
    expect(productPrompt(coffee, 'detail')).toBe(productPrompt({ ...coffee }, 'detail'));
  });
});

describe('collectionPrompt, homePrompt and guidePrompt', () => {
  it('uses a per-slug scene and falls back for unknown slugs', () => {
    const known = collectionPrompt({ slug: 'decaf', name: 'Decaf', description: 'No jitters.' });
    expect(known.startsWith(STYLE_GUIDE)).toBe(true);
    expect(known).toContain('decaf');
    const unknown = collectionPrompt({
      slug: 'limited',
      name: 'Limited',
      description: 'Rare lots.',
    });
    expect(unknown).toContain('Limited');
    expect(unknown).toContain('Rare lots.');
  });

  it('distinguishes the home hero from the story image', () => {
    expect(homePrompt('hero')).not.toBe(homePrompt('story'));
    expect(homePrompt('hero')).toContain('landscape');
    expect(homePrompt('story')).toContain('roastery');
  });

  it('describes each brewing method', () => {
    const prompt = guidePrompt({ slug: 'cold-brew', title: 'Cold Brew', method: 'Cold immersion' });
    expect(prompt).toContain('cold brew');
    expect(guidePrompt({ slug: 'unknown', title: 'Siphon', method: 'Vacuum' })).toContain('Siphon');
  });
});
```

- [ ] **Step 10: Implement the prompt builders**

`src/lib/images/prompts.ts`:

```ts
import { type ImageKind, type ProductCategory, type RoastLevel } from '@/lib/db/schema/values';
import type { HomeImageName } from './paths';

/** Sizes the Images API accepts for gpt-image models. */
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export const KIND_SIZES: Record<ImageKind, ImageSize> = {
  front: '1024x1024',
  detail: '1024x1024',
  lifestyle: '1536x1024',
  packaging: '1024x1024',
};

/** Collection, home and guide images are all 3:2 banners. */
export const HERO_SIZE: ImageSize = '1536x1024';

export const STYLE_GUIDE = [
  'Editorial studio product photography for a specialty coffee roaster called Cofresso.',
  'Cream and linen backdrops, soft directional daylight from the left, gentle falloff, no harsh shadows.',
  'Brand palette: espresso brown #4A2C24, latte #A08977, cream #F6F1EB, copper #C8763A.',
  'Shot on a 50mm lens at f/4, natural depth of field, fine film grain, no vignette.',
  'Clean, uncluttered composition with generous negative space.',
  'Photorealistic: no illustration, no 3D render, no watermark, no logos.',
  'The only lettering allowed in the frame is the word "Cofresso" printed small on a coffee bag label;',
  'no other text, letters or numbers anywhere in the image.',
].join(' ');

export interface PromptProduct {
  name: string;
  origin?: string | null;
  region?: string | null;
  tastingNotes: readonly string[];
  category: ProductCategory;
  roastLevel?: RoastLevel | null;
  art: { shape: string; accent: string };
}

const SHAPE_SUBJECTS: Record<string, string> = {
  bag: 'stand-up coffee bag',
  kettle: 'gooseneck pour-over kettle',
  dripper: 'ceramic cone pour-over dripper',
  grinder: 'hand coffee grinder with a steel burr',
  scale: 'compact digital brew scale',
  filters: 'stack of paper cone coffee filters',
  mug: 'stoneware coffee mug',
};

const COMPOSITIONS: Record<ImageKind, string> = {
  front:
    'Composition: centred, straight-on product shot on a cream linen backdrop, the whole product in frame with a soft shadow beneath it. Square crop.',
  detail:
    'Composition: extreme close-up filling the frame, shallow depth of field, texture and material clearly visible. Square crop.',
  lifestyle:
    'Composition: a wide lifestyle scene on a sunlit kitchen counter with a pour-over in progress, rising steam, a linen cloth and a ceramic cup. The product is visible but off-centre. Three-by-two landscape crop.',
  packaging:
    'Composition: a pair of hands holding the product at chest height against a soft cream wall, the label facing the camera. Square crop.',
};

function productSubject(product: PromptProduct, kind: ImageKind): string {
  const shape = SHAPE_SUBJECTS[product.art.shape] ?? 'piece of coffee brewing equipment';
  if (product.category !== 'coffee') {
    return `Subject: a ${shape} finished in the colour ${product.art.accent} — the Cofresso ${product.name}.`;
  }
  const origin = product.origin ? ` of ${product.origin} coffee` : ' of coffee';
  const roast = product.roastLevel ? ` It is a ${product.roastLevel.replace('_', ' ')} roast.` : '';
  const notes = product.tastingNotes.length
    ? ` The coffee tastes of ${product.tastingNotes.join(', ')}.`
    : '';
  const beans =
    kind === 'detail' ? ' Show loose roasted whole beans spilling from the open bag.' : '';
  return `Subject: a matte ${shape}${origin} named ${product.name}, with a flat label panel in the colour ${product.art.accent} carrying the word "Cofresso".${roast}${notes}${beans}`;
}

export function productPrompt(product: PromptProduct, kind: ImageKind): string {
  return [STYLE_GUIDE, productSubject(product, kind), COMPOSITIONS[kind]].join('\n\n');
}

const COLLECTION_SCENES: Record<string, string> = {
  'single-origin':
    'Subject: a three-by-two landscape flat lay of four matte coffee bags of different label colours arranged on a cream linen cloth with a scattering of whole beans and a hand-written-looking blank tag, evoking one farm, one region, one story.',
  blends:
    'Subject: a three-by-two landscape scene of two matte coffee bags beside a French press and a ceramic cup of black coffee on a warm cream counter, evoking balanced everyday blends.',
  decaf:
    'Subject: a three-by-two landscape scene of a single matte decaf coffee bag on a cream linen cloth in low evening daylight, with a ceramic cup and a sprig of green sugarcane leaf, evoking calm decaf coffee at night.',
  equipment:
    'Subject: a three-by-two landscape flat lay of brewing equipment — a gooseneck kettle, a ceramic dripper, a hand grinder, a brew scale and paper filters — arranged on a cream linen surface.',
};

export function collectionPrompt(collection: {
  slug: string;
  name: string;
  description: string;
}): string {
  const scene =
    COLLECTION_SCENES[collection.slug] ??
    `Subject: a three-by-two landscape scene representing the Cofresso ${collection.name} collection. ${collection.description}`;
  return [
    STYLE_GUIDE,
    scene,
    'Composition: wide banner framing with the subject in the left two thirds and clear negative space on the right for overlaid type. Three-by-two landscape crop.',
  ].join('\n\n');
}

const HOME_SCENES: Record<HomeImageName, string> = {
  hero: 'Subject: a three-by-two landscape hero scene — two matte Cofresso coffee bags standing beside a ceramic pour-over dripper mid-brew, steam catching the light, whole beans scattered on a cream linen surface.',
  story:
    'Subject: a three-by-two landscape scene inside a small roastery: a roaster in an apron weighing green coffee on a brass scale beside a drum sample roaster, warm daylight through a window, hands visible but no faces.',
};

export function homePrompt(name: HomeImageName): string {
  return [
    STYLE_GUIDE,
    HOME_SCENES[name],
    'Composition: wide banner framing with generous negative space for overlaid type. Three-by-two landscape crop.',
  ].join('\n\n');
}

const GUIDE_SCENES: Record<string, string> = {
  'pour-over':
    'Subject: a pour over in progress — a gooseneck kettle pouring a steady spiral into a ceramic cone dripper on a glass carafe, steam rising, a brew scale showing a blank display.',
  'french-press':
    'Subject: a French press on a cream linen cloth with the plunger raised, a thick coffee crust on the surface, a spoon resting beside it.',
  espresso:
    'Subject: an espresso extraction — a dark, syrupy stream falling from a portafilter into a small ceramic cup, crema forming, machine body softly out of focus.',
  'cold-brew':
    'Subject: a cold brew steep — a large glass jar of coarse coffee and cold water on a cream counter, condensation on the glass, a filter cone and a glass of iced coffee beside it.',
};

export function guidePrompt(guide: { slug: string; title: string; method: string }): string {
  const scene =
    GUIDE_SCENES[guide.slug] ??
    `Subject: a brewing scene for the ${guide.title} method (${guide.method}) on a cream counter.`;
  return [
    STYLE_GUIDE,
    scene,
    'Composition: wide banner framing, hands allowed but no faces, generous negative space. Three-by-two landscape crop.',
  ].join('\n\n');
}
```

Run: `pnpm test:unit src/lib/images/prompts` → PASS. If the "cold brew" assertion fails, remember the test lower-cases nothing — `GUIDE_SCENES['cold-brew']` contains the literal words "cold brew".

- [ ] **Step 11: Verify and commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit src/lib/images
git add -A
git commit -m "feat: add image manifest schema, path, alt-text and prompt builders"
```

Expected: 4 test files, all green; `tsc --noEmit` silent.

---

### Task 3: Generation script — retries, concurrency, job planning, OpenAI/sharp/GCS adapters, and the run

**Files:**

- Create: `src/lib/images/retry.ts`, `src/lib/images/concurrency.ts`, `src/lib/images/generate.ts`, `scripts/generate-images.ts`
- Modify: `package.json` (script + devDependencies), `.env.example`
- Test: `src/lib/images/retry.test.ts`, `src/lib/images/concurrency.test.ts`, `src/lib/images/generate.test.ts`

**Interfaces:**

- Consumes: `manifest.ts`, `paths.ts`, `alt.ts`, `prompts.ts` (Task 2); `seedProducts` / `seedCollections` from `@/lib/db/seed/data`; `brewGuides` from `@/content/brew-guides`.
- Produces:
  - `src/lib/images/retry.ts`: `isRetryableError(err: unknown): boolean`; `type RetryOptions = { attempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void>; isRetryable?: (err: unknown) => boolean; onRetry?: (attempt: number, err: unknown) => void }`; `withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`
  - `src/lib/images/concurrency.ts`: `mapWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]>`
  - `src/lib/images/generate.ts`:
    - `type ImageJob = { key: string; scope: 'product'; slug: string; kind: ImageKind; prompt: string; size: ImageSize; alt: string } | { key: string; scope: 'collection' | 'guide'; slug: string; prompt: string; size: ImageSize; alt: string } | { key: string; scope: 'home'; name: HomeImageName; prompt: string; size: ImageSize; alt: string }`
    - `planJobs(only?: string): ImageJob[]`
    - `existingEntry(manifest: ImagesManifest, job: ImageJob): ManifestImage | undefined`
    - `putEntry(manifest: ImagesManifest, job: ImageJob, entry: ManifestImage): ImagesManifest`
    - `objectPathFor(job: ImageJob, hash: string): string`
    - `type ImageDeps = { generate(input: { prompt: string; size: ImageSize; model: string }): Promise<Buffer>; process(input: Buffer): Promise<{ data: Buffer; width: number; height: number }>; upload(input: { objectPath: string; body: Buffer; contentType: string; cacheControl: string }): Promise<void>; log(message: string): void; now(): Date; sleep?(ms: number): Promise<void> }`
    - `type RunOptions = { model: string; only?: string; force?: boolean; dryRun?: boolean; concurrency?: number }`
    - `type RunResult = { manifest: ImagesManifest; generated: number; skipped: number; planned: number; failures: Array<{ key: string; error: string }> }`
    - `DEFAULT_CONCURRENCY = 6`, `RETRY_ATTEMPTS = 3`
    - `runImageJobs(previous: ImagesManifest, deps: ImageDeps, options: RunOptions): Promise<RunResult>`
  - `scripts/generate-images.ts`: CLI. Reads `OPENAI_API_KEY`, `GOOGLE_OAUTH_ACCESS_TOKEN`, `ASSETS_BUCKET`; flags `--only`, `--dry-run`, `--force`, `--concurrency`, `--model`, `--bucket`. Writes `content/images.manifest.json`. Exit code 1 if any job failed.
  - `package.json`: `"images:generate": "tsx scripts/generate-images.ts"`.

- [ ] **Step 1: Install the generation dependencies**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm add -D openai @google-cloud/storage google-auth-library sharp
```

All four are **devDependencies**: nothing in `src/app` or `src/components` may import them, and the Docker image must not carry them. `pnpm-workspace.yaml` already lists `sharp` under `ignoredBuiltDependencies` (it resolves through prebuilt `@img/sharp-<platform>` optional deps), so the install needs no `pnpm approve-builds`.

Then add the script to `package.json`, directly after `"art:generate"`:

```json
    "art:generate": "tsx scripts/generate-product-art.ts",
    "images:generate": "tsx scripts/generate-images.ts",
```

- [ ] **Step 2: Retry helper — test first**

`src/lib/images/retry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { isRetryableError, withRetry } from './retry';

const noSleep = async () => {};

describe('isRetryableError', () => {
  it('retries rate limits, timeouts and server errors', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 408 })).toBe(true);
    expect(isRetryableError({ status: 409 })).toBe(true);
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
    expect(isRetryableError({ statusCode: 504 })).toBe(true);
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('does not retry client errors or unknown shapes', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError(new Error('bad prompt'))).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the first successful value without sleeping', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => 'ok');
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries retryable failures with exponential backoff', async () => {
    const sleep = vi.fn(noSleep);
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('rate limited'), { status: 429 });
      return calls;
    });
    await expect(withRetry(fn, { sleep, baseDelayMs: 100, onRetry })).resolves.toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempt budget and rethrows the last error', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('still down'), { status: 500 });
    });
    await expect(withRetry(fn, { sleep, attempts: 3 })).rejects.toThrow('still down');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('fails immediately on a non-retryable error', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('invalid prompt'), { status: 400 });
    });
    await expect(withRetry(fn, { sleep })).rejects.toThrow('invalid prompt');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Implement the retry helper**

`src/lib/images/retry.ts`:

```ts
const RETRYABLE_STATUSES = new Set([408, 409, 429]);
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE']);

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  for (const candidate of [e.status, e.statusCode, e.response?.status]) {
    if (typeof candidate === 'number') return candidate;
  }
  return undefined;
}

/** Rate limits, request timeouts, lock conflicts, 5xx and transient socket errors. */
export function isRetryableError(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== undefined) return RETRYABLE_STATUSES.has(status) || status >= 500;
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return true;
  }
  return false;
}

export interface RetryOptions {
  /** Total attempts, including the first. Defaults to 3. */
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const sleep = options.sleep ?? defaultSleep;
  const retryable = options.isRetryable ?? isRetryableError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !retryable(err)) break;
      options.onRetry?.(attempt, err);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
```

Run: `pnpm test:unit src/lib/images/retry` → PASS.

- [ ] **Step 4: Concurrency helper — test first**

`src/lib/images/concurrency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  it('preserves input order in the results', async () => {
    const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      await tick();
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
  });

  it('never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      6,
      async (i) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
        return i;
      },
    );
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });

  it('handles an empty list and a limit below one', async () => {
    expect(await mapWithConcurrency([], 6, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n)).toEqual([1, 2]);
  });

  it('passes the index to the worker', async () => {
    expect(await mapWithConcurrency(['a', 'b'], 2, async (v, i) => `${i}${v}`)).toEqual([
      '0a',
      '1b',
    ]);
  });
});
```

- [ ] **Step 5: Implement the concurrency helper**

`src/lib/images/concurrency.ts`:

```ts
/**
 * Run `worker` over `items` with at most `limit` in flight, returning results
 * in input order. The worker is expected to handle its own failures: a
 * rejection here rejects the whole run.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const width = Math.max(1, Math.min(limit || 1, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: width }, run));
  return results;
}
```

Run: `pnpm test:unit src/lib/images/concurrency` → PASS.

- [ ] **Step 6: Job planning and the run loop — test first**

`src/lib/images/generate.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { brewGuides } from '@/content/brew-guides';
import { seedCollections, seedProducts } from '@/lib/db/seed/data';
import { EMPTY_MANIFEST, type ImagesManifest } from './manifest';
import {
  existingEntry,
  objectPathFor,
  planJobs,
  putEntry,
  runImageJobs,
  type ImageDeps,
} from './generate';

const PNG = Buffer.from('fake-png-bytes');
const WEBP = Buffer.from('fake-webp-bytes');
const WEBP_SHA = createHash('sha256').update(WEBP).digest('hex');

function deps(overrides: Partial<ImageDeps> = {}): ImageDeps {
  return {
    generate: vi.fn(async () => PNG),
    process: vi.fn(async () => ({ data: WEBP, width: 1024, height: 1024 })),
    upload: vi.fn(async () => {}),
    log: vi.fn(),
    now: () => new Date('2026-09-06T12:00:00.000Z'),
    sleep: async () => {},
    ...overrides,
  };
}

describe('planJobs', () => {
  it('plans four jobs per product plus collections, home and guides', () => {
    const jobs = planJobs();
    expect(jobs).toHaveLength(
      seedProducts.length * 4 + seedCollections.length + 2 + brewGuides.length,
    );
    expect(jobs).toHaveLength(82);
    expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
    expect(jobs.every((j) => j.prompt.length > 100 && j.alt.length > 10)).toBe(true);
  });

  it('uses 3:2 for lifestyle and every banner, square otherwise', () => {
    const jobs = planJobs();
    const landscape = jobs.filter((j) => j.size === '1536x1024');
    expect(landscape).toHaveLength(
      seedProducts.length + seedCollections.length + 2 + brewGuides.length,
    );
    expect(jobs.filter((j) => j.size === '1024x1024')).toHaveLength(seedProducts.length * 3);
  });

  it('filters with --only', () => {
    expect(planJobs('morning-frame').map((j) => j.key)).toEqual([
      'product:morning-frame:front',
      'product:morning-frame:detail',
      'product:morning-frame:lifestyle',
      'product:morning-frame:packaging',
    ]);
    expect(planJobs('collections')).toHaveLength(seedCollections.length);
    expect(planJobs('home').map((j) => j.key)).toEqual(['home:hero', 'home:story']);
    expect(planJobs('guides')).toHaveLength(brewGuides.length);
    expect(planJobs('nope')).toEqual([]);
  });
});

describe('objectPathFor', () => {
  it('content-addresses every scope', () => {
    const byKey = new Map(planJobs().map((j) => [j.key, j]));
    expect(objectPathFor(byKey.get('product:morning-frame:front')!, 'deadbeef')).toBe(
      'products/morning-frame/morning-frame-front-deadbeef.webp',
    );
    expect(objectPathFor(byKey.get('collection:blends')!, 'deadbeef')).toBe(
      'collections/blends-deadbeef.webp',
    );
    expect(objectPathFor(byKey.get('home:hero')!, 'deadbeef')).toBe('home/hero-deadbeef.webp');
    expect(objectPathFor(byKey.get('guide:pour-over')!, 'deadbeef')).toBe(
      'guides/pour-over-deadbeef.webp',
    );
  });
});

describe('putEntry and existingEntry', () => {
  it('round-trips an entry for every scope without mutating the input', () => {
    const jobs = planJobs().filter((j) =>
      ['product:morning-frame:front', 'collection:blends', 'home:hero', 'guide:pour-over'].includes(
        j.key,
      ),
    );
    let manifest: ImagesManifest = EMPTY_MANIFEST;
    for (const job of jobs) {
      expect(existingEntry(manifest, job)).toBeUndefined();
      manifest = putEntry(manifest, job, {
        url: `https://cofresso.com/assets/${objectPathFor(job, 'deadbeef')}`,
        alt: job.alt,
        width: 1024,
        height: 1024,
        sha: WEBP_SHA,
      });
      expect(existingEntry(manifest, job)?.sha).toBe(WEBP_SHA);
    }
    expect(EMPTY_MANIFEST.products).toEqual({});
    expect(manifest.products['morning-frame']).toHaveLength(1);
  });
});

describe('runImageJobs', () => {
  const options = { model: 'gpt-image-2', only: 'home', concurrency: 2 };

  it('does not touch the network on a dry run', async () => {
    const d = deps();
    const result = await runImageJobs(EMPTY_MANIFEST, d, { ...options, dryRun: true });
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.upload).not.toHaveBeenCalled();
    expect(result.manifest).toEqual(EMPTY_MANIFEST);
    expect(result.planned).toBe(2);
    expect(result.generated).toBe(0);
  });

  it('generates, converts, uploads and records every job', async () => {
    const d = deps();
    const result = await runImageJobs(EMPTY_MANIFEST, d, options);

    expect(d.generate).toHaveBeenCalledTimes(2);
    expect(d.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-2', size: '1536x1024' }),
    );
    expect(d.process).toHaveBeenCalledWith(PNG);
    expect(d.upload).toHaveBeenCalledWith({
      objectPath: `home/hero-${WEBP_SHA.slice(0, 8)}.webp`,
      body: WEBP,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    expect(result.generated).toBe(2);
    expect(result.failures).toEqual([]);
    expect(result.manifest.model).toBe('gpt-image-2');
    expect(result.manifest.generatedAt).toBe('2026-09-06T12:00:00.000Z');
    expect(result.manifest.home.hero).toEqual({
      url: `https://cofresso.com/assets/home/hero-${WEBP_SHA.slice(0, 8)}.webp`,
      alt: 'Freshly roasted Cofresso coffee bags and a pour-over setup on a cream linen backdrop',
      width: 1024,
      height: 1024,
      sha: WEBP_SHA,
    });
  });

  it('skips jobs already in the manifest unless forced', async () => {
    const first = await runImageJobs(EMPTY_MANIFEST, deps(), options);

    const second = deps();
    const skipped = await runImageJobs(first.manifest, second, options);
    expect(second.generate).not.toHaveBeenCalled();
    expect(skipped.skipped).toBe(2);
    expect(skipped.manifest.home.hero).toEqual(first.manifest.home.hero);

    const forced = deps();
    const redone = await runImageJobs(first.manifest, forced, { ...options, force: true });
    expect(forced.generate).toHaveBeenCalledTimes(2);
    expect(redone.generated).toBe(2);
  });

  it('retries 429s and reports permanent failures without losing good entries', async () => {
    let heroCalls = 0;
    const d = deps({
      generate: vi.fn(async ({ prompt }: { prompt: string }) => {
        if (prompt.includes('roastery')) {
          throw Object.assign(new Error('bad request'), { status: 400 });
        }
        heroCalls += 1;
        if (heroCalls < 3) throw Object.assign(new Error('slow down'), { status: 429 });
        return PNG;
      }),
    });

    const result = await runImageJobs(EMPTY_MANIFEST, d, options);
    expect(heroCalls).toBe(3);
    expect(result.generated).toBe(1);
    expect(result.manifest.home.hero).toBeDefined();
    expect(result.manifest.home.story).toBeUndefined();
    expect(result.failures).toEqual([{ key: 'home:story', error: 'bad request' }]);
  });
});
```

- [ ] **Step 7: Implement the run loop**

`src/lib/images/generate.ts`:

```ts
import { createHash } from 'node:crypto';
import { brewGuides } from '@/content/brew-guides';
import type { ImageKind } from '@/lib/db/schema/values';
import { seedCollections, seedProducts } from '@/lib/db/seed/data';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import { collectionAltText, guideAltText, homeAltText, productAltText } from './alt';
import { mapWithConcurrency } from './concurrency';
import {
  parseManifest,
  sortProductImages,
  type ImagesManifest,
  type ManifestImage,
} from './manifest';
import {
  assetUrl,
  collectionObjectPath,
  guideObjectPath,
  homeObjectPath,
  IMAGE_CACHE_CONTROL,
  IMAGE_CONTENT_TYPE,
  productObjectPath,
  sha8,
  type HomeImageName,
} from './paths';
import {
  collectionPrompt,
  guidePrompt,
  HERO_SIZE,
  homePrompt,
  KIND_SIZES,
  productPrompt,
  type ImageSize,
} from './prompts';
import { withRetry } from './retry';

export const DEFAULT_CONCURRENCY = 6;
export const RETRY_ATTEMPTS = 3;

interface JobBase {
  /** Stable identity, used for logging, `--only` filtering and failure reporting. */
  key: string;
  prompt: string;
  size: ImageSize;
  alt: string;
}

export type ImageJob =
  | (JobBase & { scope: 'product'; slug: string; kind: ImageKind })
  | (JobBase & { scope: 'collection'; slug: string })
  | (JobBase & { scope: 'guide'; slug: string })
  | (JobBase & { scope: 'home'; name: HomeImageName });

const HOME_NAMES: HomeImageName[] = ['hero', 'story'];

/**
 * The full work list, in a stable order. `only` accepts a product slug or one
 * of the literals `collections`, `home`, `guides`; anything else plans nothing.
 */
export function planJobs(only?: string): ImageJob[] {
  const jobs: ImageJob[] = [];
  const wantProducts = !only || seedProducts.some((p) => p.slug === only);
  const wantScope = (scope: string) => !only || only === scope;

  if (wantProducts) {
    for (const product of seedProducts) {
      if (only && product.slug !== only) continue;
      for (const kind of IMAGE_KINDS) {
        jobs.push({
          key: `product:${product.slug}:${kind}`,
          scope: 'product',
          slug: product.slug,
          kind,
          prompt: productPrompt(product, kind),
          size: KIND_SIZES[kind],
          alt: productAltText(product, kind),
        });
      }
    }
  }

  if (wantScope('collections')) {
    for (const collection of seedCollections) {
      jobs.push({
        key: `collection:${collection.slug}`,
        scope: 'collection',
        slug: collection.slug,
        prompt: collectionPrompt(collection),
        size: HERO_SIZE,
        alt: collectionAltText(collection),
      });
    }
  }

  if (wantScope('home')) {
    for (const name of HOME_NAMES) {
      jobs.push({
        key: `home:${name}`,
        scope: 'home',
        name,
        prompt: homePrompt(name),
        size: HERO_SIZE,
        alt: homeAltText(name),
      });
    }
  }

  if (wantScope('guides')) {
    for (const guide of brewGuides) {
      jobs.push({
        key: `guide:${guide.slug}`,
        scope: 'guide',
        slug: guide.slug,
        prompt: guidePrompt(guide),
        size: HERO_SIZE,
        alt: guideAltText(guide),
      });
    }
  }

  return jobs;
}

export function objectPathFor(job: ImageJob, hash: string): string {
  switch (job.scope) {
    case 'product':
      return productObjectPath(job.slug, job.kind, hash);
    case 'collection':
      return collectionObjectPath(job.slug, hash);
    case 'home':
      return homeObjectPath(job.name, hash);
    case 'guide':
      return guideObjectPath(job.slug, hash);
  }
}

export function existingEntry(manifest: ImagesManifest, job: ImageJob): ManifestImage | undefined {
  switch (job.scope) {
    case 'product':
      return manifest.products[job.slug]?.find((i) => i.kind === job.kind);
    case 'collection':
      return manifest.collections[job.slug];
    case 'home':
      return manifest.home[job.name];
    case 'guide':
      return manifest.guides[job.slug];
  }
}

/** Immutable merge: returns a new manifest, leaving `manifest` untouched. */
export function putEntry(
  manifest: ImagesManifest,
  job: ImageJob,
  entry: ManifestImage,
): ImagesManifest {
  switch (job.scope) {
    case 'product': {
      const rest = (manifest.products[job.slug] ?? []).filter((i) => i.kind !== job.kind);
      return {
        ...manifest,
        products: {
          ...manifest.products,
          [job.slug]: sortProductImages([...rest, { ...entry, kind: job.kind }]),
        },
      };
    }
    case 'collection':
      return { ...manifest, collections: { ...manifest.collections, [job.slug]: entry } };
    case 'home':
      return { ...manifest, home: { ...manifest.home, [job.name]: entry } };
    case 'guide':
      return { ...manifest, guides: { ...manifest.guides, [job.slug]: entry } };
  }
}

export interface ImageDeps {
  /** Returns the raw bytes the model produced (PNG for gpt-image models). */
  generate(input: { prompt: string; size: ImageSize; model: string }): Promise<Buffer>;
  /** Resize + WebP encode. */
  process(input: Buffer): Promise<{ data: Buffer; width: number; height: number }>;
  upload(input: {
    objectPath: string;
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
  log(message: string): void;
  now(): Date;
  sleep?(ms: number): Promise<void>;
}

export interface RunOptions {
  model: string;
  only?: string;
  force?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}

export interface RunResult {
  manifest: ImagesManifest;
  planned: number;
  generated: number;
  skipped: number;
  failures: Array<{ key: string; error: string }>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runImageJobs(
  previous: ImagesManifest,
  deps: ImageDeps,
  options: RunOptions,
): Promise<RunResult> {
  const jobs = planJobs(options.only);
  const pending = options.force ? jobs : jobs.filter((job) => !existingEntry(previous, job));
  const skipped = jobs.length - pending.length;

  if (options.dryRun) {
    for (const job of pending) {
      deps.log(`[dry-run] ${job.key} ${job.size} prompt=${job.prompt.length} chars`);
    }
    return {
      manifest: previous,
      planned: pending.length,
      generated: 0,
      skipped,
      failures: [],
    };
  }

  type Outcome =
    { ok: true; job: ImageJob; entry: ManifestImage } | { ok: false; job: ImageJob; error: string };

  const outcomes = await mapWithConcurrency(
    pending,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (job, index): Promise<Outcome> => {
      const label = `${index + 1}/${pending.length} ${job.key}`;
      try {
        const raw = await withRetry(
          () => deps.generate({ prompt: job.prompt, size: job.size, model: options.model }),
          {
            attempts: RETRY_ATTEMPTS,
            sleep: deps.sleep,
            onRetry: (attempt, err) =>
              deps.log(`retry ${attempt} for ${job.key}: ${messageOf(err)}`),
          },
        );
        const processed = await deps.process(raw);
        const sha = createHash('sha256').update(processed.data).digest('hex');
        const objectPath = objectPathFor(job, sha8(sha));
        await withRetry(
          () =>
            deps.upload({
              objectPath,
              body: processed.data,
              contentType: IMAGE_CONTENT_TYPE,
              cacheControl: IMAGE_CACHE_CONTROL,
            }),
          { attempts: RETRY_ATTEMPTS, sleep: deps.sleep },
        );
        deps.log(`ok ${label} -> ${objectPath} (${processed.width}x${processed.height})`);
        return {
          ok: true,
          job,
          entry: {
            url: assetUrl(objectPath),
            alt: job.alt,
            width: processed.width,
            height: processed.height,
            sha,
          },
        };
      } catch (err) {
        deps.log(`FAIL ${label}: ${messageOf(err)}`);
        return { ok: false, job, error: messageOf(err) };
      }
    },
  );

  let manifest = previous;
  const failures: Array<{ key: string; error: string }> = [];
  let generated = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      manifest = putEntry(manifest, outcome.job, outcome.entry);
      generated += 1;
    } else {
      failures.push({ key: outcome.job.key, error: outcome.error });
    }
  }

  if (generated > 0) {
    manifest = parseManifest({
      ...manifest,
      generatedAt: deps.now().toISOString(),
      model: options.model,
    });
  }

  return { manifest, planned: pending.length, generated, skipped, failures };
}
```

Run: `pnpm test:unit src/lib/images/generate` → PASS (5 describes, 10 tests).

- [ ] **Step 8: Write the CLI adapter**

`scripts/generate-images.ts`:

```ts
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Storage, type StorageOptions } from '@google-cloud/storage';
import { OAuth2Client } from 'google-auth-library';
import OpenAI from 'openai';
import sharp from 'sharp';
import { contentImages } from '../src/lib/images/content';
import { runImageJobs, type ImageDeps, type RunOptions } from '../src/lib/images/generate';
import { serializeManifest } from '../src/lib/images/manifest';
import type { ImageSize } from '../src/lib/images/prompts';

// The key lives outside the repository. `.superpowers/` is git-ignored; the
// absolute path is the primary checkout, so this also works from a worktree.
config({
  path: [
    '.superpowers/sdd/images/.env',
    '/Users/joshpayne/cofresso.com/.superpowers/sdd/images/.env',
    '.env.local',
    '.env',
  ],
});

const MODEL_PREFERENCE = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'];
const LONGEST_EDGE = 1600;
const WEBP_QUALITY = 80;
const MANIFEST_PATH = path.resolve(process.cwd(), 'content/images.manifest.json');

interface Flags extends Omit<RunOptions, 'model'> {
  model?: string;
  bucket: string;
}

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = { bucket: process.env.ASSETS_BUCKET ?? 'cofresso-prod-assets' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      return next;
    };
    switch (arg) {
      case '--only':
        flags.only = value();
        break;
      case '--model':
        flags.model = value();
        break;
      case '--bucket':
        flags.bucket = value();
        break;
      case '--concurrency':
        flags.concurrency = Number(value());
        break;
      case '--force':
        flags.force = true;
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--help':
        console.log(
          'Usage: pnpm images:generate [--only <slug|collections|home|guides>] [--force] [--dry-run] [--concurrency 6] [--model gpt-image-2] [--bucket cofresso-prod-assets]',
        );
        process.exit(0);
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return flags;
}

async function resolveModel(client: OpenAI, requested?: string): Promise<string> {
  if (requested) return requested;
  const available = new Set((await client.models.list()).data.map((m) => m.id));
  const found = MODEL_PREFERENCE.find((id) => available.has(id));
  if (!found) {
    throw new Error(
      `No image model available to this key. Looked for: ${MODEL_PREFERENCE.join(', ')}`,
    );
  }
  return found;
}

/**
 * Locally the developer exports GOOGLE_OAUTH_ACCESS_TOKEN (same convention as
 * infra/README.md). Without it, fall back to Application Default Credentials.
 */
function createStorage(): Storage {
  const projectId = process.env.GCP_PROJECT_ID ?? 'cofresso-prod';
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!token) return new Storage({ projectId });
  const authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: token });
  const options: StorageOptions = { projectId, authClient };
  return new Storage(options);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.dryRun) {
    const deps: ImageDeps = {
      generate: async () => {
        throw new Error('unreachable in a dry run');
      },
      process: async () => {
        throw new Error('unreachable in a dry run');
      },
      upload: async () => {
        throw new Error('unreachable in a dry run');
      },
      log: (message) => console.log(message),
      now: () => new Date(),
    };
    const result = await runImageJobs(contentImages(), deps, {
      ...flags,
      model: flags.model ?? MODEL_PREFERENCE[0],
      dryRun: true,
    });
    console.log(
      `Dry run: ${result.planned} to generate, ${result.skipped} already in the manifest.`,
    );
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Put it in .superpowers/sdd/images/.env or export it.',
    );
  }

  const openai = new OpenAI({ apiKey, timeout: 180_000, maxRetries: 0 });
  const model = await resolveModel(openai, flags.model);
  const bucket = createStorage().bucket(flags.bucket);

  console.log(
    `Model: ${model}. Bucket: gs://${flags.bucket}. Concurrency: ${flags.concurrency ?? 6}.`,
  );

  const deps: ImageDeps = {
    async generate({ prompt, size, model: modelId }) {
      const response = await openai.images.generate({
        model: modelId,
        prompt,
        size: size as ImageSize,
        quality: 'high',
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error('Images API returned no b64_json payload');
      return Buffer.from(b64, 'base64');
    },
    async process(input) {
      // `fit: 'inside'` with equal bounds caps the LONGEST edge and preserves
      // the aspect ratio; withoutEnlargement keeps 1024px squares at 1024px.
      const { data, info } = await sharp(input)
        .resize({
          width: LONGEST_EDGE,
          height: LONGEST_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    },
    async upload({ objectPath, body, contentType, cacheControl }) {
      await bucket.file(objectPath).save(body, {
        contentType,
        resumable: false,
        metadata: { cacheControl },
      });
    },
    log: (message) => console.log(message),
    now: () => new Date(),
  };

  const result = await runImageJobs(contentImages(), deps, { ...flags, model });

  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, serializeManifest(result.manifest), 'utf8');

  console.log(
    `Generated ${result.generated}, skipped ${result.skipped}, failed ${result.failures.length}. Manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`,
  );
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`  ${failure.key}: ${failure.error}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  // Never print the error object wholesale: an OpenAI SDK error can echo
  // request headers, and those carry the Authorization bearer token.
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

Notes:

- `contentImages()` is created in Task 4 (Step 2). If Task 3 is implemented before Task 4, add that module now — it is four lines and Task 4's step is idempotent.
- `maxRetries: 0` on the OpenAI client: retries are the plan's own, so the accounting in `RunResult` stays honest.
- Never `console.log` the flags object or `process.env`.

- [ ] **Step 9: Document the generation-only environment variables**

Append to `.env.example`:

```bash
# --- Image generation (scripts/generate-images.ts only; not runtime server env) ---
# Prefer .superpowers/sdd/images/.env, which is git-ignored.
OPENAI_API_KEY=
# export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
GOOGLE_OAUTH_ACCESS_TOKEN=
ASSETS_BUCKET=cofresso-prod-assets
```

These are deliberately **not** added to `src/lib/env.ts`: the app never reads them, and `getServerEnv()` must not start requiring them in Cloud Run.

- [ ] **Step 10: Verify and commit the script**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit src/lib/images
pnpm images:generate --dry-run
```

Expected from the dry run (no key needed, no network): 82 `[dry-run] …` lines then `Dry run: 82 to generate, 0 already in the manifest.`

```bash
git add -A
git commit -m "feat: add the image generation script with retries, concurrency and a dry run"
```

- [ ] **Step 11: THE PAID RUN — gated, run once, by a human or an agent holding the key**

Do not run this in CI. Prerequisites: Task 1 applied (`curl -I https://cofresso.com/assets/probe.txt` returned 200), `OPENAI_API_KEY` available, and write access to the bucket.

First a single product, to sanity-check the look and the real cost:

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
pnpm images:generate --only morning-frame
```

Expected: four `ok …` lines, then `Generated 4, skipped 0, failed 0.` Check them in a browser (the URLs are in `content/images.manifest.json`) before spending the rest. If the look is wrong, adjust `STYLE_GUIDE` / `COMPOSITIONS` in `src/lib/images/prompts.ts`, re-run with `--force --only morning-frame`, and keep iterating on one product only.

Then the rest:

```bash
pnpm images:generate
```

Expected: `Generated 78, skipped 4, failed 0.` (the four Morning Frame entries are skipped because they are already in the manifest). Re-run the same command to mop up any failures — it is idempotent and only retries what is missing.

**Budget and duration.** 82 images: 54 at `1024x1024` and 28 at `1536x1024`, all `quality: 'high'`. At the gpt-image-1 high-quality rates (~$0.17 per square, ~$0.25 per landscape) that is **≈ $16 for a full run**; treat **$25** as the ceiling and verify the first `--only` run against the OpenAI billing dashboard before committing to the rest. Wall clock at concurrency 6 is **10–20 minutes** (≈ 30–60 s per image, 14 waves).

- [ ] **Step 12: Verify the uploaded objects and commit the manifest**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
node -e "const m=require('./content/images.manifest.json');const n=Object.values(m.products).flat().length;console.log(m.model,n,Object.keys(m.collections).length,Object.keys(m.home).length,Object.keys(m.guides).length)"
curl -I "$(node -e "console.log(require('./content/images.manifest.json').products['morning-frame'][0].url)")"
gcloud storage ls -r 'gs://cofresso-prod-assets/**' | wc -l
```

Expected: `gpt-image-2 72 4 2 4`; the `curl` shows `HTTP/2 200`, `content-type: image/webp` and `cache-control: public, max-age=31536000, immutable`; the object count is 82 (plus directory placeholder lines, so ≥ 82).

```bash
pnpm test:unit src/lib/images
pnpm format
git add content/images.manifest.json
git commit -m "chore: generate product, collection, home and brew-guide imagery"
```

`pnpm format` must produce no change to the manifest — `serializeManifest` already emits Prettier-compatible JSON. If Prettier rewrites it, fix `serializeManifest` rather than committing the reformatted file.

---

### Task 4: Schema, migration `0002_product_images`, typed content module and seeding from the manifest

**Files:**

- Modify: `src/lib/db/schema/enums.ts`, `src/lib/db/schema/catalog.ts`, `src/lib/db/schema/relations.ts`, `src/lib/db/seed/index.ts`
- Create: `src/lib/images/content.ts`, `drizzle/0002_product_images.sql` (generated), `drizzle/meta/0002_snapshot.json` (generated)
- Modify: `drizzle/meta/_journal.json` (generated)
- Test: `src/lib/images/content.test.ts`, `tests/integration/images.test.ts`

**Interfaces:**

- Consumes: `IMAGE_KINDS` / `ImageKind` (Task 2); `parseManifest`, `sortProductImages`, `ManifestImage`, `ManifestProductImage`, `ImagesManifest` (Task 2); `content/images.manifest.json` (Task 2); `stableId` from `@/lib/db/seed/ids`.
- Produces:
  - `src/lib/db/schema/enums.ts`: `imageKindEnum` (pg enum `image_kind`), re-exported `ImageKind` type
  - `src/lib/db/schema/catalog.ts`: `productImages` table; `collections.heroImageUrl`, `collections.heroImageAlt`; `type ProductImage = typeof productImages.$inferSelect`; `type NewProductImage`
  - `src/lib/db/schema/relations.ts`: `products.images` (many), `productImages.product` (one)
  - `src/lib/images/content.ts`: `contentImages(): ImagesManifest`; `homeImage(name: HomeImageName): ManifestImage | null`; `guideImage(slug: string): ManifestImage | null`; `collectionImage(slug: string): ManifestImage | null`; `productImagesFor(slug: string): ManifestProductImage[]`
  - `src/lib/db/seed/index.ts`: `runSeed(db: Db, options?: { manifest?: ImagesManifest }): Promise<SeedSummary>`; `SeedSummary` gains `productImages: number` and `collectionHeroes: number`
  - Database contract for Task 5: `product_images` rows exist for every manifest entry, ordered by `position` in `IMAGE_KINDS` order, unique per `(product_id, kind)`; `collections.hero_image_url` / `hero_image_alt` set when the manifest has that collection.

- [ ] **Step 1: Add the pg enum**

`src/lib/db/schema/enums.ts` — add the import, the enum and the type re-export:

```ts
import { pgEnum } from 'drizzle-orm/pg-core';
import {
  DISCOUNT_KINDS,
  GRINDS,
  IMAGE_KINDS,
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  PURCHASE_TYPES,
  ROAST_LEVELS,
} from './values';

export const productCategoryEnum = pgEnum('product_category', PRODUCT_CATEGORIES);
export const roastLevelEnum = pgEnum('roast_level', ROAST_LEVELS);
export const grindEnum = pgEnum('grind', GRINDS);
export const purchaseTypeEnum = pgEnum('purchase_type', PURCHASE_TYPES);
export const discountKindEnum = pgEnum('discount_kind', DISCOUNT_KINDS);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const imageKindEnum = pgEnum('image_kind', IMAGE_KINDS);

export type {
  DiscountKind,
  Grind,
  ImageKind,
  OrderStatus,
  ProductCategory,
  PurchaseType,
  RoastLevel,
} from './values';
```

- [ ] **Step 2: Add the table and the collection hero columns**

`src/lib/db/schema/catalog.ts`:

1. Extend the pg-core import list with `unique`:

```ts
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { imageKindEnum, productCategoryEnum, roastLevelEnum } from './enums';
```

2. Replace the `collections` table with:

```ts
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
  /** Generated hero banner (see content/images.manifest.json). Null falls back to no banner. */
  heroImageUrl: text('hero_image_url'),
  heroImageAlt: text('hero_image_alt'),
});
```

3. Add the new table immediately after `productVariants` (before `collections`):

```ts
/**
 * Generated product photography. One row per (product, kind); the manifest is
 * the source of truth and `runSeed` reconciles this table against it.
 */
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: text('alt').notNull(),
    kind: imageKindEnum('kind').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('product_images_product_idx').on(t.productId),
    unique('product_images_product_kind_key').on(t.productId, t.kind),
  ],
);
```

4. Extend the type exports at the bottom of the file:

```ts
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type Review = typeof reviews.$inferSelect;
```

`Collection` now carries `heroImageUrl` and `heroImageAlt`, which is why `listCollections` and `getCollectionBySlug` need no change in Task 5.

- [ ] **Step 3: Add the relation**

`src/lib/db/schema/relations.ts` — extend the catalog import and the two relation blocks:

```ts
import {
  collections,
  productCollections,
  productImages,
  productVariants,
  products,
  reviews,
} from './catalog';
```

```ts
export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  images: many(productImages),
  productCollections: many(productCollections),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
```

Add `productImagesRelations` right after `productVariantsRelations`.

- [ ] **Step 4: Generate the migration — never hand-write it**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm db:generate --name product_images
```

If pnpm swallows the flag, use the unambiguous form: `pnpm exec drizzle-kit generate --name=product_images`.

Expected: `drizzle/0002_product_images.sql` and `drizzle/meta/0002_snapshot.json` created, `drizzle/meta/_journal.json` gains an `idx: 2` entry with `"tag": "0002_product_images"`. Read the SQL and confirm it contains all of:

```sql
CREATE TYPE "public"."image_kind" AS ENUM('front', 'detail', 'lifestyle', 'packaging');
CREATE TABLE "product_images" ( ... "kind" "image_kind" NOT NULL, ... CONSTRAINT "product_images_product_kind_key" UNIQUE("product_id","kind") );
ALTER TABLE "collections" ADD COLUMN "hero_image_url" text;
ALTER TABLE "collections" ADD COLUMN "hero_image_alt" text;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");
```

If it instead contains a `DROP` or a `--> statement-breakpoint` around a rename, drizzle-kit misread the diff: revert the generated files, re-check that `0000`/`0001` are untouched, and regenerate. Never edit `drizzle/0000_init.sql` or `drizzle/0001_stock_nonneg.sql`.

Apply locally:

```bash
docker compose up -d
pnpm db:migrate
```

Expected: `Applying migrations from …/drizzle... Migrations applied.`

- [ ] **Step 5: The typed content module — test first**

`src/lib/images/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS } from '@/lib/db/schema/values';
import { collectionImage, contentImages, guideImage, homeImage, productImagesFor } from './content';
import { ASSETS_BASE_URL, imagesManifestSchema } from './manifest';

describe('contentImages', () => {
  it('parses the committed manifest', () => {
    expect(imagesManifestSchema.safeParse(contentImages()).success).toBe(true);
  });

  it('is cached, so the JSON is validated once', () => {
    expect(contentImages()).toBe(contentImages());
  });

  it('serves every recorded url from the CDN and uses known kinds', () => {
    const manifest = contentImages();
    const entries = [
      ...Object.values(manifest.products).flat(),
      ...Object.values(manifest.collections),
      ...Object.values(manifest.home),
      ...Object.values(manifest.guides),
    ];
    for (const entry of entries) {
      expect(entry.url.startsWith(`${ASSETS_BASE_URL}/`)).toBe(true);
      expect(entry.alt.length).toBeGreaterThan(0);
    }
    for (const images of Object.values(manifest.products)) {
      for (const image of images) expect(IMAGE_KINDS).toContain(image.kind);
    }
  });

  it('returns null rather than undefined for absent lookups', () => {
    expect(homeImage('hero')).toEqual(contentImages().home.hero ?? null);
    expect(guideImage('no-such-guide')).toBeNull();
    expect(collectionImage('no-such-collection')).toBeNull();
    expect(productImagesFor('no-such-product')).toEqual([]);
  });

  it('returns product images in gallery order', () => {
    for (const slug of Object.keys(contentImages().products)) {
      const kinds = productImagesFor(slug).map((i) => i.kind);
      const expected = IMAGE_KINDS.filter((k) => kinds.includes(k));
      expect(kinds).toEqual(expected);
    }
  });
});
```

This test doubles as the CI guard on the committed manifest: a hand-edited or truncated `content/images.manifest.json` fails `pnpm test:unit`.

- [ ] **Step 6: Implement the content module**

`src/lib/images/content.ts`:

```ts
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
```

Run: `pnpm test:unit src/lib/images/content` → PASS (with the empty manifest, the loops are vacuous and the null cases carry the test).

- [ ] **Step 7: Integration test for the seed and the reconciliation — write it first**

`tests/integration/images.test.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ASSETS_BASE_URL, type ImagesManifest } from '../../src/lib/images/manifest';
import { collections, productImages, products } from '../../src/lib/db/schema';
import { runSeed } from '../../src/lib/db/seed';
import { stableId } from '../../src/lib/db/seed/ids';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(async () => {
  // Leave the database as the other suites expect it: reseed from the
  // committed manifest (empty until the generation run has happened).
  await runSeed(db);
  await close();
});

const sha = (n: string) => n.repeat(64).slice(0, 64);

function fixture(kinds: Array<'front' | 'detail' | 'lifestyle' | 'packaging'>): ImagesManifest {
  return {
    generatedAt: '2026-09-06T12:00:00.000Z',
    model: 'gpt-image-2',
    products: {
      'morning-frame': kinds.map((kind, i) => ({
        kind,
        url: `${ASSETS_BASE_URL}/products/morning-frame/morning-frame-${kind}-1234567${i}.webp`,
        alt: `Morning Frame ${kind}`,
        width: kind === 'lifestyle' ? 1536 : 1024,
        height: 1024,
        sha: sha(String(i)),
      })),
    },
    collections: {
      blends: {
        url: `${ASSETS_BASE_URL}/collections/blends-abcdef12.webp`,
        alt: 'Cofresso Blends collection',
        width: 1536,
        height: 1024,
        sha: sha('a'),
      },
    },
    home: {},
    guides: {},
  };
}

const morningFrameId = stableId('product:morning-frame');

async function imagesFor(slug: string) {
  const [product] = await db.select().from(products).where(eq(products.slug, slug));
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.position));
}

describe('runSeed with an images manifest', () => {
  beforeAll(async () => {
    await runSeed(db, { manifest: fixture(['front', 'detail', 'lifestyle', 'packaging']) });
  });

  it('inserts one row per manifest entry in gallery order', async () => {
    const rows = await imagesFor('morning-frame');
    expect(rows.map((r) => r.kind)).toEqual(['front', 'detail', 'lifestyle', 'packaging']);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
    expect(rows[0].productId).toBe(morningFrameId);
    expect(rows[0].url).toContain('/assets/products/morning-frame/morning-frame-front-');
    expect(rows[0].alt).toBe('Morning Frame front');
    expect(rows[2].width).toBe(1536);
  });

  it('sets the collection hero and leaves other collections null', async () => {
    const [blends] = await db.select().from(collections).where(eq(collections.slug, 'blends'));
    expect(blends.heroImageUrl).toContain('/assets/collections/blends-');
    expect(blends.heroImageAlt).toBe('Cofresso Blends collection');
    const [decaf] = await db.select().from(collections).where(eq(collections.slug, 'decaf'));
    expect(decaf.heroImageUrl).toBeNull();
    expect(decaf.heroImageAlt).toBeNull();
  });

  it('is idempotent: re-seeding the same manifest upserts in place', async () => {
    const before = await imagesFor('morning-frame');
    await runSeed(db, { manifest: fixture(['front', 'detail', 'lifestyle', 'packaging']) });
    const after = await imagesFor('morning-frame');
    expect(after).toHaveLength(4);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
  });

  it('reconciles: kinds dropped from the manifest are removed', async () => {
    await runSeed(db, { manifest: fixture(['front', 'lifestyle']) });
    const rows = await imagesFor('morning-frame');
    expect(rows.map((r) => r.kind)).toEqual(['front', 'lifestyle']);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
  });

  it('removes every row and clears heroes when the manifest is empty', async () => {
    const summary = await runSeed(db);
    expect(await imagesFor('morning-frame')).toEqual([]);
    const [blends] = await db.select().from(collections).where(eq(collections.slug, 'blends'));
    expect(blends.heroImageUrl).toBeNull();
    expect(summary.productImages).toBe(
      Object.values((await import('../../src/lib/images/content')).contentImages().products).flat()
        .length,
    );
  });

  it('reports counts in the summary', async () => {
    const summary = await runSeed(db, { manifest: fixture(['front', 'detail']) });
    expect(summary.productImages).toBe(2);
    expect(summary.collectionHeroes).toBe(1);
  });
});
```

- [ ] **Step 8: Seed the images**

`src/lib/db/seed/index.ts` — the full file after the change:

```ts
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  collections,
  discountCodes,
  productCollections,
  productImages,
  productVariants,
  products,
  reviews,
} from '@/lib/db/schema';
import { contentImages } from '@/lib/images/content';
import { sortProductImages, type ImagesManifest } from '@/lib/images/manifest';
import { seedCollections, seedDiscountCodes, seedProducts } from './data';
import { stableId } from './ids';
import { buildSeedReviews } from './reviews';

export interface SeedSummary {
  collections: number;
  products: number;
  variants: number;
  reviews: number;
  discountCodes: number;
  productImages: number;
  collectionHeroes: number;
}

export interface SeedOptions {
  /** Defaults to the committed `content/images.manifest.json`. */
  manifest?: ImagesManifest;
}

export async function runSeed(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const seedReviews = buildSeedReviews();
  const manifest = options.manifest ?? contentImages();
  let imageCount = 0;
  let heroCount = 0;

  await db.transaction(async (tx) => {
    for (const c of seedCollections) {
      const hero = manifest.collections[c.slug];
      if (hero) heroCount += 1;
      await tx
        .insert(collections)
        .values({
          id: stableId(`collection:${c.slug}`),
          ...c,
          heroImageUrl: hero?.url ?? null,
          heroImageAlt: hero?.alt ?? null,
        })
        .onConflictDoUpdate({
          target: collections.slug,
          set: {
            name: c.name,
            description: c.description,
            position: c.position,
            heroImageUrl: hero?.url ?? null,
            heroImageAlt: hero?.alt ?? null,
          },
        });
    }

    for (const p of seedProducts) {
      const productId = stableId(`product:${p.slug}`);
      const values = {
        id: productId,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        category: p.category,
        origin: p.origin ?? null,
        region: p.region ?? null,
        producer: p.producer ?? null,
        altitudeM: p.altitudeM ?? null,
        process: p.process ?? null,
        roastLevel: p.roastLevel ?? null,
        tastingNotes: p.tastingNotes,
        imagePath: `/products/${p.slug}.svg`,
        featured: p.featured ?? false,
        active: true,
      };
      const { id: _id, slug: _slug, ...updatable } = values;
      await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.slug, set: updatable });

      for (const v of p.variants) {
        const variantId = stableId(`variant:${v.sku}`);
        await tx
          .insert(productVariants)
          .values({
            id: variantId,
            productId,
            sku: v.sku,
            name: v.name,
            weightGrams: v.weightGrams,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents ?? null,
            stockQuantity: v.stockQuantity,
            position: p.variants.indexOf(v),
          })
          .onConflictDoUpdate({
            target: productVariants.sku,
            // Intentionally do not overwrite stock_quantity so orders placed against a
            // seeded database keep their inventory effect.
            set: {
              name: v.name,
              weightGrams: v.weightGrams,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents ?? null,
              position: p.variants.indexOf(v),
            },
          });
      }

      for (const [index, collectionSlug] of p.collections.entries()) {
        await tx
          .insert(productCollections)
          .values({
            productId,
            collectionId: stableId(`collection:${collectionSlug}`),
            position: index,
          })
          .onConflictDoUpdate({
            target: [productCollections.productId, productCollections.collectionId],
            set: { position: index },
          });
      }

      // The manifest is authoritative: upsert what it has, then delete the
      // kinds it no longer lists so a regenerated set never leaves orphans.
      const images = sortProductImages(manifest.products[p.slug] ?? []);
      imageCount += images.length;
      for (const [index, image] of images.entries()) {
        await tx
          .insert(productImages)
          .values({
            id: stableId(`product-image:${p.slug}:${image.kind}`),
            productId,
            url: image.url,
            alt: image.alt,
            kind: image.kind,
            width: image.width,
            height: image.height,
            position: index,
          })
          .onConflictDoUpdate({
            target: [productImages.productId, productImages.kind],
            set: {
              url: image.url,
              alt: image.alt,
              width: image.width,
              height: image.height,
              position: index,
            },
          });
      }
      const keptKinds = images.map((i) => i.kind);
      await tx
        .delete(productImages)
        .where(
          keptKinds.length
            ? and(eq(productImages.productId, productId), notInArray(productImages.kind, keptKinds))
            : eq(productImages.productId, productId),
        );
    }

    for (const r of seedReviews) {
      const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000);
      await tx
        .insert(reviews)
        .values({
          id: stableId(`review:${r.key}`),
          productId: stableId(`product:${r.productSlug}`),
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: r.verified,
          createdAt,
        })
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
            authorName: r.authorName,
            rating: r.rating,
            title: r.title,
            body: r.body,
            verified: r.verified,
          },
        });
    }

    for (const d of seedDiscountCodes) {
      await tx
        .insert(discountCodes)
        .values({ id: stableId(`discount:${d.code}`), ...d, active: true })
        .onConflictDoUpdate({
          target: discountCodes.code,
          set: { kind: d.kind, value: d.value, minSubtotalCents: d.minSubtotalCents, active: true },
        });
    }

    // Keep the order number sequence ahead of any seeded/legacy data.
    await tx.execute(
      sql`select setval('order_number_seq', greatest(nextval('order_number_seq'), 10001), false)`,
    );
  });

  return {
    collections: seedCollections.length,
    products: seedProducts.length,
    variants: seedProducts.reduce((n, p) => n + p.variants.length, 0),
    reviews: seedReviews.length,
    discountCodes: seedDiscountCodes.length,
    productImages: imageCount,
    collectionHeroes: heroCount,
  };
}
```

The signature stays backward compatible, so `scripts/db.ts`, `tests/integration/global-setup.ts` and `tests/integration/seed.test.ts` need no change.

- [ ] **Step 9: Run the suites**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck
pnpm test:unit src/lib/images
pnpm test:integration
```

Expected: all integration files pass, including the pre-existing `seed.test.ts` (`summary.products` and the stock-preservation test are unaffected) and the new `images.test.ts` (6 tests).

- [ ] **Step 10: Commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
git add -A
git commit -m "feat: add product_images table, collection hero columns and manifest-driven seeding"
```

---

### Task 5: Catalog queries and types carry images

**Files:**

- Modify: `src/lib/catalog/types.ts`, `src/lib/db/queries/catalog.ts`
- Create: `src/lib/catalog/types.test.ts`
- Modify: `tests/integration/catalog.test.ts`

**Interfaces:**

- Consumes: `productImages`, `ProductImage`, `ImageKind` (Task 4).
- Produces:
  - `ProductCardData` gains `images: ProductImage[]` (ascending `position`)
  - `imageOfKind(images: readonly ProductImage[], kind: ImageKind): ProductImage | undefined`
  - `primaryImage(images: readonly ProductImage[]): ProductImage | undefined`
  - `hoverImage(images: readonly ProductImage[]): ProductImage | undefined` (lifestyle, else detail, else undefined)
  - Every catalog query that returns `ProductCardData` / `ProductDetailData` (`listProducts`, `listFeaturedProducts`, `getProductBySlug`, `listRelatedProducts`, `searchProducts`) populates `images`
  - `listCollections` / `getCollectionBySlug` keep returning `Collection`, which now includes `heroImageUrl` and `heroImageAlt` — no signature change

- [ ] **Step 1: Types test first**

`src/lib/catalog/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ProductImage } from '@/lib/db/schema';
import { hoverImage, imageOfKind, primaryImage } from './types';

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
});
```

- [ ] **Step 2: Extend the catalog types**

`src/lib/catalog/types.ts` — the full file after the change:

```ts
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
```

Run: `pnpm test:unit src/lib/catalog` → PASS.

- [ ] **Step 3: Load images in every product query**

`src/lib/db/queries/catalog.ts` — four edits.

1. Extend the imports:

```ts
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import {
  lowestPriceCents,
  type ProductCardData,
  type ProductDetailData,
} from '@/lib/catalog/types';
import { getDb, type Db } from '@/lib/db/client';
import {
  collections,
  productCollections,
  productImages,
  products,
  reviews,
  type Collection,
  type Product,
  type ProductImage,
  type Review,
} from '@/lib/db/schema';
import type { ProductFilters } from '@/lib/shop/filters';
```

2. Replace the `ProductWithRelations` type and `toCard`:

```ts
type ProductWithRelations = Product & {
  variants: ProductCardData['variants'];
  images: ProductImage[];
  reviews: Pick<Review, 'rating'>[];
};

function toCard(p: ProductWithRelations): ProductCardData {
  const count = p.reviews.length;
  const average = count ? p.reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  const { reviews: _reviews, variants, images, ...product } = p;
  return {
    product,
    variants: [...variants].sort((a, b) => a.position - b.position),
    images: [...images].sort((a, b) => a.position - b.position),
    rating: { average: Math.round(average * 10) / 10, count },
  };
}
```

Destructuring `images` out of the rest spread is required: without it `product` would carry an `images` key that does not belong to the `Product` row type.

3. Add `images` to the `with` clause of all five product queries. The relation is loaded ordered so the defensive sort in `toCard` is a no-op:

```ts
const withCardRelations = {
  variants: true,
  images: { orderBy: [asc(productImages.position)] },
  reviews: { columns: { rating: true } },
} as const;
```

Declare that constant just below `toCard`, then use it in `listProducts`, `listFeaturedProducts`, `listRelatedProducts` and `searchProducts`:

```ts
const rows = await db.query.products.findMany({
  where: and(...conditions),
  with: withCardRelations,
});
```

```ts
const rows = await db.query.products.findMany({
  where: and(eq(products.active, true), eq(products.featured, true)),
  with: withCardRelations,
  orderBy: [asc(products.name)],
  limit,
});
```

```ts
const rows = await db.query.products.findMany({
  where: and(
    eq(products.active, true),
    ne(products.id, product.id),
    eq(products.category, product.category),
  ),
  with: withCardRelations,
  orderBy: [desc(products.featured), asc(products.name)],
  limit,
});
```

```ts
const rows = await db.query.products.findMany({
  where: and(
    eq(products.active, true),
    or(
      ilike(products.name, pattern),
      ilike(products.tagline, pattern),
      ilike(products.origin, pattern),
      ilike(products.region, pattern),
      sql`array_to_string(${products.tastingNotes}, ' ') ilike ${pattern}`,
    ),
  ),
  with: withCardRelations,
  orderBy: [desc(products.featured), asc(products.name)],
});
```

4. `getProductBySlug` keeps its own `with` (it needs full reviews and collections):

```ts
export async function getProductBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<ProductDetailData | null> {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      variants: true,
      images: { orderBy: [asc(productImages.position)] },
      reviews: { orderBy: [desc(reviews.createdAt)] },
      productCollections: {
        with: { collection: true },
        orderBy: [asc(productCollections.position)],
      },
    },
  });
  if (!row) return null;
  const { productCollections: pcs, reviews: fullReviews, ...rest } = row;
  const card = toCard({ ...rest, reviews: fullReviews });
  return { ...card, collections: pcs.map((pc) => pc.collection), reviews: fullReviews };
}
```

- [ ] **Step 4: Extend the catalog integration test**

`tests/integration/catalog.test.ts` — add these two tests inside the existing `describe('catalog queries', …)` block, and extend the imports at the top with `import { primaryImage } from '../../src/lib/catalog/types';`:

```ts
it('returns product images in position order on cards and detail', async () => {
  const items = await listProducts(undefined, db);
  for (const item of items) {
    const positions = item.images.map((i) => i.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(item.images.map((i) => i.kind)).size).toBe(item.images.length);
    for (const image of item.images) {
      expect(image.productId).toBe(item.product.id);
      expect(image.url).toContain('/assets/');
      expect(image.alt.length).toBeGreaterThan(0);
    }
  }

  const detail = await getProductBySlug('morning-frame', db);
  expect(detail!.images.map((i) => i.position)).toEqual(
    detail!.images.map((_, i) => i).slice(0, detail!.images.length),
  );
  if (detail!.images.length > 0) expect(primaryImage(detail!.images)!.kind).toBe('front');
});

it('exposes collection hero columns', async () => {
  const list = await listCollections(db);
  for (const collection of list) {
    expect(collection).toHaveProperty('heroImageUrl');
    expect(collection).toHaveProperty('heroImageAlt');
    if (collection.heroImageUrl) expect(collection.heroImageUrl).toContain('/assets/');
  }
  const blends = await getCollectionBySlug('blends', db);
  expect(blends).toHaveProperty('heroImageUrl');
});
```

Both tests pass with an empty manifest (the loops are vacuous) and tighten automatically once the manifest is populated. That is deliberate: the app PR must not depend on the paid run having finished.

- [ ] **Step 5: Verify and commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
git add -A
git commit -m "feat: load generated product images through the catalog queries"
```

Expected: `typecheck` is the real gate here — every construction of `ProductCardData` must now supply `images`. If `tsc` flags a test fixture or a component story, add `images: []` there.

---

### Task 6: `ProductGallery` client component and the product detail page

**Files:**

- Create: `src/lib/images/gallery.ts`, `src/components/product/product-gallery.tsx`
- Modify: `src/app/(shop)/products/[slug]/page.tsx`
- Test: `src/lib/images/gallery.test.ts`, `src/components/product/product-gallery.test.tsx`

**Interfaces:**

- Consumes: `ProductImage` / `ImageKind` (Task 4); `getProductBySlug` returning `images` (Task 5); `IconArrowRight` from `@/components/ui/icons`.
- Produces:
  - `src/lib/images/gallery.ts`: `nextIndex(current: number, length: number): number`; `prevIndex(current: number, length: number): number`; `clampIndex(index: number, length: number): number`; `swipeDirection(startX: number, endX: number, threshold?: number): 1 | -1 | 0`; `SWIPE_THRESHOLD_PX = 40`
  - `src/components/product/product-gallery.tsx`: `interface GalleryImage { url: string; alt: string; width: number; height: number; kind: ImageKind }`; `interface ProductGalleryProps { images: readonly GalleryImage[]; fallback: { src: string; alt: string }; className?: string }`; `ProductGallery(props): JSX.Element`
  - DOM contract consumed by the e2e suite (Task 8): `data-testid` `gallery`, `gallery-main`, `gallery-next`, `gallery-prev`, `gallery-thumb-<n>` (zero-based); `aria-roledescription="carousel"`; the container is focusable (`tabIndex={0}`) and handles ArrowLeft/ArrowRight.
  - `ProductImage` (a DB row) satisfies `GalleryImage` structurally, so the page passes `data.images` unchanged.

- [ ] **Step 1: Index math — test first**

`src/lib/images/gallery.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampIndex, nextIndex, prevIndex, SWIPE_THRESHOLD_PX, swipeDirection } from './gallery';

describe('nextIndex and prevIndex', () => {
  it('wraps in both directions', () => {
    expect(nextIndex(0, 4)).toBe(1);
    expect(nextIndex(3, 4)).toBe(0);
    expect(prevIndex(0, 4)).toBe(3);
    expect(prevIndex(3, 4)).toBe(2);
  });

  it('is a no-op for an empty or single-image gallery', () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });

  it('recovers from an out-of-range current index', () => {
    expect(nextIndex(9, 4)).toBe(0);
    expect(prevIndex(-2, 4)).toBe(3);
  });
});

describe('clampIndex', () => {
  it('keeps the index inside the collection', () => {
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(7, 4)).toBe(3);
    expect(clampIndex(-3, 4)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
  });
});

describe('swipeDirection', () => {
  it('maps a leftward swipe to next and a rightward swipe to previous', () => {
    expect(swipeDirection(300, 100)).toBe(1);
    expect(swipeDirection(100, 300)).toBe(-1);
  });

  it('ignores movement below the threshold', () => {
    expect(swipeDirection(100, 100)).toBe(0);
    expect(swipeDirection(100, 100 + SWIPE_THRESHOLD_PX - 1)).toBe(0);
    expect(swipeDirection(100, 100 + SWIPE_THRESHOLD_PX + 1)).toBe(-1);
    expect(swipeDirection(100, 130, 10)).toBe(-1);
  });
});
```

- [ ] **Step 2: Implement the index math**

`src/lib/images/gallery.ts`:

```ts
/** Below this many pixels a pointer drag is treated as a tap, not a swipe. */
export const SWIPE_THRESHOLD_PX = 40;

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (clampIndex(current, length) + 1) % length;
}

export function prevIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (clampIndex(current, length) - 1 + length) % length;
}

/** 1 = advance, -1 = go back, 0 = ignore. */
export function swipeDirection(
  startX: number,
  endX: number,
  threshold = SWIPE_THRESHOLD_PX,
): 1 | -1 | 0 {
  const dx = endX - startX;
  if (Math.abs(dx) <= threshold) return 0;
  return dx < 0 ? 1 : -1;
}
```

Run: `pnpm test:unit src/lib/images/gallery` → PASS.

- [ ] **Step 3: Component test first**

`src/components/product/product-gallery.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImageKind } from '@/lib/db/schema';
import { ProductGallery, type GalleryImage } from './product-gallery';

// next/image needs Next's build-time image config and a configured remote
// host; in jsdom we only care about the carousel behaviour, so render a plain
// img and drop the Next-only props that React would warn about.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    quality: _quality,
    unoptimized: _unoptimized,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    loader: _loader,
    ...rest
  }: Record<string, unknown> & { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}));

function image(kind: ImageKind): GalleryImage {
  return {
    url: `https://cofresso.com/assets/products/morning-frame/morning-frame-${kind}-deadbeef.webp`,
    alt: `Morning Frame ${kind}`,
    width: kind === 'lifestyle' ? 1536 : 1024,
    height: 1024,
    kind,
  };
}

const images: GalleryImage[] = [
  image('front'),
  image('detail'),
  image('lifestyle'),
  image('packaging'),
];

const fallback = { src: '/products/morning-frame.svg', alt: 'Morning Frame' };

function setup(list: GalleryImage[] = images) {
  return {
    user: userEvent.setup(),
    ...render(<ProductGallery images={list} fallback={fallback} />),
  };
}

const main = () => screen.getByTestId('gallery-main');

describe('ProductGallery', () => {
  it('shows the first image, a thumbnail per image and carousel semantics', () => {
    setup();
    expect(screen.getByTestId('gallery')).toHaveAttribute('aria-roledescription', 'carousel');
    expect(main()).toHaveAttribute('src', images[0].url);
    expect(main()).toHaveAttribute('alt', 'Morning Frame front');
    expect(screen.getAllByTestId(/^gallery-thumb-/)).toHaveLength(4);
    expect(screen.getByTestId('gallery-thumb-0')).toHaveAttribute('aria-current', 'true');
  });

  it('changes the main image when a thumbnail is clicked', async () => {
    const { user } = setup();
    await user.click(screen.getByTestId('gallery-thumb-1'));
    expect(main()).toHaveAttribute('src', images[1].url);
    expect(main()).toHaveAttribute('alt', 'Morning Frame detail');
    expect(screen.getByTestId('gallery-thumb-1')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('gallery-thumb-0')).not.toHaveAttribute('aria-current');
  });

  it('advances and rewinds with the arrow buttons', async () => {
    const { user } = setup();
    await user.click(screen.getByTestId('gallery-next'));
    expect(main()).toHaveAttribute('src', images[1].url);
    await user.click(screen.getByTestId('gallery-prev'));
    expect(main()).toHaveAttribute('src', images[0].url);
  });

  it('wraps with the arrow keys', async () => {
    const { user } = setup();
    const container = screen.getByTestId('gallery');
    container.focus();
    await user.keyboard('{ArrowLeft}');
    expect(main()).toHaveAttribute('src', images[3].url);
    await user.keyboard('{ArrowRight}');
    expect(main()).toHaveAttribute('src', images[0].url);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(main()).toHaveAttribute('src', images[2].url);
  });

  it('falls back to the SVG art and hides the controls when there are no images', () => {
    setup([]);
    expect(main()).toHaveAttribute('src', fallback.src);
    expect(main()).toHaveAttribute('alt', fallback.alt);
    expect(screen.queryByTestId('gallery-next')).toBeNull();
    expect(screen.queryByTestId('gallery-thumb-0')).toBeNull();
  });

  it('hides the arrows for a single image but still renders it', () => {
    setup([image('front')]);
    expect(main()).toHaveAttribute('src', images[0].url);
    expect(screen.queryByTestId('gallery-next')).toBeNull();
    expect(screen.getByTestId('gallery-thumb-0')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Implement the gallery**

`src/components/product/product-gallery.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { IconArrowRight } from '@/components/ui/icons';
import type { ImageKind } from '@/lib/db/schema';
import { clampIndex, nextIndex, prevIndex, swipeDirection } from '@/lib/images/gallery';

export interface GalleryImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  kind: ImageKind;
}

export interface ProductGalleryProps {
  images: readonly GalleryImage[];
  /** Legacy SVG art, used when a product has no generated photography. */
  fallback: { src: string; alt: string };
  className?: string;
}

const KIND_LABELS: Record<ImageKind, string> = {
  front: 'Front',
  detail: 'Detail',
  lifestyle: 'In use',
  packaging: 'Packaging',
};

const ARROW_CLASS =
  'bg-foam/90 text-espresso hover:bg-foam absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full shadow-md transition-opacity';

export function ProductGallery({ images, fallback, className }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: 1 | -1) => {
      setIndex((current) =>
        delta === 1 ? nextIndex(current, images.length) : prevIndex(current, images.length),
      );
    },
    [images.length],
  );

  if (images.length === 0) {
    return (
      <div
        className={`bg-foam relative overflow-hidden rounded-3xl ${className ?? ''}`}
        data-testid="gallery"
        aria-roledescription="carousel"
      >
        <Image
          src={fallback.src}
          alt={fallback.alt}
          width={600}
          height={750}
          unoptimized
          priority
          className="h-auto w-full"
          data-testid="gallery-main"
        />
      </div>
    );
  }

  const active = clampIndex(index, images.length);
  const current = images[active];
  const showArrows = images.length > 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartX.current;
    pointerStartX.current = null;
    if (start === null) return;
    const direction = swipeDirection(start, event.clientX);
    if (direction !== 0) go(direction);
  }

  return (
    <div
      className={`flex flex-col gap-3 ${className ?? ''}`}
      data-testid="gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label="Product images"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="bg-foam relative aspect-square overflow-hidden rounded-3xl">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority={active === 0}
          className="object-cover"
          data-testid="gallery-main"
        />
        {showArrows ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              data-testid="gallery-prev"
              className={`${ARROW_CLASS} left-3`}
            >
              <IconArrowRight width={16} height={16} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              data-testid="gallery-next"
              className={`${ARROW_CLASS} right-3`}
            >
              <IconArrowRight width={16} height={16} />
            </button>
          </>
        ) : null}
        <p className="bg-espresso/70 text-foam absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs">
          {active + 1} / {images.length}
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-3">
        {images.map((image, i) => (
          <li key={image.url}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${KIND_LABELS[image.kind]} image`}
              aria-current={i === active ? 'true' : undefined}
              data-testid={`gallery-thumb-${i}`}
              className={`bg-foam relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors ${
                i === active ? 'border-copper' : 'hover:border-latte/60 border-transparent'
              }`}
            >
              <Image src={image.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Thumbnails use `alt=""` on purpose: the button already carries an accessible name, so a second description would be read twice.

Run: `pnpm test:unit src/components/product/product-gallery` → PASS (6 tests).

- [ ] **Step 5: Wire the gallery into the product detail page**

`src/app/(shop)/products/[slug]/page.tsx` — four edits.

1. Imports: drop `next/image`, add the gallery and the image selectors.

```ts
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartForm } from '@/components/product/add-to-cart-form';
import { ProductDetails } from '@/components/product/product-details';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductGrid } from '@/components/product/product-grid';
import { ReviewList } from '@/components/product/review-list';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { Rating } from '@/components/ui/rating';
import { SectionHeading } from '@/components/ui/section-heading';
import { categoryLabel, roastLabel } from '@/lib/catalog/labels';
import { lowestPriceCents, primaryImage } from '@/lib/catalog/types';
import { getProductBySlug, listRelatedProducts } from '@/lib/db/queries/catalog';
import { getServerEnv } from '@/lib/env';
import { ViewItemTracker } from './view-item-tracker';
```

2. `generateMetadata` prefers the generated front image (absolute URLs already, so no `base` prefix):

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProductBySlug((await params).slug);
  if (!data) return { title: 'Product not found' };
  const lead = primaryImage(data.images);
  return {
    title: data.product.name,
    description: data.product.tagline,
    openGraph: {
      title: data.product.name,
      description: data.product.tagline,
      images: [lead?.url ?? data.product.imagePath],
    },
  };
}
```

3. Destructure `images` and use every generated URL in the JSON-LD. Replace the `const { product, … } = data;` line and the `image:` line of `jsonLd`:

```ts
const { product, variants, rating, images, collections, reviews } = data;
const related = await listRelatedProducts(product, 4);
const base = getServerEnv().SITE_URL;
```

```ts
    image: images.length ? images.map((i) => i.url) : [`${base}${product.imagePath}`],
```

4. Replace the whole image column (the `<div className="bg-foam relative overflow-hidden rounded-3xl">` block) with the gallery plus an overlay for the badges:

```tsx
<div className="relative">
  <ProductGallery images={images} fallback={{ src: product.imagePath, alt: product.name }} />
  <div className="pointer-events-none absolute top-4 left-4 z-20 flex gap-2">
    {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
    {product.featured ? <Badge tone="copper">Staff pick</Badge> : null}
  </div>
</div>
```

The badges stay server-rendered (no client cost) and sit above the gallery's own controls at `z-20`.

- [ ] **Step 6: Verify and commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit
pnpm build
```

Expected: build succeeds; the PDP is still dynamic. With an empty manifest the page renders exactly as before (fallback branch), so `pnpm test:e2e` stays green — run it if you want the proof now, otherwise Task 8 runs it.

```bash
git add -A
git commit -m "feat: add a product image gallery with thumbnails, arrows, keyboard and swipe"
```

---

### Task 7: Card hover swap, collection hero, homepage hero and story, guide covers, `next.config.ts`

**Files:**

- Create: `src/components/product/collection-hero.tsx`
- Modify: `src/components/product/product-card.tsx`, `src/components/marketing/hero.tsx`, `src/components/marketing/story.tsx`, `src/components/marketing/brew-guides-teaser.tsx`
- Modify: `src/app/(shop)/collections/[slug]/page.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/brew-guides/[slug]/page.tsx`
- Modify: `next.config.ts`

**Interfaces:**

- Consumes: `ProductCardData.images` + `primaryImage` / `hoverImage` (Task 5); `Collection.heroImageUrl` / `heroImageAlt` (Task 4); `homeImage` / `guideImage` from `@/lib/images/content` (Task 4).
- Produces:
  - `src/components/product/collection-hero.tsx`: `CollectionHero({ collection }: { collection: Collection }): JSX.Element | null` — renders nothing when `heroImageUrl` is null; `data-testid="collection-hero"`
  - `src/components/marketing/hero.tsx`: `Hero({ featured, image }: { featured: ProductCardData[]; image?: ManifestImage | null })` — `data-testid="hero-image"` when the generated image is used, otherwise the existing SVG collage
  - `src/components/marketing/story.tsx`: `Story({ image }: { image?: ManifestImage | null })` — `data-testid="story-image"`
  - `src/components/product/product-card.tsx`: `data-testid` `card-image` and `card-image-hover`
  - Brew guide covers: `data-testid` `guide-teaser-cover` (teaser card) and `guide-cover` (guide page)
  - `next.config.ts`: `images.remotePatterns` allows `https://cofresso.com/assets/**`; `images.formats = ['image/webp', 'image/avif']`

- [ ] **Step 1: Allow the CDN host in `next.config.ts`**

Replace the `images` block:

```ts
  images: {
    // Product art is local SVG, served as-is.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/webp', 'image/avif'],
    // Generated photography lives in the CDN-backed assets bucket, served by
    // the same load balancer under /assets/* (see infra/loadbalancer.tf).
    remotePatterns: [
      { protocol: 'https', hostname: 'cofresso.com', pathname: '/assets/**' },
    ],
  },
```

Known trade-off to keep in mind: the optimizer running in Cloud Run fetches these URLs back through the public load balancer. That is one cached round trip per source image per size, and it buys the responsive `sizes` behaviour the spec asks for. If egress ever matters, add `unoptimized` at the call sites rather than removing the remote pattern.

- [ ] **Step 2: Product card — front image with a CSS-only lifestyle hover swap**

`src/components/product/product-card.tsx` — replace the import line and the `<Link>` image block:

```ts
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { roastLabel } from '@/lib/catalog/labels';
import {
  hoverImage,
  lowestPriceCents,
  primaryImage,
  type ProductCardData,
} from '@/lib/catalog/types';
```

```tsx
const { product, variants, rating, images } = data;
```

```tsx
<Link
  href={`/products/${product.slug}`}
  className="bg-foam relative block overflow-hidden rounded-2xl"
>
  {lead ? (
    <div className="relative aspect-[4/5] w-full">
      <Image
        src={lead.url}
        alt={lead.alt}
        fill
        sizes="(min-width: 1024px) 25vw, 50vw"
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        data-testid="card-image"
      />
      {hover ? (
        <Image
          src={hover.url}
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          data-testid="card-image-hover"
        />
      ) : null}
    </div>
  ) : (
    <Image
      src={product.imagePath}
      alt={product.name}
      width={600}
      height={750}
      unoptimized
      priority={priority}
      className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
      data-testid="card-image"
    />
  )}
  <div className="absolute top-3 left-3 z-10 flex gap-2">
    {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
    {onSale ? <Badge tone="copper">Sale</Badge> : null}
    {soldOut ? <Badge tone="espresso">Sold out</Badge> : null}
  </div>
</Link>
```

Add the two selectors next to the existing `soldOut` / `cheapest` / `onSale` computations:

```tsx
const lead = primaryImage(images);
const hover = hoverImage(images);
```

The SVG fallback keeps its intrinsic 600×750 sizing; the photo branch uses a fixed `aspect-[4/5]` frame so a grid can mix square `front` photos and 4:5 SVGs without the rows jumping. The swap is pure CSS — no `useState`, so the card stays a server component.

- [ ] **Step 3: Collection hero component**

`src/components/product/collection-hero.tsx`:

```tsx
import Image from 'next/image';
import type { Collection } from '@/lib/db/schema';

/**
 * Image-only banner. The page keeps ownership of the `<h1>` (and of the
 * `collection-title` test id), so there is exactly one heading per page.
 */
export function CollectionHero({ collection }: { collection: Collection }) {
  if (!collection.heroImageUrl) return null;
  return (
    <div
      className="bg-foam relative mb-8 aspect-[16/6] w-full overflow-hidden rounded-3xl"
      data-testid="collection-hero"
    >
      <Image
        src={collection.heroImageUrl}
        alt={collection.heroImageAlt ?? `Cofresso ${collection.name} collection`}
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />
      <div
        className="from-espresso/40 absolute inset-0 bg-gradient-to-t to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
```

- [ ] **Step 4: Render the hero on the collection page**

`src/app/(shop)/collections/[slug]/page.tsx` — add the import and one line inside the `<Container>`:

```ts
import { CollectionHero } from '@/components/product/collection-hero';
```

```tsx
    <Container className="py-12">
      <CollectionHero collection={collection} />
      <div className="mb-8 max-w-2xl">
```

- [ ] **Step 5: Homepage hero and story images**

`src/components/marketing/hero.tsx` — change the signature and the right-hand column:

```tsx
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import type { ProductCardData } from '@/lib/catalog/types';
import type { ManifestImage } from '@/lib/images/manifest';

export function Hero({
  featured,
  image,
}: {
  featured: ProductCardData[];
  image?: ManifestImage | null;
}) {
  const [a, b, c] = featured;
```

Replace the collage `<div>` with:

```tsx
{
  image ? (
    <div
      className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl shadow-2xl"
      data-testid="hero-image"
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
        className="object-cover"
      />
    </div>
  ) : (
    <div className="relative mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3">
      {[b, a, c].filter(Boolean).map((item, i) => (
        <Image
          key={item.product.id}
          src={item.product.imagePath}
          alt={item.product.name}
          width={300}
          height={375}
          unoptimized
          priority
          className={i === 1 ? 'scale-110 drop-shadow-2xl' : 'opacity-90 drop-shadow-xl'}
        />
      ))}
    </div>
  );
}
```

`src/components/marketing/story.tsx` — change the signature and the image column:

```tsx
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import type { ManifestImage } from '@/lib/images/manifest';

export function Story({ image }: { image?: ManifestImage | null }) {
```

```tsx
<div className="flex justify-center">
  {image ? (
    <div
      className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl"
      data-testid="story-image"
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  ) : (
    <Image
      src="/logo.png"
      alt="Cofresso double-bean mark"
      width={260}
      height={260}
      className="drop-shadow-2xl"
    />
  )}
</div>
```

`src/app/(marketing)/page.tsx` — import the accessor and pass both images:

```ts
import { homeImage } from '@/lib/images/content';
```

```tsx
<Hero featured={featured} image={homeImage('hero')} />
```

```tsx
<Container className="pb-20">
  <Story image={homeImage('story')} />
</Container>
```

- [ ] **Step 6: Brew-guide covers**

`src/components/marketing/brew-guides-teaser.tsx` — add the cover above the eyebrow:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/icons';
import { brewGuides } from '@/lib/content/brew-guides';
import { guideImage } from '@/lib/images/content';

export function BrewGuidesTeaser() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="brew-guides-teaser">
      {brewGuides.map((g) => {
        const cover = guideImage(g.slug);
        return (
          <Link
            key={g.slug}
            href={`/brew-guides/${g.slug}`}
            className="group border-latte/30 bg-foam hover:border-copper rounded-2xl border p-6 transition-colors"
          >
            {cover ? (
              <div
                className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-xl"
                data-testid="guide-teaser-cover"
              >
                <Image
                  src={cover.url}
                  alt={cover.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            ) : null}
            <p className="text-latte text-xs font-semibold tracking-[0.2em] uppercase">
              {g.method}
            </p>
            <h3 className="mt-2 text-xl">{g.title}</h3>
            <p className="text-latte mt-2 text-sm">{g.summary}</p>
            <p className="text-espresso/70 mt-4 text-sm">
              {g.ratio.split(' (')[0]} · {g.totalTime}
            </p>
            <span className="text-copper-dark mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Read guide{' '}
              <IconArrowRight
                width={16}
                height={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
```

`src/app/(marketing)/brew-guides/[slug]/page.tsx` — add the import and a banner at the top of the `<article>`:

```ts
import Image from 'next/image';
import { guideImage } from '@/lib/images/content';
```

```tsx
const guide = getBrewGuide(slug);
if (!guide) notFound();
const cover = guideImage(slug);
```

```tsx
        <article>
          {cover ? (
            <div
              className="bg-foam relative mb-8 aspect-[3/2] w-full overflow-hidden rounded-3xl"
              data-testid="guide-cover"
            >
              <Image
                src={cover.url}
                alt={cover.alt}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                priority
                className="object-cover"
              />
            </div>
          ) : null}
          <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
            {guide.method}
          </p>
```

- [ ] **Step 7: Verify and commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit
pnpm build && pnpm test:e2e
```

Expected: the existing e2e suite is unchanged and green — with an empty manifest every new branch is skipped, and with a populated one the assertions the old specs make (`hero` visible, 18 product cards, `collection-title` text, `guide-title`) still hold because no test id was reused or removed.

```bash
git add -A
git commit -m "feat: show generated imagery on cards, collections, the home page and brew guides"
```

---

### Task 8: End-to-end coverage and documentation

**Files:**

- Create: `tests/e2e/imagery.spec.ts`
- Modify: `README.md`, `AGENTS.md`, `docs/architecture.md`

**Interfaces:**

- Consumes: the DOM contract from Tasks 6 and 7 (`gallery`, `gallery-main`, `gallery-thumb-<n>`, `gallery-next`, `collection-hero`, `card-image`, `hero-image`, `guide-cover`); `content/images.manifest.json` read straight off disk (no `@/` alias, so Playwright needs no path mapping).
- Produces: `tests/e2e/imagery.spec.ts` — every test self-skips when the manifest has no entry for what it asserts, so the suite is green both before and after the paid generation run; documentation covering how to regenerate imagery, what the manifest is, and how the CDN path works.

- [ ] **Step 1: Write the e2e spec**

`tests/e2e/imagery.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ManifestEntry {
  url: string;
  alt: string;
  kind?: string;
}

interface Manifest {
  products: Record<string, ManifestEntry[]>;
  collections: Record<string, ManifestEntry>;
  home: Record<string, ManifestEntry>;
  guides: Record<string, ManifestEntry>;
}

const manifest: Manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), 'content/images.manifest.json'), 'utf8'),
) as Manifest;

const PRODUCT_SLUG = 'morning-frame';
const COLLECTION_SLUG = 'blends';
const productImages = manifest.products[PRODUCT_SLUG] ?? [];

/** Filenames are content-addressed, so the tail identifies the image even inside /_next/image?url=… */
function filename(url: string): string {
  return url.split('/').pop() ?? url;
}

test.describe('generated imagery', () => {
  test('the product gallery shows four thumbnails and swaps the main image', async ({ page }) => {
    test.skip(productImages.length < 4, 'no generated imagery in the manifest yet');

    await page.goto(`/products/${PRODUCT_SLUG}`);
    const gallery = page.getByTestId('gallery');
    await expect(gallery).toBeVisible();
    await expect(gallery).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(page.getByTestId(/^gallery-thumb-/)).toHaveCount(4);

    const main = page.getByTestId('gallery-main');
    const first = await main.getAttribute('src');
    expect(first).toContain(filename(productImages[0].url));

    await page.getByTestId('gallery-thumb-1').click();
    await expect(main).not.toHaveAttribute('src', first!);
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[1].url)));

    await gallery.focus();
    await page.keyboard.press('ArrowRight');
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[2].url)));

    await page.getByTestId('gallery-prev').click();
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[1].url)));
  });

  test('the collection hero renders', async ({ page }) => {
    test.skip(!manifest.collections[COLLECTION_SLUG], 'no collection hero in the manifest yet');

    await page.goto(`/collections/${COLLECTION_SLUG}`);
    await expect(page.getByTestId('collection-hero')).toBeVisible();
    // Exactly one heading: the hero is image-only.
    await expect(page.getByTestId('collection-title')).toHaveCount(1);
    await expect(page.getByTestId('collection-title')).toHaveText('Blends');
  });

  test('the home page and brew guides use their generated images', async ({ page }) => {
    test.skip(!manifest.home.hero, 'no home imagery in the manifest yet');

    await page.goto('/');
    await expect(page.getByTestId('hero-image')).toBeVisible();
    await expect(page.getByTestId('story-image')).toBeVisible();

    const guideSlug = Object.keys(manifest.guides)[0];
    test.skip(!guideSlug, 'no guide covers in the manifest yet');
    await page.goto(`/brew-guides/${guideSlug}`);
    await expect(page.getByTestId('guide-cover')).toBeVisible();
  });

  test('product cards render the generated front image', async ({ page }) => {
    test.skip(productImages.length === 0, 'no generated imagery in the manifest yet');

    await page.goto('/shop');
    const card = page
      .getByTestId('product-card')
      .filter({ has: page.locator('h3') })
      .first();
    await expect(card.getByTestId('card-image').first()).toBeVisible();
  });

  test('every manifest image is served from the CDN', async ({ request }) => {
    const urls = [
      ...Object.values(manifest.products).flat(),
      ...Object.values(manifest.collections),
      ...Object.values(manifest.home),
      ...Object.values(manifest.guides),
    ].map((entry) => entry.url);
    test.skip(urls.length === 0, 'no generated imagery in the manifest yet');

    // A sample keeps the suite fast; the generation script already verified
    // every upload, and a missing object would fail the gallery test above.
    for (const url of urls.slice(0, 5)) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toBe('image/webp');
      expect(res.headers()['cache-control']).toContain('max-age=31536000');
    }
  });
});
```

Notes:

- `page.getByTestId(/^gallery-thumb-/)` works because `playwright.config.ts` leaves `testIdAttribute` at its default (`data-testid`) and `getByTestId` accepts a `RegExp`.
- `request.get(url)` with an absolute URL bypasses `baseURL`, so this test hits the real CDN. That is what the spec asks for; the objects are public, so no auth is involved.

- [ ] **Step 2: Run the full verification gate**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration
pnpm build && pnpm test:e2e
```

Expected: all four unit/integration suites pass; Playwright reports the pre-existing specs as passed and the five new ones as either passed (manifest populated) or skipped (manifest empty). A **failed** imagery test with a populated manifest means the CDN path or the manifest is out of step — check `curl -I` on the URL from the failure message before touching the component.

- [ ] **Step 3: README — scripts table and a new section**

Add one row to the scripts table in `README.md`, after `art:generate`:

```markdown
| `pnpm images:generate` | Regenerate photography with the OpenAI Images API (see below) |
```

Then add this section immediately after "Scripts":

````markdown
## Product imagery

Photography is generated once, not at request time. `scripts/generate-images.ts` builds a
deterministic prompt per image from `src/lib/db/seed/data.ts` and `src/content/brew-guides`,
calls the OpenAI Images API, converts to WebP (longest edge 1600 px, quality 80), uploads to
`gs://cofresso-prod-assets` under a content-addressed name, and records the result in
`content/images.manifest.json`.

That manifest is the source of truth. `pnpm db:seed` reads it to fill `product_images` and
`collections.hero_image_url`; the homepage, brew-guide and collection images are read from it
directly through `src/lib/images/content.ts`. A missing entry is not an error — the product
falls back to its SVG art in `public/products/`.

Objects are served by the same load balancer that fronts Cloud Run: `/assets/*` routes to a
CDN-backed backend bucket, so a URL looks like
`https://cofresso.com/assets/products/morning-frame/morning-frame-front-1a2b3c4d.webp` and is
cached for a year (`Cache-Control: public, max-age=31536000, immutable`). Because names carry a
content hash, a regenerated image gets a new URL and never needs a cache purge.

To regenerate:

```bash
export OPENAI_API_KEY=...                                    # or .superpowers/sdd/images/.env
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)

pnpm images:generate --dry-run                # what would be generated, no cost
pnpm images:generate --only morning-frame     # one product (4 images)
pnpm images:generate                          # everything missing from the manifest
pnpm images:generate --only morning-frame --force   # replace existing entries
pnpm db:seed                                  # push the manifest into the database
```

A full run is 82 images, roughly $16 and 10–20 minutes at concurrency 6. Commit the updated
`content/images.manifest.json`; never commit the API key.
````

- [ ] **Step 4: AGENTS.md — conventions and locations**

In the "Ground rules" list, after the "Schema changes ship with a migration" bullet, add:

```markdown
- **Imagery is generated, not uploaded.** `content/images.manifest.json` is the source of truth for photography: `pnpm db:seed` upserts it into `product_images` / `collections.hero_image_url`, and `src/lib/images/content.ts` serves the homepage and guide images from it. Regenerate with `pnpm images:generate` (needs `OPENAI_API_KEY`; see the README), commit the manifest, and never hand-edit it. A product with no manifest entry falls back to its SVG in `public/products/`. Public URLs are `https://cofresso.com/assets/...`, served by a CDN-backed GCS bucket, content-addressed and immutable.
```

In the "Where things live" table, add two rows:

```markdown
| `src/lib/images` | Manifest schema, prompts, alt text, generation orchestration, gallery math |
| `content/images.manifest.json` | Generated imagery manifest (committed; written by `pnpm images:generate`) |
```

And in "Common tasks", extend the "Add a product" entry and add a new one:

```markdown
- **Add a product:** edit `src/lib/db/seed/data.ts`, run `pnpm art:generate` (SVG fallback), `pnpm images:generate --only <slug>` (photography) and `pnpm db:seed`.
- **Regenerate one image:** `pnpm images:generate --only <slug> --force`, then `pnpm db:seed`. Commit the manifest change.
```

- [ ] **Step 5: docs/architecture.md — the request flow and the domain**

Replace the "Request flow" first line:

```markdown
Browser → Global HTTPS load balancer (Google-managed cert, Cloud CDN for `/_next/static`) → Cloud Run `cofresso-web` → Cloud SQL Postgres via the Cloud SQL Unix socket.
```

with:

```markdown
Browser → Global HTTPS load balancer (Google-managed cert, Cloud CDN for `/_next/static`) → Cloud Run `cofresso-web` → Cloud SQL Postgres via the Cloud SQL Unix socket.

`/assets/*` is the one exception: the URL map sends it to a CDN-backed backend bucket over `gs://cofresso-prod-assets`, which holds the generated product photography. Objects are content-addressed WebP with a one-year immutable cache, so they never hit Cloud Run.
```

And extend the "Catalog" bullet under "Domain":

```markdown
- **Catalog:** `products` → `product_variants` (size, price, stock); `collections` via `product_collections`; `reviews`; `product_images` (one row per product and kind: `front`, `detail`, `lifestyle`, `packaging`), seeded from `content/images.manifest.json` alongside `collections.hero_image_url`.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/joshpayne/worktrees/cofresso.com/feat-product-imagery
pnpm format
pnpm lint && pnpm typecheck
git add -A
git commit -m "test: cover the product gallery, collection hero and CDN assets end to end"
```

Then a second commit for the prose, so the docs are reviewable on their own:

```bash
git add README.md AGENTS.md docs/architecture.md
git commit -m "docs: document image regeneration, the manifest and the CDN asset path"
```

If Step 6's first `git add -A` already swept the docs in, skip the second commit — one commit is fine, the message must then be `feat: add imagery e2e coverage and documentation`.

---

## Self-review notes

**Spec coverage.** Every line of the design maps to a task:

| Spec section                                                                                                                                                                                                          | Where     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Bucket, `allUsers` read, backend bucket + CDN policy, URL map, applier IAM, `assets_base_url`                                                                                                                         | Task 1    |
| Style guide + per-kind prompts, sizes, `art.accent` label colour, deterministic alt text                                                                                                                              | Task 2    |
| Script, model resolution, sharp pipeline, content-addressed upload, `Cache-Control`, concurrency 6, 3 retries on 429/5xx, `--only` / `--dry-run` / `--force`, manifest write                                          | Task 3    |
| `product_images` (+ unique `(product_id, kind)`), `collections.hero_image_*`, migration `0002_product_images`, seed from the manifest                                                                                 | Task 4    |
| `ProductCardData.images`, `getProductBySlug` images, collection hero fields on `listCollections` / `getCollectionBySlug`                                                                                              | Task 5    |
| `ProductGallery` (thumbnails, arrows, keyboard, swipe, `aria-roledescription`, test ids, SVG fallback)                                                                                                                | Task 6    |
| Card hover swap, collection hero banner, home hero + story, guide covers, `remotePatterns` + `formats`                                                                                                                | Task 7    |
| Unit tests (manifest schema, alt text, gallery math), component test, integration tests (seed + position order), e2e (4 thumbnails, second thumbnail changes `src`, arrow key advances, hero renders, `/assets/` 200) | Tasks 2–8 |

**Type consistency across tasks.** `IMAGE_KINDS` / `ImageKind` are declared once (Task 2, `schema/values.ts`) and reused by the Zod enum, the pg enum (Task 4), the DB row type, the query layer (Task 5) and the gallery (Task 6). `ManifestImage` (Task 2) is the prop type for the home, story and guide images (Task 7). `ProductImage` (Task 4) is structurally assignable to `GalleryImage` (Task 6), so the PDP passes `data.images` with no mapping. `ProductCardData` gains `images` in Task 5 before any component reads it in Tasks 6–7; nothing else in the repo constructs a `ProductCardData` literal, so no fixtures need patching. `contentImages()` (Task 4) is the only module that imports the JSON, and both the seed (Task 4) and the UI (Task 7) go through it, so the esbuild bundle and the Next build inline exactly one copy.

**Judgement calls worth a reviewer's attention.**

- The seed _reconciles_ `product_images` (deleting kinds the manifest no longer lists) rather than only upserting, so a regenerated set never leaves orphan rows pointing at deleted objects.
- The collection hero is image-only; the page keeps the `<h1>` and the `collection-title` test id, which avoids two elements sharing one test id and breaking the existing `shop.spec.ts`.
- `next/image` is mocked in the gallery component test. jsdom has neither Next's build-time image config nor a configured remote host, and the test is about carousel behaviour, not the optimizer.
- Photos render inside fixed-aspect frames with `object-cover` (`4/5` on cards, `square` on the PDP main image, `16/6` and `3/2` on banners) because generated sizes are mixed (1024² and 1536×1024) and the SVG fallback is 600×750. The alternative — `object-contain` on cream — was rejected as visually weaker for an editorial look.
- `--dry-run` is handled before any client is constructed, so it needs no credentials at all; that is what makes it usable as the CI-safe smoke check in Task 3, Step 10.
