# Cofresso ecommerce sandbox: design

Date: 2026-09-06
Status: approved

## Purpose

Cofresso is a fictional specialty coffee brand. Its website is a realistic,
production-grade ecommerce codebase that Coframe uses as a sandbox for two
things: exercising a coding agent against a codebase that looks like a real
customer's, and testing the Coframe web optimization SDK against real
conversion surfaces (hero, product listing, product page, cart, checkout).

The name is a play on Coframe. The easter egg is https://github.com/coframe/coffee.

Success looks like:

- cofresso.com serves the site over HTTPS from GCP.
- Every pull request gets a live preview URL; merging to main deploys production.
- The codebase has the shape, tests, docs and guardrails a careful team would
  ship, so an agent operating in it faces realistic constraints.
- The full funnel works end to end: browse, product, cart, checkout, order
  confirmation, order lookup.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Data layer | Cloud SQL Postgres 16 + Drizzle ORM with checked-in migrations |
| Payments | Simulated provider behind a `PaymentProvider` interface; test card numbers drive outcomes |
| Environments | PR previews + production; no persistent staging |
| Coframe SDK | Integration point only: typed analytics events + env-gated script slot in root layout |
| Hosting | Cloud Run + global HTTPS load balancer, Terraform in `infra/`, GitHub Actions via Workload Identity Federation |
| Cloud Run scaling | Production keeps one minimum instance so cold starts do not skew web-vitals tests |
| Repo | `cofresso/cofresso.com` on GitHub, public, default branch `main` |

## Known constraints

- The GitHub token in use has push but not admin on the repo. Branch
  protection, environments and CodeQL enablement need admin. The repo will
  ship `docs/github-setup.md` with the exact commands so an admin can apply
  them in one pass. Workflows must not depend on repository secrets; every
  value CI needs (project id, WIF provider, region, service names) is
  non-secret and lives in workflow `env:` blocks or repository variables with
  hardcoded fallbacks.
- cofresso.com nameservers are at Namecheap. Cloud DNS will host the zone and
  the owner switches nameservers once. Until then the site is reachable on
  the Cloud Run URL and the load balancer IP.
- Terraform is not installed locally; it is installed via Homebrew during
  the infra step.
- TypeScript 7 is current on npm. Pin to the TypeScript version that
  `create-next-app` ships to keep eslint and Next tooling compatible.

## Stack

- Next.js 16 (App Router, React 19 server components, server actions),
  TypeScript strict, Tailwind CSS v4, pnpm, Node 22 LTS.
- Drizzle ORM with the `postgres` (postgres.js) driver. Local Postgres via
  Docker Compose. In Cloud Run, connect through the Cloud SQL Unix socket.
- Zod for every external input (forms, search params, env vars).
- Vitest for unit and integration tests, Playwright for end to end, ESLint
  flat config, Prettier.
- Multi-stage Dockerfile built on `node:22-alpine` using Next's `standalone`
  output. Runs as a non-root user, listens on `PORT`.
- Fonts via `next/font` (self-hosted). Product imagery is generated SVG
  coffee-bag art in the brand palette committed to `public/`. No runtime
  dependency on external image hosts.
- Logging: a tiny `lib/logger.ts` that emits one JSON object per line with
  `severity`, `message`, and `logging.googleapis.com/trace` when the
  `X-Cloud-Trace-Context` header is present, so Cloud Logging groups requests.

## Brand

Palette derived from `logo.png` (two offset rounded parallelograms, tan and
dark brown, with a steam swoosh):

| Token | Value | Use |
| --- | --- | --- |
| espresso | `#4A2C24` | primary text, dark surfaces, primary buttons |
| latte | `#A08977` | secondary surfaces, borders, muted text |
| cream | `#F6F1EB` | page background |
| foam | `#FFFDFA` | cards |
| copper | `#C8763A` | accent, CTAs, badges |
| leaf | `#5F7A5A` | success, "in stock" |

Typography: Fraunces (display, serif) and Inter (body). The logo is used as
the mark; the wordmark "Cofresso" is set in Fraunces.

Voice: warm, precise, lightly nerdy. Product names carry gentle developer
puns without being a joke site.

