# Cofresso

Specialty coffee storefront. Production-grade Next.js codebase used by [Coframe](https://coframe.com) as a sandbox for coding-agent and web-optimization tooling. Live at [cofresso.com](https://cofresso.com).

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM + Postgres 16 · Zod · Vitest · Playwright · Docker · Cloud Run · Terraform · GitHub Actions

## Local development

```bash
pnpm install
cp .env.example .env.local
docker compose up -d          # Postgres 16 on :5432 (+ cofresso_test database)
pnpm db:migrate && pnpm db:seed
pnpm dev                      # http://localhost:3000
```

## Scripts

| Script                                     | What it does                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`             | Next.js                                                                                 |
| `pnpm lint` / `lint:fix` / `format`        | ESLint + Prettier                                                                       |
| `pnpm typecheck`                           | `tsc --noEmit`                                                                          |
| `pnpm test:unit`                           | Vitest unit + component tests (`src/**/*.test.ts(x)`)                                   |
| `pnpm test:integration`                    | Vitest against Postgres (`tests/integration`, uses `TEST_DATABASE_URL`)                 |
| `pnpm test:e2e`                            | Playwright against a built app (`pnpm build` first)                                     |
| `pnpm db:generate`                         | Generate a migration from schema changes                                                |
| `pnpm db:migrate` / `db:seed` / `db:reset` | Apply migrations / upsert catalog / drop + migrate + seed (needs `ALLOW_DB_RESET=true`) |
| `pnpm db:studio`                           | Drizzle Studio                                                                          |
| `pnpm art:generate`                        | Regenerate product SVGs from seed data                                                  |
| `pnpm images:generate`                     | Regenerate photography with the OpenAI Images API (see below)                           |
| `pnpm build:db`                            | Bundle the db CLI for the Docker image                                                  |

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
`https://cofresso.com/assets/products/morning-frame/morning-frame-front-1a2b3c4d.webp`. The
uploaded object's own metadata sets `Cache-Control: public, max-age=31536000, immutable`, and
Cloud CDN's edge cache can hold it that long (`max_ttl`), but the assets backend bucket's CDN
policy also sets a one-day `client_ttl`, which is what the CDN actually rewrites into the
response a browser sees — `curl -I` against a live URL shows `max-age=86400`. Because names carry
a content hash, a regenerated image gets a new URL and never needs a cache purge either way. In
the bucket itself the object lives under an `assets/` prefix
(`gs://cofresso-prod-assets/assets/products/...`), because the load balancer's backend bucket
forwards the full request path through to Cloud Storage — `bucketObjectName()` in
`src/lib/images/paths.ts` adds that prefix when uploading.

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

If only alt text logic changed (`src/lib/images/alt.ts`), there is no need to regenerate any
photography: `pnpm images:generate --refresh-alt` recomputes `alt` for every entry already in the
manifest from the current seed/content data and rewrites `content/images.manifest.json` in place.
It never calls OpenAI or GCS, so it needs neither `OPENAI_API_KEY` nor
`GOOGLE_OAUTH_ACCESS_TOKEN`, and it never adds or removes an entry — only `alt` strings change.

## Interruptions

The storefront deliberately gets in your way, because real ones do and Coframe uses this app to
exercise computer-use QA agents. Six elements, all keyboard-accessible, all dismissible, and none
of them allowed anywhere near checkout:

| Element               | Behaviour                                                                        |
| --------------------- | -------------------------------------------------------------------------------- |
| Email capture popup   | 10% off, 8s after landing or on exit intent; never on `/checkout*` or `/orders*` |
| Cookie consent banner | Accept / reject / manage; also gates the Coframe SDK slot on analytics consent   |
| Live chat bubble      | Three scripted questions, a typing indicator and an unread badge after 30s       |
| Social-proof toasts   | "Someone in Portland just bought …", three per session, bottom-left              |
| Announcement rotator  | Three messages every 6s, one counting down to local midnight                     |
| Deferred sections     | Reviews and related products render only once scrolled near                      |

Timings and toggles live in [`src/lib/interruptions/config.ts`](src/lib/interruptions/config.ts).
Set `UX_INTERRUPTIONS=off` in the server env to remove all of them from the page — useful when
you want to demo or measure the storefront without them. The Playwright suite runs with them
**on** and clears them through the `dismissInterruptions` helper, the way a visitor would.

The kill switch is not a consent decision, so it does not lift the consent gate on the Coframe
SDK slot: with interruptions off there is no banner, and a gated SDK will therefore not load.
Set `gateSdkOnAnalytics: false` in the config if you need the SDK during a no-interruptions demo.

## Project layout

See [docs/architecture.md](docs/architecture.md). Conventions for contributors and agents live in [AGENTS.md](AGENTS.md).

## Deployment

Every PR gets a preview URL (posted as a comment). Merging to `main` deploys production. Infra is Terraform in [`infra/`](infra/); pipelines are in [`.github/workflows`](.github/workflows). Runbooks: [docs/runbooks](docs/runbooks).

## Test cards

The payment provider is simulated. `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` declines; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0119` processing error.

---

The beans are open source: <https://github.com/coframe/coffee>
