# Architecture

## Request flow

Browser → Global HTTPS load balancer (Google-managed cert, Cloud CDN for `/_next/static`) → Cloud Run `cofresso-web` → Cloud SQL Postgres via the Cloud SQL Unix socket.

Every page is server-rendered on request. Reads use Drizzle queries in `src/lib/db/queries`; writes are server actions. The cart id lives in an httpOnly cookie and cart state lives in Postgres, so the header count, drawer and cart page all render from the same source after `revalidatePath('/', 'layout')`.

## Domain

- **Catalog:** `products` → `product_variants` (size, price, stock); `collections` via `product_collections`; `reviews`.
- **Cart:** `carts` (+ applied `discount_code`) → `cart_items` (variant, quantity, grind, one-time or subscription with interval). Lines merge on `(cart, variant, grind, purchase_type, interval)`.
- **Checkout:** `placeOrder` runs one transaction: lock variants `FOR UPDATE`, verify stock, evaluate the promo, authorize payment through `PaymentProvider`, insert `orders` + `order_items` (price snapshot), decrement stock, bump discount usage, clear the cart. `idempotency_key` makes double submits return the existing order.
- **Pricing:** pure functions. Subscription 15% → discount code → shipping ($6, free ≥ $45) → tax 8%.
- **Payments:** `SimulatedPaymentProvider` maps test card numbers to outcomes. Swap in a real gateway behind the same interface.

## Analytics / SDK slot

`track()` buffers typed events on `window.cofresso.events` and dispatches `cofresso:event`. `ThirdPartyScripts` renders the Coframe SDK tag only when `COFRAME_SITE_KEY` is set at request time.

## Environments

|            | Service                                                 | Database           | Trigger         |
| ---------- | ------------------------------------------------------- | ------------------ | --------------- |
| Preview    | `cofresso-web-preview` (tagged, zero-traffic revisions) | `cofresso_preview` | Pull request    |
| Production | `cofresso-web`                                          | `cofresso`         | Merge to `main` |

Migrations run as Cloud Run jobs (`cofresso-migrate`, `cofresso-migrate-preview`) using the same image before each deploy, followed by the idempotent seed.

## Observability

JSON logs with `severity` and Cloud Trace correlation (`src/lib/logger.ts`). `/api/health` probes the database and returns 503 when it is down; an uptime check alerts on it.
