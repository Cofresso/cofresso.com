# Working in this repository

This file is for humans and coding agents alike. Read it before changing code.

## What this is

Cofresso is an ecommerce storefront for a fictional coffee roaster. It is a real, deployed application (Cloud Run + Postgres) that Coframe uses to test tooling. Treat it like a customer's production codebase.

## Ground rules

- **Money is integer cents.** Never floats. Formatting happens only in `formatPrice`.
- **Reads go through `src/lib/db/queries`.** Server components call query functions. Client components never import `src/lib/db/client`.
- **Writes are server actions** validated with Zod and returning `ActionResult<T>` (`src/lib/action-result.ts`). Cart actions live in `src/lib/cart/actions.ts`; other actions live in `actions.ts` next to their route.
- **Pure logic stays pure.** Pricing (`src/lib/pricing`), payments (`src/lib/payments`) and schemas have no I/O and are unit tested.
- **Schema changes ship with a migration.** Edit `src/lib/db/schema/*`, run `pnpm db:generate`, commit the new file under `drizzle/` in the same PR. Never edit an applied migration.
- **Every page is dynamic.** The root layout sets `dynamic = 'force-dynamic'` so `next build` never needs a database.
- **No secrets in the repo.** Server env is validated in `src/lib/env.ts`. Add new variables there and to `.env.example`.
- **Card data never touches the database or logs.** Only `card_last4` and the provider reference are stored.
- **Tests accompany changes.** Unit tests next to the code (`*.test.ts`), integration tests in `tests/integration`, end-to-end in `tests/e2e`. Prefer `data-testid` hooks for e2e selectors.
- **Conventional Commits** for commit messages and PR titles (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:`).

## Where things live

| Path                                                                | Purpose                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app`                                                           | Routes. Route groups: `(marketing)`, `(shop)`, `(checkout)`, plus `api/`             |
| `src/components/ui`                                                 | Presentational primitives (Button, Input, Sheet, …)                                  |
| `src/components/{layout,product,cart,checkout,marketing,analytics}` | Domain components                                                                    |
| `src/lib/db`                                                        | Drizzle client, schema, queries, seed                                                |
| `src/lib/pricing` `payments` `cart` `checkout`                      | Domain logic                                                                         |
| `src/lib/analytics`                                                 | Typed events + `track()`; SDK slot in `components/analytics/third-party-scripts.tsx` |
| `src/content`                                                       | Brew guides and FAQ as typed data                                                    |
| `scripts/`                                                          | `db.ts` CLI (bundled to `dist/db.mjs` for the image), product art generator          |
| `drizzle/`                                                          | Migrations                                                                           |
| `tests/`                                                            | Integration and e2e tests                                                            |
| `infra/`                                                            | Terraform for GCP                                                                    |
| `.github/`                                                          | CI/CD                                                                                |
| `docs/`                                                             | Architecture, runbooks, specs and plans                                              |

## Common tasks

- **Add a product:** edit `src/lib/db/seed/data.ts`, run `pnpm art:generate` and `pnpm db:seed`.
- **Add a page:** create `page.tsx` under the right route group; add it to `src/app/sitemap.ts` if public.
- **Change pricing rules:** edit `src/lib/pricing`, update `src/lib/pricing/index.test.ts` first.
- **Add an analytics event:** extend the union in `src/lib/analytics/events.ts`; call `track()` from a client component.
- **Verify before you finish:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`, and `pnpm build && pnpm test:e2e` for UI changes.

## Deployment model

PRs deploy a zero-traffic revision to the `cofresso-web-preview` Cloud Run service (URL in the PR comment). Merges to `main` migrate and deploy `cofresso-web`. See `docs/runbooks`.