## Domain model

All money is integer cents. All ids are UUIDs unless noted. Timestamps are
`timestamptz` with defaults.

- `products`: id, slug (unique), name, tagline, description, category
  (`coffee` | `equipment` | `merch`), origin, region, producer, altitude_m,
  process, roast_level (`light` | `medium` | `medium_dark` | `dark`),
  tasting_notes text[], image_path, featured bool, active bool, created_at.
  Non-coffee products leave the coffee-specific columns null.
- `product_variants`: id, product_id, sku (unique), name (for example
  "12 oz"), weight_grams nullable, price_cents, compare_at_price_cents
  nullable, stock_quantity, position. Price and stock live here.
- `collections`: id, slug (unique), name, description, position.
- `product_collections`: product_id, collection_id, position. Composite PK.
- `carts`: id, created_at, updated_at. Id stored in an httpOnly, SameSite=Lax
  cookie `cofresso_cart`.
- `cart_items`: id, cart_id, variant_id, quantity, grind
  (`whole_bean` | `drip` | `espresso` | `french_press` | `pour_over` | null),
  purchase_type (`one_time` | `subscription`), subscription_interval_weeks
  (2 | 4 | 6 | null). Unique on (cart_id, variant_id, grind, purchase_type,
  subscription_interval_weeks).
- `discount_codes`: id, code (unique, uppercase), kind
  (`percent` | `fixed` | `free_shipping`), value (percent or cents),
  min_subtotal_cents, starts_at, expires_at, active, usage_count.
- `orders`: id, order_number (unique, `CF-` + zero-padded sequence starting
  at 10001), email, status (`paid` | `fulfilled` | `cancelled`), shipping
  name, address1, address2, city, state, postal_code, country,
  subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
  discount_code, payment_provider, payment_reference, lookup_token (random,
  used by the confirmation link), idempotency_key (unique; generated per
  checkout attempt so a double submit cannot create two orders), created_at.
- `order_items`: id, order_id, product_id, variant_id, product_name,
  variant_name, grind, purchase_type, subscription_interval_weeks,
  unit_price_cents, quantity. Snapshot at purchase time.
- `reviews`: id, product_id, author_name, rating 1..5, title, body,
  verified bool, created_at. Seeded; no write path in this scope.
- `newsletter_subscribers`: id, email (unique), source, created_at.

## Pricing rules

Implemented as pure functions in `src/lib/pricing/` and unit tested.

- Subscription line items get 15% off the variant price.
- Discount codes apply to the subtotal after subscription discounts. Only
  one code per cart. `percent` and `fixed` reduce `discount_cents`;
  `free_shipping` zeroes shipping.
- Shipping is flat $6.00, free when the discounted subtotal reaches $45.00.
  The free-shipping threshold is a site config value so it can be tuned in
  experiments.
- Tax is a flat 8% on the discounted subtotal. This is explicitly a
  simulation.
- Totals never go below zero.

## Payments

`src/lib/payments/` exposes:

```ts
interface PaymentProvider {
  authorize(input: { amountCents: number; currency: 'USD'; card: CardInput; idempotencyKey: string }):
    Promise<{ ok: true; reference: string } | { ok: false; code: 'declined' | 'insufficient_funds' | 'invalid_card' | 'processing_error'; message: string }>;
}
```

`SimulatedPaymentProvider` accepts any Luhn-valid number with a future
expiry and 3 to 4 digit CVC, and maps well-known test numbers:

| Number | Result |
| --- | --- |
| 4242 4242 4242 4242 | approved |
| 4000 0000 0000 0002 | declined |
| 4000 0000 0000 9995 | insufficient_funds |
| 4000 0000 0000 0119 | processing_error |

