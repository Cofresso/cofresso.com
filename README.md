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
| `pnpm build:db`                            | Bundle the db CLI for the Docker image                                                  |

## Project layout

See [docs/architecture.md](docs/architecture.md). Conventions for contributors and agents live in [AGENTS.md](AGENTS.md).

## Deployment

Every PR gets a preview URL (posted as a comment). Merging to `main` deploys production. Infra is Terraform in [`infra/`](infra/); pipelines are in [`.github/workflows`](.github/workflows). Runbooks: [docs/runbooks](docs/runbooks).

## Test cards

The payment provider is simulated. `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` declines; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0119` processing error.

---

The beans are open source: <https://github.com/coframe/coffee>
