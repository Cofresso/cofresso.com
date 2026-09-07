# Working in this repository

This file is for humans and coding agents alike. Read it before changing code.

## What this is

Cofresso is an ecommerce storefront for a fictional coffee roaster. It is a real, deployed application (Cloud Run + Postgres) that Coframe uses to test tooling. Treat it like a customer's production codebase.

## Ground rules

- **Money is integer cents.** Never floats. Formatting happens only in `formatPrice`.
- **Reads go through query modules.** `src/lib/db/queries` for catalog and newsletter, `src/lib/cart/queries.ts` for the cart, `src/lib/checkout/queries.ts` for orders. Server components call query functions. Client components never import `src/lib/db/client`.
- **Writes are server actions** validated with Zod and returning `ActionResult<T>` (`src/lib/action-result.ts`). Cart actions live in `src/lib/cart/actions.ts`; other actions live in `actions.ts` next to their route.
- **Pure logic stays pure.** Pricing (`src/lib/pricing`), payments (`src/lib/payments`) and schemas have no I/O and are unit tested.
- **Schema changes ship with a migration.** Edit `src/lib/db/schema/*`, run `pnpm db:generate`, commit the new file under `drizzle/` in the same PR. Never edit an applied migration.
- **Imagery is generated, not uploaded.** `content/images.manifest.json` is the source of truth for photography: `pnpm db:seed` upserts it into `product_images` / `collections.hero_image_url`, and `src/lib/images/content.ts` serves the homepage and guide images from it. Regenerate with `pnpm images:generate` (needs `OPENAI_API_KEY`; see the README), commit the manifest, and never hand-edit it. A product with no manifest entry falls back to its SVG in `public/products/`. Public URLs are `https://cofresso.com/assets/...`, served by a CDN-backed GCS bucket, content-addressed and immutable.
- **Every page is dynamic.** The root layout sets `dynamic = 'force-dynamic'` so `next build` never needs a database.
- **No secrets in the repo.** Server env is validated in `src/lib/env.ts`. Add new variables there and to `.env.example`.
- **Card data never touches the database or logs.** Only `card_last4` and the provider reference are stored. Never log a drizzle error either — its `message` embeds the statement and every bound parameter; log `describeDbError(err)` from `src/lib/db/errors.ts` plus the ids you need.
- **Payment authorization happens inside the `placeOrder` transaction**, while the variant rows are locked `FOR UPDATE`. That is safe with the simulated provider because it never does I/O. When a real gateway replaces it, either give `authorize` a hard timeout or move authorization out of the lock window — a slow gateway would otherwise hold row locks on the affected variants and stall every other checkout for the same product.
- **Tests accompany changes.** Unit tests next to the code (`*.test.ts`), integration tests in `tests/integration`, end-to-end in `tests/e2e`. Prefer `data-testid` hooks for e2e selectors.
- **The interruptions are a feature, not clutter.** The email popup, cookie banner, chat bubble, social-proof toasts, rotating announcement bar and lazily revealed sections exist so this app exercises computer-use QA agents the way a real storefront does. Every one of them is keyboard-accessible and dismissible, and none may appear on `/checkout*` or `/orders*`. Timings live in `src/lib/interruptions/config.ts`; `UX_INTERRUPTIONS=off` in the server env removes all of them. The e2e suite runs with them **on** — call `dismissInterruptions(page)` from `tests/e2e/helpers.ts` after the first navigation a spec interacts with rather than turning them off.
- **Conventional Commits** for commit messages and PR titles (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:`).

## Where things live

| Path                                                                | Purpose                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app`                                                           | Routes. Route groups: `(marketing)`, `(shop)`, `(checkout)`, plus `api/`             |
| `src/components/ui`                                                 | Presentational primitives (Button, Input, Sheet, …)                                  |
| `src/components/{layout,product,cart,checkout,marketing,analytics}` | Domain components                                                                    |
| `src/components/interruptions`                                      | Popup, cookie banner, chat bubble, toasts, announcement rotator, `Deferred`          |
| `src/lib/db`                                                        | Drizzle client, schema, catalog/newsletter queries, error helpers, seed              |
| `src/lib/pricing` `payments` `cart` `checkout`                      | Domain logic; `cart/queries.ts` and `checkout/queries.ts` hold their own reads       |
| `src/lib/interruptions`                                             | Interruption config, consent/suppression/toast/countdown helpers, chat script        |
| `src/lib/analytics`                                                 | Typed events + `track()`; SDK slot in `components/analytics/third-party-scripts.tsx` |
| `src/lib/images`                                                    | Manifest schema, prompts, alt text, generation orchestration, gallery math           |
| `src/content`                                                       | Brew guides and FAQ as typed data                                                    |
| `content/images.manifest.json`                                      | Generated imagery manifest (committed; written by `pnpm images:generate`)            |
| `scripts/`                                                          | `db.ts` CLI (bundled to `dist/db.mjs` for the image), product art generator          |
| `drizzle/`                                                          | Migrations                                                                           |
| `tests/`                                                            | Integration and e2e tests                                                            |
| `infra/`                                                            | Terraform for GCP                                                                    |
| `.github/`                                                          | CI/CD                                                                                |
| `docs/`                                                             | Architecture, runbooks, specs and plans                                              |

## Common tasks

- **Add a product:** edit `src/lib/db/seed/data.ts`, run `pnpm art:generate` (SVG fallback), `pnpm images:generate --only <slug>` (photography) and `pnpm db:seed`.
- **Regenerate one image:** `pnpm images:generate --only <slug> --force`, then `pnpm db:seed`. Commit the manifest change.
- **Add a page:** create `page.tsx` under the right route group; add it to `src/app/sitemap.ts` if public.
- **Change pricing rules:** edit `src/lib/pricing`, update `src/lib/pricing/index.test.ts` first.
- **Add an analytics event:** extend the union in `src/lib/analytics/events.ts`; call `track()` from a client component.
- **Change an interruption's timing:** edit `src/lib/interruptions/config.ts`. Tests fast-forward `page.clock` rather than shortening the config, so no test needs updating.
- **Verify before you finish:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`, and `pnpm build && pnpm test:e2e` for UI changes.

## Deployment model

PRs deploy a zero-traffic revision to the `cofresso-web-preview` Cloud Run service (URL in the PR comment). Merges to `main` migrate and deploy `cofresso-web`. See `docs/runbooks`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