Card numbers never touch the database or logs. Only the reference and the
last four digits are retained.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Hero, featured products, collections, story, brew guides teaser, reviews strip, newsletter |
| `/shop` | Product listing. Filters (collection, roast, origin), sort (featured, price asc/desc, newest) via search params |
| `/collections/[slug]` | Collection listing |
| `/products/[slug]` | Product page: gallery, size selector, grind selector, one-time vs subscribe-and-save, add to cart, tasting notes, origin details, reviews, related products |
| `/cart` | Full cart page. Also a slide-over cart drawer available site-wide |
| `/checkout` | Single page with steps: contact, shipping, payment, review. Server action places the order |
| `/checkout/success/[orderNumber]?t=<lookup_token>` | Confirmation |
| `/orders` | Guest lookup form: order number + email |
| `/orders/[orderNumber]?t=<lookup_token>` | Order detail |
| `/search?q=` | Postgres `ILIKE` search on name, tagline, origin, tasting notes |
| `/about`, `/faq` | Content pages |
| `/brew-guides`, `/brew-guides/[slug]` | Typed content in `src/content/` |
| `/coffee` | 302 to https://github.com/coframe/coffee |
| `/api/health` | `{ status, db, version, commit }`, 200 or 503. Checks DB with a 2 second timeout |
| `/sitemap.xml`, `/robots.txt`, `/humans.txt` | Standard files; humans.txt carries the easter egg |

Every route has loading and error boundaries where meaningful. Custom
`not-found` page. `www.cofresso.com` redirects 308 to the apex in middleware.

## Analytics and SDK integration point

`src/lib/analytics/` defines a typed event union:
`page_view`, `view_item_list`, `view_item`, `select_variant`, `add_to_cart`,
`remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`,
`add_payment_info`, `purchase`, `apply_promo`, `newsletter_signup`, `search`.

`track(event)` pushes to `window.cofresso.events` (a bounded array) and
dispatches a `cofresso:event` CustomEvent. Nothing is sent anywhere by
default. `<ThirdPartyScripts />` in the root layout renders a script tag for
the Coframe SDK only when `NEXT_PUBLIC_COFRAME_SITE_KEY` is set, using
`NEXT_PUBLIC_COFRAME_SCRIPT_URL` if provided. Installing the SDK is a
follow-up task by design.

## Code organization

```
src/
  app/                      routes, layouts, route handlers
    (marketing)/            home, about, faq, brew-guides
    (shop)/                 shop, collections, products, search
    (checkout)/             cart, checkout, orders
    api/health/
  components/
    ui/                     Button, Input, Badge, Price, Rating, Sheet, ...
    layout/                 Header, Footer, MobileNav, CartDrawer host
    product/                ProductCard, VariantSelector, GrindSelector, PurchaseTypeToggle, AddToCart
    cart/                   CartLine, CartSummary, PromoCodeForm, FreeShippingBar
    checkout/               ContactStep, ShippingStep, PaymentStep, ReviewStep, OrderSummary
    marketing/              Hero, CollectionGrid, ReviewsStrip, NewsletterForm
  lib/
    db/                     client.ts, schema/*.ts, queries/*.ts
    cart/                   cookie handling, cart mutations
    checkout/               place-order.ts (transaction), validation schemas
    payments/               provider interface, simulated provider, luhn
    pricing/                pure pricing functions
    analytics/              events, track, ThirdPartyScripts
    content/                brew guides + faq loaders
    config.ts               site config (thresholds, shipping, tax)
    env.ts                  zod-validated env
    logger.ts
  content/                  brew-guides/*.ts, faq.ts
drizzle/                    generated SQL migrations
scripts/                    seed.ts, reset.ts, generate-product-art.ts
tests/
  e2e/                      Playwright specs
  integration/              db-backed Vitest specs
infra/                      Terraform
.github/                    workflows, CODEOWNERS, templates, dependabot
docs/                       architecture, runbooks, github-setup, superpowers/specs
```

Rules the codebase follows and `AGENTS.md` documents:

- Server components fetch through `lib/db/queries`. Client components never
  import the db client.
- Mutations are server actions in `actions.ts` files next to their route,
  validated with Zod, returning `{ ok: true, data } | { ok: false, error }`.
- Pricing, payments and cart logic are pure and tested in isolation.
- Schema changes ship with a generated migration in the same PR.
- No secrets in the repo. Env is validated at boot by `lib/env.ts`.

## Error handling

- Zod failures return field-level errors to the form.
- `placeOrder` runs one transaction: re-read variants with `FOR UPDATE`,
  verify stock, authorize payment, insert order and items, decrement stock,
  clear the cart. Payment declines return to the payment step with the
  provider message. Out-of-stock aborts before authorization and reports the
  offending line.
- Unknown failures are logged with the trace id and surface a generic
  message via `error.tsx`.
- `/api/health` returns 503 with `db: "down"` when the database check fails,
  so Cloud Run and smoke tests notice.

## Seed data

Roughly 12 coffees (single origins such as Ethiopia Yirgacheffe, Colombia
Huila, Guatemala Antigua, Kenya Nyeri, Brazil Cerrado, Sumatra Mandheling,
Costa Rica Tarrazú, Peru Cajamarca, plus blends Morning Frame, Dark Mode
espresso, Night Build decaf, Hot Reload cold brew blend), five or six
equipment items (dripper, gooseneck kettle, hand grinder, scale, filters,
mug), collections (Single Origin, Blends, Equipment, Decaf), discount codes
(`WELCOME10` percent 10, `FREESHIP`, `COFRAME15` percent 15 min $30), about
40 reviews, four brew guides (V60, French press, espresso, cold brew), FAQ.

Seeding is idempotent (upsert by slug or sku) so it is safe to run on the
preview database repeatedly.

## Infrastructure (Terraform, `infra/`)

State: GCS bucket created once by a bootstrap script, then referenced by the
backend block. Everything else is Terraform.

- Project: new project under the coframe.com organization on the Coframe
  billing account. Id chosen at bootstrap (`cofresso-prod` preferred).
- APIs: run, sqladmin, artifactregistry, compute, dns, secretmanager, iam,
  iamcredentials, sts, servicenetworking, monitoring, logging.
- Artifact Registry Docker repository `web` in `us-central1`.
- Cloud SQL: Postgres 16, `db-f1-micro`, public IP with no authorized
  networks (access only through the Cloud SQL connector), automated backups,
  deletion protection on. Databases `cofresso` and `cofresso_preview`. One
  application user; password generated by Terraform and stored in Secret
  Manager as `DATABASE_URL` and `DATABASE_URL_PREVIEW`.
- Service accounts: `cofresso-web-runtime` (cloudsql.client,
  secretmanager.secretAccessor), `github-deployer` (run.admin,
  artifactregistry.writer, iam.serviceAccountUser on the runtime SA,
  cloudsql.client), `terraform-applier` (owner on the project, used only by
  the infra workflow on main).
- Cloud Run v2 services `cofresso-web` (production, min 1, max 4) and
  `cofresso-web-preview` (min 0, max 2), both with the Cloud SQL volume,
  512 MiB, 1 vCPU, startup CPU boost, ingress all. Container image and env
  are managed by CI, so Terraform ignores changes to the template image.
- Cloud Run v2 jobs `cofresso-migrate` and `cofresso-migrate-preview`
  running `node scripts/migrate.mjs` in the same image.
- Load balancer: global static IP, serverless NEG to `cofresso-web`,
  backend service with Cloud CDN enabled (cache mode `USE_ORIGIN_HEADERS`),
  URL map, Google-managed certificate for `cofresso.com` and
  `www.cofresso.com`, HTTPS proxy, and an HTTP forwarding rule that 301s to
  HTTPS.
- Cloud DNS zone `cofresso.com` with A records for apex and `www` pointing
  at the LB IP. Nameservers are output for the owner to paste into
  Namecheap.
- Monitoring: uptime check on `https://cofresso.com/api/health` and an alert
  policy. Notification channel email is a variable, empty by default.
- Workload Identity Federation: pool `github`, OIDC provider for
  `token.actions.githubusercontent.com`, attribute condition restricting to
  `assertion.repository == "cofresso/cofresso.com"`. `github-deployer` is
  bindable by any ref in the repo; `terraform-applier` only by
  `refs/heads/main`.

Estimated monthly cost: about $40, dominated by the LB forwarding rule
(about $18), Cloud SQL micro (about $9) and one warm Cloud Run instance
(about $10).

## CI/CD (GitHub Actions)

Workflows:

- `ci.yml` (pull_request, push to main). Jobs with pnpm caching and
  concurrency cancellation: `lint` (eslint, prettier check), `typecheck`,
  `unit` (vitest with coverage artifact), `integration` (vitest against a
  Postgres 16 service container, runs migrations first), `build`, `e2e`
  (Playwright against the built app and the service container, seeded;
  uploads the report on failure).
- `deploy-preview` job in `ci.yml`, `if: github.event_name == 'pull_request'
  && !github.event.pull_request.head.repo.fork`, `needs` all check jobs.
  Steps: WIF auth, buildx with GHA cache, push `web:pr-<n>-<sha>`, execute
  `cofresso-migrate-preview` with the new image, deploy to
  `cofresso-web-preview` with `--no-traffic --tag pr-<n>`, sticky PR comment
  with the tag URL, smoke test `/api/health` on the tag URL, Lighthouse CI
  against the home, a product page and the cart with budgets reported as
  warnings.
- `preview-cleanup.yml` (pull_request closed) removes the `pr-<n>` traffic
  tag from `cofresso-web-preview`.
- `deploy-production` job in `ci.yml`, `if: github.ref == 'refs/heads/main'`,
  `environment: production`, `needs` all checks. Build and push
  `web:sha-<sha>` and `web:latest`, execute `cofresso-migrate`, deploy with
  traffic to latest, smoke test cofresso.com (falls back to the run.app URL
  until DNS is live), create a GitHub deployment status.
- `rollback.yml` (workflow_dispatch with an optional revision input). Lists
  revisions and moves 100% traffic to the previous serving revision or the
  named one.
- `infra.yml` (paths `infra/**`). On PR: fmt check, validate, plan with the
  plan posted as a sticky comment. On main: apply with
  `environment: infrastructure`.
- `codeql.yml` (JavaScript/TypeScript, weekly + PR).
- `pr-title.yml`: Conventional Commits title check.
- `dependabot.yml`: weekly, grouped, for npm, github-actions, docker,
  terraform.

Repository hygiene: `CODEOWNERS`, PR template with a checklist, bug and
feature issue templates, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`,
`.nvmrc`, `.node-version`, `AGENTS.md`, `README.md` with architecture and
local setup. `docs/github-setup.md` lists the admin-only steps: required
status checks on main (lint, typecheck, unit, integration, build, e2e),
linear history, no force pushes, `production` and `infrastructure`
environments limited to `main`, enable CodeQL default setup.

## Local development

```
pnpm install
cp .env.example .env.local
docker compose up -d          # Postgres 16 on 5432
pnpm db:migrate && pnpm db:seed
pnpm dev                      # http://localhost:3000
```

Scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`,
`test:unit`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`,
`db:seed`, `db:reset`, `db:studio`, `art:generate`.

## Testing

- Unit: pricing (every rule and edge above), cart line merging, payment
  simulator and Luhn, order number formatting, Zod schemas, analytics event
  builders, search param parsing.
- Integration (real Postgres): queries for listing and filtering; `placeOrder`
  decrements stock, rolls back on out-of-stock, returns the existing order when the same
  idempotency key is submitted twice, and clears the cart; newsletter upsert.
- E2E (Playwright, chromium): home renders and links work; shop filters;
  product page variant and grind selection changes price; add to cart opens
  drawer; promo code `WELCOME10` changes totals; free-shipping bar flips;
  checkout with 4242 card succeeds and confirmation shows order number;
  checkout with 4000 0000 0000 0002 shows a decline; order lookup finds the
  order; search returns results; 404 page; `/coffee` redirects to GitHub.
- Smoke: `/api/health` 200 after each deploy.
- Lighthouse CI: performance, accessibility, best practices, SEO reported on
  preview deploys; warnings only.

## Easter eggs

- `/coffee` redirects to https://github.com/coframe/coffee.
- Footer: a small "made with ☕" link to the same URL.
- `/humans.txt` mentions the repo.
- A one-line console message on first load pointing there.

## Out of scope

Accounts and authentication, real payment processing, recurring billing,
transactional email, admin UI, inventory sync, i18n, multi-currency, real
tax calculation, address validation, review submission. Each is a good
future task for the coding agent.
