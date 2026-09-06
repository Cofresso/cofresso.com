# Cofresso Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cofresso ecommerce web application (catalog, cart, checkout, orders, content) as a production-grade Next.js codebase that runs locally against Postgres and builds into a Docker image.

**Architecture:** Next.js App Router with React server components for reads and server actions for writes. A `src/lib` layer holds the Drizzle schema and queries, pure pricing and payment logic, cart and checkout logic, and typed analytics. Server components call `lib/db/queries`; client components never import the db client. All money is integer cents.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4, pnpm 10, Node 22, Drizzle ORM + postgres.js, Zod, Vitest, Testing Library, Playwright, ESLint flat config, Prettier, esbuild (bundling the db CLI), Docker.

**Spec:** `docs/superpowers/specs/2026-09-06-cofresso-ecommerce-design.md`

## Global Constraints

- Node 22 LTS; pnpm 10; `packageManager` field pinned in `package.json`.
- Pin TypeScript to the version `create-next-app` ships (5.x line), not TypeScript 7.
- TypeScript `strict: true`. No `any` except where a third-party type forces it, and then with a comment.
- All money is integer cents. Never use floats for prices.
- Server components fetch through `src/lib/db/queries`. Client components never import `src/lib/db/client`.
- Mutations are server actions validated with Zod, returning `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, fieldErrors? }`). Cart actions live in `src/lib/cart/actions.ts`; other actions live in `actions.ts` next to their route.
- Schema changes ship with a generated migration in `drizzle/` in the same commit.
- No secrets in the repo. Server env is validated lazily by `getServerEnv()` in `src/lib/env.ts`.
- Card numbers never reach the database or logs; only the last four digits and the provider reference are stored.
- Brand tokens (Tailwind theme): espresso `#4A2C24`, latte `#A08977`, cream `#F6F1EB`, foam `#FFFDFA`, copper `#C8763A`, leaf `#5F7A5A`. Fonts: Fraunces (display), Inter (body).
- Pricing rules: subscription 15% off; one discount code per cart applied after subscription savings; shipping $6.00 flat, free at $45.00 discounted subtotal; tax flat 8% of discounted subtotal; totals never negative.
- Easter egg URL: `https://github.com/coframe/coffee`.
- Every page in the app is dynamically rendered (`export const dynamic = 'force-dynamic'` in the root layout) so `next build` never touches the database.
- Commit after every task with a Conventional Commits message.

---

## File structure

```
.editorconfig .nvmrc .node-version .prettierrc .prettierignore .env.example
.dockerignore Dockerfile docker-compose.yml
package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs
drizzle.config.ts vitest.config.ts vitest.integration.config.ts vitest.setup.ts playwright.config.ts
drizzle/                      generated migrations + meta
scripts/db.ts                 CLI: migrate | seed | reset
scripts/generate-product-art.ts
public/logo.png public/products/*.svg public/humans.txt
src/app/layout.tsx src/app/fonts.ts src/app/globals.css src/app/icon.png src/app/apple-icon.png
src/app/error.tsx src/app/not-found.tsx src/app/loading.tsx src/app/robots.ts src/app/sitemap.ts
src/app/coffee/route.ts
src/app/api/health/route.ts
src/app/(marketing)/page.tsx (+ actions.ts, about/, faq/, brew-guides/)
src/app/(shop)/shop/page.tsx  collections/[slug]/page.tsx  products/[slug]/page.tsx  search/page.tsx
src/app/(checkout)/cart/page.tsx  checkout/page.tsx  checkout/actions.ts  checkout/success/[orderNumber]/page.tsx
src/app/(checkout)/orders/page.tsx  orders/actions.ts  orders/[orderNumber]/page.tsx
src/components/ui/*           button, input, select, badge, price, rating, container, section-heading, sheet
src/components/layout/*       header, footer, mobile-nav, cart-button, cart-drawer, cart-drawer-context
src/components/product/*      product-card, product-grid, variant-selector, grind-selector, purchase-type-toggle, add-to-cart-form
src/components/cart/*         cart-line, cart-summary, promo-code-form, free-shipping-bar, cart-panel
src/components/checkout/*     checkout-form, order-summary
src/components/marketing/*    hero, collection-grid, reviews-strip, newsletter-form, brew-guides-teaser, story
src/components/analytics/*    analytics-provider, third-party-scripts, track-purchase, console-easter-egg
src/lib/env.ts src/lib/logger.ts src/lib/config.ts src/lib/utils.ts src/lib/action-result.ts
src/lib/db/client.ts src/lib/db/schema/*.ts src/lib/db/queries/*.ts src/lib/db/seed/*.ts
src/lib/pricing/*.ts src/lib/payments/*.ts src/lib/cart/*.ts src/lib/checkout/*.ts src/lib/analytics/*.ts
src/lib/shop/filters.ts src/lib/content/*.ts src/content/brew-guides/*.ts src/content/faq.ts
tests/integration/*.test.ts tests/integration/global-setup.ts tests/e2e/*.spec.ts
README.md AGENTS.md CONTRIBUTING.md SECURITY.md docs/architecture.md
```

---

### Task 1: Scaffold the Next.js project with brand tokens, fonts, lint, format and unit test tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.nvmrc`, `.node-version`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/fonts.ts`, `src/app/icon.png`, `src/app/apple-icon.png`, `public/logo.png`
- Create: `src/lib/utils.ts`, `src/lib/utils.test.ts`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/app/api/health/route.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` in `src/lib/utils.ts`; Tailwind color tokens `espresso latte cream foam copper leaf`; font CSS variables `--font-display`, `--font-body`; pnpm scripts `dev build start lint format typecheck test:unit`.

- [ ] **Step 1: Make sure pnpm 10 is available**

Run: `pnpm -v`. If it prints a version below 10, run `npm install -g pnpm@10` and re-check.

- [ ] **Step 2: Scaffold into a temp dir and copy in**

`create-next-app` refuses non-empty directories, so scaffold elsewhere and sync:

```bash
pnpm dlx create-next-app@latest /tmp/cofresso-scaffold \
  --ts --tailwind --eslint --app --src-dir --use-pnpm --yes \
  --import-alias "@/*" --no-react-compiler --turbopack
rsync -a --exclude .git --exclude README.md /tmp/cofresso-scaffold/ /Users/joshpayne/cofresso.com/
rm -rf /tmp/cofresso-scaffold
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

If `--no-react-compiler` or `--turbopack` are rejected by the installed version, drop the flag and continue.

- [ ] **Step 3: Pin versions and add tooling deps**

```bash
pnpm add clsx tailwind-merge zod
pnpm add @fontsource-variable/fraunces @fontsource-variable/inter
pnpm add -D prettier prettier-plugin-tailwindcss eslint-config-prettier
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @testing-library/dom
```

Check `typescript` in `package.json` is a `5.x` version. If it is `7.x`, run `pnpm add -D typescript@5`.

- [ ] **Step 4: Write `package.json` scripts, engines, packageManager**

Edit `package.json` so it contains (keep the dependency blocks pnpm wrote):

```json
{
  "name": "cofresso",
  "version": "0.1.0",
  "private": true,
  "description": "Cofresso specialty coffee storefront",
  "packageManager": "pnpm@10.0.0",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . && prettier --check .",
    "lint:fix": "eslint . --fix && prettier --write .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "pnpm test:unit && pnpm test:integration",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:unit:watch": "vitest --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test"
  }
}
```

Replace `pnpm@10.0.0` with the exact output of `pnpm -v`.

- [ ] **Step 5: Editor, formatter and Node version files**

`.nvmrc` and `.node-version` both contain exactly `22`.

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`.prettierignore`:
```
.next
node_modules
pnpm-lock.yaml
drizzle/meta
coverage
playwright-report
test-results
dist
public/products
*.png
```

Append to `.gitignore`:
```
# cofresso
.env
.env.local
.env.*.local
coverage
playwright-report
test-results
dist
.DS_Store
infra/.terraform
infra/*.tfstate*
infra/tfplan
```

- [ ] **Step 6: ESLint config with Prettier compatibility**

Replace `eslint.config.mjs` with:

```js
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'dist/**', 'next-env.d.ts', 'coverage/**', 'playwright-report/**', 'test-results/**', 'drizzle/**']),
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
```

If the scaffold's `eslint.config.mjs` imports differently (for example `FlatCompat`), keep the scaffold's import style for the Next configs and only add the `prettier` entry, the ignores and the rules block.

- [ ] **Step 7: `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Product art is local SVG, served as-is.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.cofresso.com' }],
        destination: 'https://cofresso.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 8: Brand tokens in `src/app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --color-espresso: #4a2c24;
  --color-espresso-dark: #33201a;
  --color-latte: #a08977;
  --color-latte-light: #cbb9aa;
  --color-cream: #f6f1eb;
  --color-foam: #fffdfa;
  --color-copper: #c8763a;
  --color-copper-dark: #a85f2b;
  --color-leaf: #5f7a5a;

  --font-display: var(--font-fraunces), Georgia, serif;
  --font-body: var(--font-inter), system-ui, sans-serif;

  --radius-brand: 0.75rem;
}

:root {
  color-scheme: light;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-cream font-body text-espresso antialiased;
}

h1,
h2,
h3,
h4 {
  @apply font-display;
}

::selection {
  @apply bg-copper/30;
}
```

- [ ] **Step 9: Fonts via `next/font/local` from fontsource packages**

`src/app/fonts.ts`:
```ts
import localFont from 'next/font/local';

export const fraunces = localFont({
  src: '../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2',
  variable: '--font-fraunces',
  display: 'swap',
  weight: '100 900',
});

export const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});
```

Verify both files exist with `ls node_modules/@fontsource-variable/*/files/*latin-wght-normal.woff2`. If a filename differs, use the actual `latin-wght-normal.woff2` file name.

- [ ] **Step 10: Logo assets**

```bash
cp logo.png public/logo.png
sips -Z 512 logo.png --out src/app/icon.png >/dev/null
sips -Z 180 logo.png --out src/app/apple-icon.png >/dev/null
git rm --cached -q logo.png 2>/dev/null; rm -f logo.png
```

Next.js picks up `src/app/icon.png` and `src/app/apple-icon.png` as favicon and touch icon automatically.

- [ ] **Step 11: `cn` utility with a failing test first**

`src/lib/utils.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4', undefined, false && 'hidden', 'text-espresso')).toBe('p-4 text-espresso');
  });
});
```

`vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    name: 'unit',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/lib/**'] },
  },
});
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

Run: `pnpm test:unit`
Expected: FAIL, cannot find module `./utils`.

- [ ] **Step 12: Implement `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

Run: `pnpm test:unit`
Expected: PASS (1 test).

- [ ] **Step 13: Root layout, placeholder home, health route**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { fraunces, inter } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Cofresso — Specialty coffee, framed right', template: '%s · Cofresso' },
  description: 'Small-batch specialty coffee roasted for people who care about every detail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (temporary, replaced in Task 12):
```tsx
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-5xl">Cofresso</h1>
      <p className="text-latte">Specialty coffee, framed right. Storefront coming online.</p>
    </main>
  );
}
```

`src/app/api/health/route.ts` (DB check added in Task 18):
```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    commit: process.env.GIT_SHA ?? 'dev',
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 14: Verify lint, typecheck, build**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm build`
Expected: all succeed. `next build` output lists `/`, `/api/health` as dynamic (ƒ).

Run: `pnpm start & sleep 3; curl -s localhost:3000/api/health; kill %1`
Expected: JSON with `"status":"ok"`.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with brand tokens, fonts, lint and test tooling"
```

---

### Task 2: Environment, logger, database client, Drizzle schema and migration tooling

**Files:**
- Create: `src/lib/env.ts`, `src/lib/env.test.ts`, `src/lib/logger.ts`, `src/lib/logger.test.ts`, `src/lib/config.ts`, `src/lib/action-result.ts`
- Create: `src/lib/db/client.ts`, `src/lib/db/schema/index.ts`, `src/lib/db/schema/enums.ts`, `src/lib/db/schema/catalog.ts`, `src/lib/db/schema/cart.ts`, `src/lib/db/schema/orders.ts`, `src/lib/db/schema/marketing.ts`, `src/lib/db/schema/relations.ts`
- Create: `drizzle.config.ts`, `drizzle/0000_*.sql` (generated), `docker-compose.yml`, `docker/postgres/init.sql`, `.env.example`, `scripts/db.ts`
- Create: `vitest.integration.config.ts`, `tests/integration/global-setup.ts`, `tests/integration/schema.test.ts`

**Interfaces:**
- Produces: `getServerEnv(): ServerEnv`; `logger.info|warn|error(message, fields?)`; `siteConfig`; `type ActionResult<T>`; `getDb(): Db`; all Drizzle tables and `$inferSelect` types (`Product`, `ProductVariant`, `Collection`, `Cart`, `CartItem`, `DiscountCode`, `Order`, `OrderItem`, `Review`, `NewsletterSubscriber`); `orderNumberSeq`; pnpm scripts `db:generate db:migrate db:seed db:reset db:studio`.

- [ ] **Step 1: Install deps**

```bash
pnpm add drizzle-orm postgres uuid
pnpm add -D drizzle-kit tsx dotenv esbuild @types/uuid
```

- [ ] **Step 2: Failing env tests**

`src/lib/env.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getServerEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db');
    const { getServerEnv } = await import('./env');
    expect(getServerEnv().DATABASE_URL).toBe('postgres://u:p@localhost:5432/db');
  });

  it('accepts socket parts without DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DB_SOCKET_DIR', '/cloudsql/p:r:i');
    vi.stubEnv('DB_USER', 'app');
    vi.stubEnv('DB_PASSWORD', 'secret');
    vi.stubEnv('DB_NAME', 'cofresso');
    const { getServerEnv } = await import('./env');
    expect(getServerEnv().DB_SOCKET_DIR).toBe('/cloudsql/p:r:i');
  });

  it('throws a readable error when no database config is present', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DB_SOCKET_DIR', '');
    vi.stubEnv('DB_HOST', '');
    const { getServerEnv } = await import('./env');
    expect(() => getServerEnv()).toThrow(/database/i);
  });
});
```

Run: `pnpm test:unit src/lib/env.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

const serverSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    DB_SOCKET_DIR: z.preprocess(emptyToUndefined, z.string().optional()),
    DB_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.preprocess(emptyToUndefined, z.string().optional()),
    DB_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
    DB_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
    SITE_URL: z.string().url().default('http://localhost:3000'),
    COFRAME_SITE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    COFRAME_SCRIPT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    GIT_SHA: z.string().default('dev'),
    ALLOW_DB_RESET: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((env, ctx) => {
    const hasParts = Boolean(env.DB_USER && env.DB_PASSWORD && env.DB_NAME && (env.DB_HOST || env.DB_SOCKET_DIR));
    if (!env.DATABASE_URL && !hasParts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Database config missing: set DATABASE_URL, or DB_USER, DB_PASSWORD, DB_NAME and one of DB_HOST or DB_SOCKET_DIR.',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/**
 * Parse and cache server environment. Called lazily so `next build` never
 * needs a database configured.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper. */
export function resetEnvCache(): void {
  cached = undefined;
}
```

Run: `pnpm test:unit src/lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Logger with test**

`src/lib/logger.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

describe('logger', () => {
  it('writes one JSON line with severity and message', () => {
    const write = vi.fn();
    const log = createLogger({ write, base: { service: 'cofresso' } });
    log.info('hello', { orderNumber: 'CF-10001' });
    expect(write).toHaveBeenCalledTimes(1);
    const line = JSON.parse(write.mock.calls[0][0] as string);
    expect(line).toMatchObject({ severity: 'INFO', message: 'hello', service: 'cofresso', orderNumber: 'CF-10001' });
    expect(typeof line.time).toBe('string');
  });

  it('serialises errors', () => {
    const write = vi.fn();
    const log = createLogger({ write });
    log.error('boom', { err: new Error('bad') });
    const line = JSON.parse(write.mock.calls[0][0] as string);
    expect(line.severity).toBe('ERROR');
    expect(line.err.message).toBe('bad');
    expect(typeof line.err.stack).toBe('string');
  });
});
```

`src/lib/logger.ts`:
```ts
type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type Fields = Record<string, unknown>;

interface LoggerOptions {
  write?: (line: string) => void;
  base?: Fields;
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export function createLogger(options: LoggerOptions = {}) {
  const write = options.write ?? ((line: string) => process.stdout.write(line + '\n'));
  const base = options.base ?? {};

  function emit(severity: Severity, message: string, fields: Fields = {}) {
    const entry: Fields = { severity, message, time: new Date().toISOString(), ...base };
    for (const [k, v] of Object.entries(fields)) entry[k] = serialise(v);
    write(JSON.stringify(entry));
  }

  return {
    debug: (message: string, fields?: Fields) => emit('DEBUG', message, fields),
    info: (message: string, fields?: Fields) => emit('INFO', message, fields),
    warn: (message: string, fields?: Fields) => emit('WARNING', message, fields),
    error: (message: string, fields?: Fields) => emit('ERROR', message, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;

export const logger: Logger = createLogger({ base: { service: 'cofresso-web' } });

/**
 * Extract the Cloud Trace id from an incoming request so Cloud Logging can
 * group log lines with the request. Header format: TRACE_ID/SPAN_ID;o=1
 */
export function traceFields(headers: Headers, projectId = process.env.GOOGLE_CLOUD_PROJECT): Fields {
  const header = headers.get('x-cloud-trace-context');
  if (!header || !projectId) return {};
  const traceId = header.split('/')[0];
  return { 'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}` };
}
```

Run: `pnpm test:unit src/lib/logger.test.ts`
Expected: PASS.

- [ ] **Step 5: Site config and ActionResult**

`src/lib/config.ts`:
```ts
export const siteConfig = {
  name: 'Cofresso',
  tagline: 'Specialty coffee, framed right.',
  description:
    'Cofresso roasts small-batch specialty coffee for people who care about every detail, from farm altitude to grind size.',
  currency: 'USD' as const,
  locale: 'en-US',
  supportEmail: 'hello@cofresso.com',
  easterEggUrl: 'https://github.com/coframe/coffee',
  pricing: {
    subscriptionDiscountPercent: 15,
    shippingFlatCents: 600,
    freeShippingThresholdCents: 4500,
    taxRate: 0.08,
  },
  subscriptionIntervals: [2, 4, 6] as const,
  nav: [
    { href: '/shop', label: 'Shop' },
    { href: '/collections/single-origin', label: 'Single Origin' },
    { href: '/collections/blends', label: 'Blends' },
    { href: '/collections/equipment', label: 'Equipment' },
    { href: '/brew-guides', label: 'Brew Guides' },
    { href: '/about', label: 'About' },
  ],
  footerLinks: [
    { href: '/faq', label: 'FAQ' },
    { href: '/orders', label: 'Track an order' },
    { href: '/about', label: 'Our story' },
  ],
};

export type SubscriptionInterval = (typeof siteConfig.subscriptionIntervals)[number];
```

`src/lib/action-result.ts`:
```ts
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}
```

- [ ] **Step 6: Drizzle schema**

`src/lib/db/schema/enums.ts`:
```ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const productCategoryEnum = pgEnum('product_category', ['coffee', 'equipment', 'merch']);
export const roastLevelEnum = pgEnum('roast_level', ['light', 'medium', 'medium_dark', 'dark']);
export const grindEnum = pgEnum('grind', ['whole_bean', 'drip', 'espresso', 'french_press', 'pour_over']);
export const purchaseTypeEnum = pgEnum('purchase_type', ['one_time', 'subscription']);
export const discountKindEnum = pgEnum('discount_kind', ['percent', 'fixed', 'free_shipping']);
export const orderStatusEnum = pgEnum('order_status', ['paid', 'fulfilled', 'cancelled']);

export type ProductCategory = (typeof productCategoryEnum.enumValues)[number];
export type RoastLevel = (typeof roastLevelEnum.enumValues)[number];
export type Grind = (typeof grindEnum.enumValues)[number];
export type PurchaseType = (typeof purchaseTypeEnum.enumValues)[number];
export type DiscountKind = (typeof discountKindEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
```

`src/lib/db/schema/catalog.ts`:
```ts
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { productCategoryEnum, roastLevelEnum } from './enums';

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull(),
    description: text('description').notNull(),
    category: productCategoryEnum('category').notNull(),
    origin: text('origin'),
    region: text('region'),
    producer: text('producer'),
    altitudeM: integer('altitude_m'),
    process: text('process'),
    roastLevel: roastLevelEnum('roast_level'),
    tastingNotes: text('tasting_notes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    imagePath: text('image_path').notNull(),
    featured: boolean('featured').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('products_category_idx').on(t.category), index('products_featured_idx').on(t.featured)],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    weightGrams: integer('weight_grams'),
    priceCents: integer('price_cents').notNull(),
    compareAtPriceCents: integer('compare_at_price_cents'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_variants_product_idx').on(t.productId)],
);

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
});

export const productCollections = pgTable(
  'product_collections',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reviews_product_idx').on(t.productId)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type Review = typeof reviews.$inferSelect;
```

`src/lib/db/schema/cart.ts`:
```ts
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { productVariants } from './catalog';
import { grindEnum, purchaseTypeEnum } from './enums';

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  discountCode: text('discount_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    grind: grindEnum('grind'),
    purchaseType: purchaseTypeEnum('purchase_type').notNull().default('one_time'),
    subscriptionIntervalWeeks: integer('subscription_interval_weeks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cart_items_cart_idx').on(t.cartId),
    // NULLS NOT DISTINCT so two identical whole-bean lines merge instead of duplicating.
    uniqueIndex('cart_items_line_key')
      .on(t.cartId, t.variantId, t.grind, t.purchaseType, t.subscriptionIntervalWeeks)
      .nullsNotDistinct(),
  ],
);

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
```

`src/lib/db/schema/orders.ts`:
```ts
import { boolean, index, integer, pgSequence, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products, productVariants } from './catalog';
import { discountKindEnum, grindEnum, orderStatusEnum, purchaseTypeEnum } from './enums';

export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 10001, increment: 1 });

export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  kind: discountKindEnum('kind').notNull(),
  value: integer('value').notNull().default(0),
  minSubtotalCents: integer('min_subtotal_cents').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
});

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull().unique(),
    email: text('email').notNull(),
    status: orderStatusEnum('status').notNull().default('paid'),
    shippingName: text('shipping_name').notNull(),
    shippingAddress1: text('shipping_address1').notNull(),
    shippingAddress2: text('shipping_address2'),
    shippingCity: text('shipping_city').notNull(),
    shippingState: text('shipping_state').notNull(),
    shippingPostalCode: text('shipping_postal_code').notNull(),
    shippingCountry: text('shipping_country').notNull().default('US'),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    shippingCents: integer('shipping_cents').notNull(),
    taxCents: integer('tax_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    discountCode: text('discount_code'),
    paymentProvider: text('payment_provider').notNull(),
    paymentReference: text('payment_reference').notNull(),
    cardLast4: text('card_last4'),
    lookupToken: text('lookup_token').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('orders_email_idx').on(t.email)],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    productSlug: text('product_slug').notNull(),
    variantName: text('variant_name').notNull(),
    imagePath: text('image_path').notNull(),
    grind: grindEnum('grind'),
    purchaseType: purchaseTypeEnum('purchase_type').notNull(),
    subscriptionIntervalWeeks: integer('subscription_interval_weeks'),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export type DiscountCode = typeof discountCodes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
```

`src/lib/db/schema/marketing.ts`:
```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('site'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
```

`src/lib/db/schema/relations.ts`:
```ts
import { relations } from 'drizzle-orm';
import { cartItems, carts } from './cart';
import { collections, productCollections, productVariants, products, reviews } from './catalog';
import { orderItems, orders } from './orders';

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  productCollections: many(productCollections),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  productCollections: many(productCollections),
}));

export const productCollectionsRelations = relations(productCollections, ({ one }) => ({
  product: one(products, { fields: [productCollections.productId], references: [products.id] }),
  collection: one(collections, { fields: [productCollections.collectionId], references: [collections.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({ items: many(cartItems) }));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems) }));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
```

`src/lib/db/schema/index.ts`:
```ts
export * from './enums';
export * from './catalog';
export * from './cart';
export * from './orders';
export * from './marketing';
export * from './relations';
```

- [ ] **Step 7: Database client**

`src/lib/db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

function createSql() {
  const env = getServerEnv();
  const common = { max: 5, idle_timeout: 20, connect_timeout: 10 } as const;
  if (env.DATABASE_URL) {
    return postgres(env.DATABASE_URL, common);
  }
  if (env.DB_SOCKET_DIR) {
    // Cloud Run mounts the Cloud SQL socket at /cloudsql/<connection-name>/.s.PGSQL.5432
    return postgres({
      ...common,
      path: env.DB_SOCKET_DIR,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
  }
  return postgres({
    ...common,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

function createDb() {
  return drizzle(createSql(), { schema, casing: 'snake_case' });
}

let cached: Db | undefined;

/** Lazily construct the shared Drizzle client. Never call at module scope. */
export function getDb(): Db {
  cached ??= createDb();
  return cached;
}

/** Build an isolated client (used by scripts and tests that need to close it). */
export function createIsolatedDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 3 });
  return { db: drizzle(sql, { schema, casing: 'snake_case' }), close: () => sql.end({ timeout: 5 }) };
}
```

Remove `casing: 'snake_case'` if drizzle complains; the schema already names every column explicitly, so it is redundant either way.

- [ ] **Step 8: Drizzle config, Docker Compose, env example**

`drizzle.config.ts`:
```ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: ['.env.local', '.env'] });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso',
  },
  strict: true,
  verbose: true,
});
```

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: cofresso-postgres
    environment:
      POSTGRES_USER: cofresso
      POSTGRES_PASSWORD: cofresso
      POSTGRES_DB: cofresso
    ports:
      - '5432:5432'
    volumes:
      - cofresso-pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U cofresso -d cofresso']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  cofresso-pgdata:
```

`docker/postgres/init.sql`:
```sql
CREATE DATABASE cofresso_test;
```

`.env.example`:
```bash
# Local Postgres from docker-compose.yml
DATABASE_URL=postgres://cofresso:cofresso@localhost:5432/cofresso
# Used by integration tests and Playwright
TEST_DATABASE_URL=postgres://cofresso:cofresso@localhost:5432/cofresso_test

SITE_URL=http://localhost:3000

# Coframe SDK slot (leave empty to render nothing)
COFRAME_SITE_KEY=
COFRAME_SCRIPT_URL=

# Cloud Run alternative to DATABASE_URL (leave empty locally)
DB_SOCKET_DIR=
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=

# Set to "true" to allow `pnpm db:reset` to drop the schema
ALLOW_DB_RESET=true
```

Run: `cp .env.example .env.local && docker compose up -d && sleep 5 && docker compose ps`
Expected: postgres healthy.

- [ ] **Step 9: Generate the first migration**

Run: `pnpm drizzle-kit generate --name init`
Expected: `drizzle/0000_init.sql` plus `drizzle/meta/`. Inspect the SQL: it must contain `CREATE SEQUENCE "public"."order_number_seq" ... START WITH 10001`, all six enums, all tables, and `cart_items_line_key ... NULLS NOT DISTINCT`.

- [ ] **Step 10: DB CLI (`scripts/db.ts`)**

```ts
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createIsolatedDb } from '../src/lib/db/client';
import { runSeed } from '../src/lib/db/seed';

config({ path: ['.env.local', '.env'] });

type Command = 'migrate' | 'seed' | 'reset';

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT = '5432', DB_SOCKET_DIR } = process.env;
  if (DB_USER && DB_PASSWORD && DB_NAME) {
    const creds = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
    if (DB_SOCKET_DIR) return `postgres://${creds}@/${DB_NAME}?host=${encodeURIComponent(DB_SOCKET_DIR)}`;
    if (DB_HOST) return `postgres://${creds}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
  throw new Error('No database configuration found (DATABASE_URL or DB_* variables).');
}

async function main() {
  const command = process.argv[2] as Command | undefined;
  if (!command || !['migrate', 'seed', 'reset'].includes(command)) {
    console.error('Usage: db <migrate|seed|reset>');
    process.exit(2);
  }

  const { db, close } = createIsolatedDb(connectionString());
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

  try {
    if (command === 'reset') {
      if (process.env.ALLOW_DB_RESET !== 'true') {
        throw new Error('Refusing to reset: set ALLOW_DB_RESET=true to confirm.');
      }
      console.log('Dropping schema public...');
      await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
      await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
      await db.execute(sql`CREATE SCHEMA public`);
    }

    if (command === 'migrate' || command === 'reset') {
      console.log(`Applying migrations from ${migrationsFolder}...`);
      await migrate(db, { migrationsFolder });
      console.log('Migrations applied.');
    }

    if (command === 'seed' || command === 'reset') {
      console.log('Seeding...');
      const summary = await runSeed(db);
      console.log('Seed complete:', JSON.stringify(summary));
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Until Task 3 lands, create a stub `src/lib/db/seed/index.ts` so this compiles:

```ts
import type { Db } from '@/lib/db/client';

export interface SeedSummary {
  collections: number;
  products: number;
  variants: number;
  reviews: number;
  discountCodes: number;
}

export async function runSeed(_db: Db): Promise<SeedSummary> {
  return { collections: 0, products: 0, variants: 0, reviews: 0, discountCodes: 0 };
}
```

Add scripts to `package.json`:
```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/db.ts migrate",
    "db:seed": "tsx scripts/db.ts seed",
    "db:reset": "tsx scripts/db.ts reset",
    "db:studio": "drizzle-kit studio",
    "build:db": "esbuild scripts/db.ts --bundle --platform=node --target=node22 --format=esm --outfile=dist/db.mjs --banner:js=\"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\""
```

Scripts and `tsconfig`: make sure `tsconfig.json` `include` covers `scripts/**/*.ts` and `tests/**/*.ts` (add them to the `include` array) and that `paths` has `"@/*": ["./src/*"]`. For esbuild to resolve `@/` imports, add `--alias:@=./src` to the `build:db` script.

Run: `pnpm db:migrate`
Expected: "Migrations applied." Then `docker exec cofresso-postgres psql -U cofresso -d cofresso -c '\dt'` lists 11 tables.

Run: `pnpm build:db && ls -la dist/db.mjs`
Expected: bundle exists (a few hundred KB).

- [ ] **Step 11: Integration test harness**

`vitest.integration.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
```

`tests/integration/global-setup.ts`:
```ts
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createIsolatedDb } from '../../src/lib/db/client';
import { runSeed } from '../../src/lib/db/seed';

config({ path: ['.env.local', '.env'] });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export default async function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { db, close } = createIsolatedDb(TEST_DATABASE_URL);
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    await runSeed(db);
  } finally {
    await close();
  }
}
```

`tests/integration/helpers.ts`:
```ts
import { config } from 'dotenv';
import { createIsolatedDb } from '../../src/lib/db/client';

config({ path: ['.env.local', '.env'] });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export function testDb() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  return createIsolatedDb(TEST_DATABASE_URL);
}
```

`tests/integration/schema.test.ts`:
```ts
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('schema', () => {
  it('has every table from the design', async () => {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'cart_items', 'carts', 'collections', 'discount_codes', 'newsletter_subscribers',
        'order_items', 'orders', 'product_collections', 'product_variants', 'products', 'reviews',
      ]),
    );
  });

  it('starts order numbers at 10001', async () => {
    const [row] = await db.execute<{ nextval: string }>(sql`select nextval('order_number_seq')`);
    expect(Number(row.nextval)).toBeGreaterThanOrEqual(10001);
  });
});
```

Run: `pnpm test:integration`
Expected: PASS (2 tests).

- [ ] **Step 12: Lint, typecheck, commit**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

```bash
git add -A
git commit -m "feat: add env validation, logger, Drizzle schema, migrations and db CLI"
```

---

### Task 3: Seed data, idempotent seeder and generated product art

**Files:**
- Create: `src/lib/db/seed/data.ts`, `src/lib/db/seed/reviews.ts`, `src/lib/db/seed/index.ts` (replace stub), `src/lib/db/seed/ids.ts`, `src/lib/db/seed/ids.test.ts`
- Create: `scripts/generate-product-art.ts`, `public/products/*.svg` (generated)
- Test: `tests/integration/seed.test.ts`

**Interfaces:**
- Produces: `seedCollections`, `seedProducts`, `seedDiscountCodes` typed arrays; `runSeed(db): Promise<SeedSummary>` (idempotent); `stableId(namespaceKey: string): string` (UUID v5); `/products/<slug>.svg` images. Slugs used by later tests: `morning-frame`, `dark-mode-espresso`, `ethiopia-yirgacheffe`, `night-build-decaf`, `gooseneck-kettle`; discount codes `WELCOME10`, `FREESHIP`, `COFRAME15`; collection slugs `single-origin`, `blends`, `decaf`, `equipment`.

- [ ] **Step 1: Stable id helper with test**

`src/lib/db/seed/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { stableId } from './ids';

describe('stableId', () => {
  it('is deterministic and uuid-shaped', () => {
    expect(stableId('product:morning-frame')).toBe(stableId('product:morning-frame'));
    expect(stableId('product:morning-frame')).toMatch(/^[0-9a-f-]{36}$/);
    expect(stableId('a')).not.toBe(stableId('b'));
  });
});
```

`src/lib/db/seed/ids.ts`:
```ts
import { v5 as uuidv5 } from 'uuid';

const NAMESPACE = 'c0f7e550-0000-4000-8000-000000000c0f';

/** Deterministic UUID so re-running the seed upserts instead of duplicating. */
export function stableId(key: string): string {
  return uuidv5(key, NAMESPACE);
}
```

Run: `pnpm test:unit src/lib/db/seed/ids.test.ts` → PASS.

- [ ] **Step 2: Seed data**

`src/lib/db/seed/data.ts`:
```ts
import type { DiscountKind, ProductCategory, RoastLevel } from '@/lib/db/schema';

export type ArtShape = 'bag' | 'kettle' | 'dripper' | 'grinder' | 'scale' | 'filters' | 'mug';

export interface SeedVariant {
  sku: string;
  name: string;
  weightGrams: number | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity: number;
}

export interface SeedProduct {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ProductCategory;
  origin?: string;
  region?: string;
  producer?: string;
  altitudeM?: number;
  process?: string;
  roastLevel?: RoastLevel;
  tastingNotes: string[];
  featured?: boolean;
  collections: string[];
  variants: SeedVariant[];
  art: { shape: ArtShape; accent: string; label?: string };
}

export interface SeedCollection {
  slug: string;
  name: string;
  description: string;
  position: number;
}

export interface SeedDiscountCode {
  code: string;
  kind: DiscountKind;
  value: number;
  minSubtotalCents: number;
}

export const seedCollections: SeedCollection[] = [
  { slug: 'single-origin', name: 'Single Origin', description: 'One farm, one region, one story in the cup.', position: 1 },
  { slug: 'blends', name: 'Blends', description: 'Balanced profiles built for every day and every brewer.', position: 2 },
  { slug: 'decaf', name: 'Decaf', description: 'Sugarcane and Swiss Water processed. All flavor, no jitters.', position: 3 },
  { slug: 'equipment', name: 'Equipment', description: 'The tools we use on our own bar.', position: 4 },
];

const coffeeSizes = (base: number, stock = 120): SeedVariant[] => [
  { sku: '', name: '12 oz', weightGrams: 340, priceCents: base, stockQuantity: stock },
  { sku: '', name: '2 lb', weightGrams: 907, priceCents: Math.round(base * 2.45), stockQuantity: Math.round(stock / 3) },
  { sku: '', name: '5 lb', weightGrams: 2268, priceCents: Math.round(base * 5.4), stockQuantity: Math.round(stock / 8) },
];

function withSkus(slug: string, variants: SeedVariant[]): SeedVariant[] {
  return variants.map((v, i) => ({ ...v, sku: `${slug.toUpperCase().replace(/-/g, '')}-${i + 1}` }));
}

export const seedProducts: SeedProduct[] = [
  {
    slug: 'morning-frame',
    name: 'Morning Frame',
    tagline: 'Our house blend. Sweet, structured, dependable.',
    description:
      'Morning Frame is the coffee we reach for before anything else is decided. Brazilian body carries Colombian brightness into a cup that tastes like milk chocolate, toasted hazelnut and a whisper of red apple. It holds up in a French press, sings through a pour over, and takes milk without losing its shape.',
    category: 'coffee',
    origin: 'Brazil & Colombia',
    region: 'Cerrado Mineiro / Huila',
    producer: 'Cooperative lots',
    altitudeM: 1400,
    process: 'Natural & washed',
    roastLevel: 'medium',
    tastingNotes: ['milk chocolate', 'hazelnut', 'red apple'],
    featured: true,
    collections: ['blends'],
    variants: withSkus('morning-frame', coffeeSizes(1800, 200)),
    art: { shape: 'bag', accent: '#C8763A' },
  },
  {
    slug: 'dark-mode-espresso',
    name: 'Dark Mode Espresso',
    tagline: 'Deep, syrupy and built for pressure.',
    description:
      'Dark Mode is our espresso blend for people who like their shots heavy. Sumatra brings the earthy weight, Guatemala brings the cocoa, and a touch of natural Ethiopia keeps the finish from going flat. Expect dark chocolate, molasses and a long, dried-fig finish. Also excellent as a moka pot coffee.',
    category: 'coffee',
    origin: 'Sumatra, Guatemala & Ethiopia',
    region: 'Multi-region',
    producer: 'Selected lots',
    altitudeM: 1500,
    process: 'Wet-hulled, washed & natural',
    roastLevel: 'dark',
    tastingNotes: ['dark chocolate', 'molasses', 'dried fig'],
    featured: true,
    collections: ['blends'],
    variants: withSkus('dark-mode-espresso', coffeeSizes(1900, 160)),
    art: { shape: 'bag', accent: '#33201A' },
  },
  {
    slug: 'hot-reload-cold-brew',
    name: 'Hot Reload Cold Brew Blend',
    tagline: 'Coarse-ground for cold brew. Smooth, chocolatey, refreshing.',
    description:
      'A blend designed from the start for long, cold extraction. Low acidity, huge body, and a finish that tastes like cocoa nibs and vanilla. Ships whole bean or coarse ground. Steep 16 hours at a 1:8 ratio and dilute to taste.',
    category: 'coffee',
    origin: 'Brazil & Peru',
    region: 'Mogiana / Cajamarca',
    producer: 'Cooperative lots',
    altitudeM: 1200,
    process: 'Natural & washed',
    roastLevel: 'medium_dark',
    tastingNotes: ['cocoa nib', 'vanilla', 'brown sugar'],
    collections: ['blends'],
    variants: withSkus('hot-reload-cold-brew', coffeeSizes(1750, 90)),
    art: { shape: 'bag', accent: '#5F7A5A' },
  },
  {
    slug: 'night-build-decaf',
    name: 'Night Build Decaf',
    tagline: 'Sugarcane decaf that still tastes like coffee.',
    description:
      'Night Build is a Colombian decaf processed with ethyl acetate derived from sugarcane, a method that keeps far more of the origin character than most decafs. Caramel sweetness, a soft cherry note and a clean finish. Roasted a shade darker so it holds up with milk late at night.',
    category: 'coffee',
    origin: 'Colombia',
    region: 'Huila',
    producer: 'Descafecol process',
    altitudeM: 1700,
    process: 'Sugarcane EA decaf',
    roastLevel: 'medium_dark',
    tastingNotes: ['caramel', 'cherry', 'graham cracker'],
    collections: ['decaf'],
    variants: withSkus('night-build-decaf', coffeeSizes(1850, 80)),
    art: { shape: 'bag', accent: '#4A2C24' },
  },
  {
    slug: 'ethiopia-yirgacheffe',
    name: 'Ethiopia Yirgacheffe',
    tagline: 'Floral, tea-like, unmistakably Ethiopian.',
    description:
      'Grown between 1,900 and 2,100 meters in the Gedeo zone and washed at the Idido station, this Yirgacheffe is the coffee people mean when they say coffee can taste like flowers. Jasmine, bergamot and a lemon-drop acidity that softens into honey as the cup cools. Best as a pour over.',
    category: 'coffee',
    origin: 'Ethiopia',
    region: 'Yirgacheffe, Gedeo',
    producer: 'Idido washing station',
    altitudeM: 2000,
    process: 'Washed',
    roastLevel: 'light',
    tastingNotes: ['jasmine', 'bergamot', 'lemon drop'],
    featured: true,
    collections: ['single-origin'],
    variants: withSkus('ethiopia-yirgacheffe', coffeeSizes(2200, 110)),
    art: { shape: 'bag', accent: '#D9A441' },
  },
  {
    slug: 'colombia-huila',
    name: 'Colombia Huila',
    tagline: 'Juicy, sweet and impossible to dislike.',
    description:
      'From smallholder farms around Pitalito in southern Huila, this washed lot is the definition of a crowd-pleaser. Panela sweetness, red grape and a bright orange acidity that stays lively through the whole mug. Works in every brewer we have tried.',
    category: 'coffee',
    origin: 'Colombia',
    region: 'Pitalito, Huila',
    producer: 'Asociación smallholders',
    altitudeM: 1750,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['panela', 'red grape', 'orange'],
    featured: true,
    collections: ['single-origin'],
    variants: withSkus('colombia-huila', coffeeSizes(1950, 140)),
    art: { shape: 'bag', accent: '#B5473C' },
  },
  {
    slug: 'guatemala-antigua',
    name: 'Guatemala Antigua',
    tagline: 'Cocoa, spice and volcanic depth.',
    description:
      'Antigua sits in a valley ringed by three volcanoes, and the coffee tastes like it: dense, chocolatey and a little smoky at the edges. This lot from Finca El Valle brings baking spice and a toffee finish. A classic for drip brewers and anyone who takes their coffee with a splash of cream.',
    category: 'coffee',
    origin: 'Guatemala',
    region: 'Antigua, Sacatepéquez',
    producer: 'Finca El Valle',
    altitudeM: 1600,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['cocoa', 'baking spice', 'toffee'],
    collections: ['single-origin'],
    variants: withSkus('guatemala-antigua', coffeeSizes(2000, 100)),
    art: { shape: 'bag', accent: '#7A4E3A' },
  },
  {
    slug: 'kenya-nyeri',
    name: 'Kenya Nyeri AA',
    tagline: 'Blackcurrant, tomato leaf and electric acidity.',
    description:
      'Kenyan coffees are the loudest coffees in the world, and this AA from the Gatomboya factory in Nyeri is no exception. Blackcurrant, a savory tomato-leaf note that sounds strange and tastes wonderful, and a finish like brown sugar. Light roasted to keep every bit of it.',
    category: 'coffee',
    origin: 'Kenya',
    region: 'Nyeri',
    producer: 'Gatomboya factory',
    altitudeM: 1800,
    process: 'Washed, double fermented',
    roastLevel: 'light',
    tastingNotes: ['blackcurrant', 'tomato leaf', 'brown sugar'],
    collections: ['single-origin'],
    variants: withSkus('kenya-nyeri', coffeeSizes(2400, 70)),
    art: { shape: 'bag', accent: '#8A2E3B' },
  },
  {
    slug: 'brazil-cerrado',
    name: 'Brazil Cerrado',
    tagline: 'Nutty, low-acid comfort coffee.',
    description:
      'A natural-process Brazil from the high plateau of Cerrado Mineiro. Roasted peanut, milk chocolate and a soft, rounded body with almost no acidity. This is the coffee for large mugs, long mornings and anyone who has ever said they like coffee that tastes like coffee.',
    category: 'coffee',
    origin: 'Brazil',
    region: 'Cerrado Mineiro',
    producer: 'Fazenda Santa Inês',
    altitudeM: 1150,
    process: 'Natural',
    roastLevel: 'medium_dark',
    tastingNotes: ['roasted peanut', 'milk chocolate', 'cream'],
    collections: ['single-origin'],
    variants: withSkus('brazil-cerrado', coffeeSizes(1700, 180)),
    art: { shape: 'bag', accent: '#A08977' },
  },
  {
    slug: 'sumatra-mandheling',
    name: 'Sumatra Mandheling',
    tagline: 'Earthy, herbal and heavy as a blanket.',
    description:
      'Wet-hulled in the traditional Sumatran way, this Mandheling is thick, low-acid and full of cedar, dark chocolate and dried herbs. It is polarizing and we love it. Try it in a French press or as the base of a moka pot latte.',
    category: 'coffee',
    origin: 'Indonesia',
    region: 'Lintong, North Sumatra',
    producer: 'Smallholder collectors',
    altitudeM: 1400,
    process: 'Wet-hulled (Giling Basah)',
    roastLevel: 'dark',
    tastingNotes: ['cedar', 'dark chocolate', 'dried herbs'],
    collections: ['single-origin'],
    variants: withSkus('sumatra-mandheling', coffeeSizes(1900, 60)),
    art: { shape: 'bag', accent: '#2F3A2E' },
  },
  {
    slug: 'costa-rica-tarrazu',
    name: 'Costa Rica Tarrazú',
    tagline: 'Honey processed. Clean, sweet, apricot-bright.',
    description:
      'From a micro-mill in the Tarrazú highlands, this honey-processed lot keeps a layer of mucilage on the bean during drying, which shows up as apricot sweetness and a silky body. Balanced enough for espresso, expressive enough for filter.',
    category: 'coffee',
    origin: 'Costa Rica',
    region: 'Tarrazú',
    producer: 'Micro-mill La Lía',
    altitudeM: 1900,
    process: 'Yellow honey',
    roastLevel: 'light',
    tastingNotes: ['apricot', 'honey', 'almond'],
    collections: ['single-origin'],
    variants: withSkus('costa-rica-tarrazu', coffeeSizes(2100, 75)),
    art: { shape: 'bag', accent: '#E0A458' },
  },
  {
    slug: 'peru-cajamarca',
    name: 'Peru Cajamarca',
    tagline: 'Gentle, sweet and organic.',
    description:
      'Certified organic coffee from smallholder farms in the Cajamarca region of northern Peru. Soft citrus, caramel and a nougat-like finish. An easy-drinking, everyday single origin with a lot more nuance than its price suggests.',
    category: 'coffee',
    origin: 'Peru',
    region: 'Cajamarca',
    producer: 'Cooperativa Sol y Café',
    altitudeM: 1800,
    process: 'Washed',
    roastLevel: 'medium',
    tastingNotes: ['caramel', 'soft citrus', 'nougat'],
    collections: ['single-origin'],
    variants: withSkus('peru-cajamarca', coffeeSizes(1800, 130)),
    art: { shape: 'bag', accent: '#6B8E6B' },
  },
  {
    slug: 'pour-over-dripper',
    name: 'Cofresso Ceramic Dripper',
    tagline: 'A cone dripper with a single large hole and a lot of patience.',
    description:
      'Our house dripper, made from matte stoneware in the cream of our logo. A single large outlet and spiral ribs give you full control over flow rate. Fits size 02 cone filters and most mugs and servers.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [{ sku: 'DRIPPER-1', name: 'Size 02', weightGrams: 380, priceCents: 3200, stockQuantity: 45 }],
    art: { shape: 'dripper', accent: '#F6F1EB' },
  },
  {
    slug: 'gooseneck-kettle',
    name: 'Gooseneck Kettle',
    tagline: 'Precise pours, 1.0 L, stovetop or induction.',
    description:
      'A stainless gooseneck kettle with a counter-balanced handle and a built-in thermometer in the lid. The spout produces a thin, controllable stream that makes blooms and pulse pours effortless.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [
      { sku: 'KETTLE-1', name: 'Matte black', weightGrams: 900, priceCents: 6800, stockQuantity: 30 },
      { sku: 'KETTLE-2', name: 'Brushed steel', weightGrams: 900, priceCents: 6400, compareAtPriceCents: 6800, stockQuantity: 18 },
    ],
    art: { shape: 'kettle', accent: '#33201A' },
  },
  {
    slug: 'hand-grinder',
    name: 'Hand Grinder',
    tagline: 'Stainless conical burrs, 40 click settings.',
    description:
      'A compact hand grinder with 38 mm stainless conical burrs and a stepped adjustment dial that goes from Turkish to French press. Grinds 30 grams in about 45 seconds. Ships with a carrying case.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [{ sku: 'GRINDER-1', name: 'Standard', weightGrams: 480, priceCents: 9900, stockQuantity: 22 }],
    art: { shape: 'grinder', accent: '#A08977' },
  },
  {
    slug: 'brew-scale',
    name: 'Brew Scale',
    tagline: '0.1 g resolution with a built-in timer.',
    description:
      'A rechargeable scale with 0.1 gram resolution, a 2 kg capacity and a timer that starts when you begin pouring. Silicone mat included. The display stays readable under a dripper.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [{ sku: 'SCALE-1', name: 'Standard', weightGrams: 300, priceCents: 4500, stockQuantity: 40 }],
    art: { shape: 'scale', accent: '#4A2C24' },
  },
  {
    slug: 'paper-filters',
    name: 'Paper Filters, size 02',
    tagline: '100 oxygen-bleached cone filters.',
    description: 'Oxygen-bleached, unbleached-taste-free cone filters that fit our dripper and any size 02 cone. Rinse once before brewing.',
    category: 'equipment',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [{ sku: 'FILTERS-1', name: '100 pack', weightGrams: 150, priceCents: 900, stockQuantity: 300 }],
    art: { shape: 'filters', accent: '#FFFDFA' },
  },
  {
    slug: 'cofresso-mug',
    name: 'Cofresso Stoneware Mug',
    tagline: '12 oz, espresso glaze, logo debossed.',
    description: 'A heavy stoneware mug in our espresso brown with the double-bean logo debossed on the side. Dishwasher safe. Holds exactly one Morning Frame.',
    category: 'merch',
    tastingNotes: [],
    collections: ['equipment'],
    variants: [{ sku: 'MUG-1', name: '12 oz', weightGrams: 400, priceCents: 2400, stockQuantity: 60 }],
    art: { shape: 'mug', accent: '#4A2C24' },
  },
];

export const seedDiscountCodes: SeedDiscountCode[] = [
  { code: 'WELCOME10', kind: 'percent', value: 10, minSubtotalCents: 0 },
  { code: 'FREESHIP', kind: 'free_shipping', value: 0, minSubtotalCents: 0 },
  { code: 'COFRAME15', kind: 'percent', value: 15, minSubtotalCents: 3000 },
];
```

- [ ] **Step 3: Review generator**

`src/lib/db/seed/reviews.ts`:
```ts
import { seedProducts } from './data';

export interface SeedReview {
  key: string;
  productSlug: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  daysAgo: number;
}

const authors = [
  'Priya R.', 'Marcus L.', 'Elena V.', 'Tom H.', 'Ayo B.', 'Sofia M.', 'Daniel K.', 'Hana S.',
  'Luca P.', 'Grace W.', 'Omar F.', 'Nina T.', 'Jules A.', 'Ravi N.', 'Maya O.', 'Ben C.',
];

const coffeeTemplates: Array<{ rating: number; title: string; body: (notes: string[], name: string) => string }> = [
  { rating: 5, title: 'Exactly as described', body: (n, name) => `The ${n[0]} note is right there from the first sip. ${name} has become my default morning coffee.` },
  { rating: 5, title: 'Best pour over in months', body: (n) => `Brewed on a V60 at 1:16 and got a gorgeous cup: ${n[0]}, ${n[1]}, and a clean finish.` },
  { rating: 4, title: 'Great, a little pricey', body: (n) => `Really enjoyable, especially the ${n[2] ?? n[0]} in the finish. Wish the 2 lb bag were a touch cheaper.` },
  { rating: 4, title: 'Solid everyday cup', body: (_n, name) => `${name} is consistent bag to bag, which is more than I can say for most roasters.` },
  { rating: 5, title: 'Subscription was the right call', body: () => 'Signed up for every four weeks and the roast date is always within a week of delivery. Fresh every time.' },
  { rating: 3, title: 'Not for me, but well roasted', body: (n) => `The ${n[0]} was more pronounced than I like. Roast quality is clearly high though.` },
];

const gearTemplates: Array<{ rating: number; title: string; body: (name: string) => string }> = [
  { rating: 5, title: 'Well made', body: (name) => `The ${name} feels far more premium than the price. Packaging was thoughtful too.` },
  { rating: 4, title: 'Does the job', body: (name) => `${name} works exactly as advertised. Took a star because shipping took a few days longer than expected.` },
  { rating: 5, title: 'Upgraded my whole setup', body: () => 'Paired it with the Morning Frame subscription and my kitchen counter looks like a cafe now.' },
];

export function buildSeedReviews(): SeedReview[] {
  const out: SeedReview[] = [];
  seedProducts.forEach((product, pIndex) => {
    const count = product.category === 'coffee' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const author = authors[(pIndex * 3 + i) % authors.length];
      if (product.category === 'coffee') {
        const t = coffeeTemplates[(pIndex + i) % coffeeTemplates.length];
        out.push({
          key: `${product.slug}:${i}`,
          productSlug: product.slug,
          authorName: author,
          rating: t.rating,
          title: t.title,
          body: t.body(product.tastingNotes, product.name),
          verified: i !== 2,
          daysAgo: 4 + pIndex * 5 + i * 9,
        });
      } else {
        const t = gearTemplates[(pIndex + i) % gearTemplates.length];
        out.push({
          key: `${product.slug}:${i}`,
          productSlug: product.slug,
          authorName: author,
          rating: t.rating,
          title: t.title,
          body: t.body(product.name),
          verified: true,
          daysAgo: 6 + pIndex * 4 + i * 11,
        });
      }
    }
  });
  return out;
}
```

- [ ] **Step 4: Idempotent seeder (replaces the Task 2 stub)**

`src/lib/db/seed/index.ts`:
```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  collections,
  discountCodes,
  productCollections,
  productVariants,
  products,
  reviews,
} from '@/lib/db/schema';
import { seedCollections, seedDiscountCodes, seedProducts } from './data';
import { stableId } from './ids';
import { buildSeedReviews } from './reviews';

export interface SeedSummary {
  collections: number;
  products: number;
  variants: number;
  reviews: number;
  discountCodes: number;
}

export async function runSeed(db: Db): Promise<SeedSummary> {
  const seedReviews = buildSeedReviews();

  await db.transaction(async (tx) => {
    for (const c of seedCollections) {
      await tx
        .insert(collections)
        .values({ id: stableId(`collection:${c.slug}`), ...c })
        .onConflictDoUpdate({
          target: collections.slug,
          set: { name: c.name, description: c.description, position: c.position },
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
      await tx.insert(products).values(values).onConflictDoUpdate({ target: products.slug, set: updatable });

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
          .values({ productId, collectionId: stableId(`collection:${collectionSlug}`), position: index })
          .onConflictDoUpdate({
            target: [productCollections.productId, productCollections.collectionId],
            set: { position: index },
          });
      }
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
          set: { authorName: r.authorName, rating: r.rating, title: r.title, body: r.body, verified: r.verified },
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
    await tx.execute(sql`select setval('order_number_seq', greatest(nextval('order_number_seq'), 10001), false)`);
  });

  return {
    collections: seedCollections.length,
    products: seedProducts.length,
    variants: seedProducts.reduce((n, p) => n + p.variants.length, 0),
    reviews: seedReviews.length,
    discountCodes: seedDiscountCodes.length,
  };
}
```

- [ ] **Step 5: Integration test for idempotency**

`tests/integration/seed.test.ts`:
```ts
import { count, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { productVariants, products, reviews } from '../../src/lib/db/schema';
import { runSeed } from '../../src/lib/db/seed';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('runSeed', () => {
  it('is idempotent', async () => {
    const before = await db.select({ n: count() }).from(products);
    const summary = await runSeed(db);
    const after = await db.select({ n: count() }).from(products);
    expect(after[0].n).toBe(before[0].n);
    expect(summary.products).toBe(after[0].n);
    const reviewCount = await db.select({ n: count() }).from(reviews);
    expect(reviewCount[0].n).toBe(summary.reviews);
  });

  it('does not clobber stock on re-seed', async () => {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.sku, 'MORNINGFRAME-1'));
    await db.update(productVariants).set({ stockQuantity: 7 }).where(eq(productVariants.id, variant.id));
    await runSeed(db);
    const [again] = await db.select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(again.stockQuantity).toBe(7);
    await db.update(productVariants).set({ stockQuantity: variant.stockQuantity }).where(eq(productVariants.id, variant.id));
  });
});
```

Run: `pnpm test:integration`
Expected: PASS.

- [ ] **Step 6: Product art generator**

`scripts/generate-product-art.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { seedProducts, type SeedProduct } from '../src/lib/db/seed/data';

const W = 600;
const H = 750;
const palette = { espresso: '#4A2C24', latte: '#A08977', cream: '#F6F1EB', foam: '#FFFDFA', copper: '#C8763A' };

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(text: string, max = 16): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function textContrast(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? palette.espresso : palette.foam;
}

function roastDots(level: SeedProduct['roastLevel']) {
  const n = { light: 1, medium: 2, medium_dark: 3, dark: 4 }[level ?? 'medium'];
  return Array.from({ length: 4 }, (_, i) =>
    `<circle cx="${230 + i * 36}" cy="560" r="9" fill="${i < n ? palette.espresso : 'none'}" stroke="${palette.espresso}" stroke-width="3"/>`,
  ).join('');
}

function bag(p: SeedProduct): string {
  const fg = textContrast(p.art.accent);
  const nameLines = wrap(p.name);
  const nameY = 300 - (nameLines.length - 1) * 26;
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.cream}"/><stop offset="1" stop-color="#EDE4DA"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${palette.espresso}" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <path d="M150 150 h300 a20 20 0 0 1 20 20 v470 a28 28 0 0 1 -28 28 h-284 a28 28 0 0 1 -28 -28 v-470 a20 20 0 0 1 20 -20z" fill="${palette.espresso}"/>
    <rect x="130" y="130" width="340" height="52" rx="10" fill="${palette.espresso}"/>
    <rect x="130" y="176" width="340" height="14" fill="#33201A"/>
    <rect x="165" y="230" width="270" height="380" rx="14" fill="${p.art.accent}"/>
  </g>
  <text x="300" y="262" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="4" fill="${fg}" opacity="0.85">COFRESSO</text>
  ${nameLines
    .map((l, i) => `<text x="300" y="${nameY + i * 42}" text-anchor="middle" font-family="Georgia, serif" font-weight="600" font-size="34" fill="${fg}">${esc(l)}</text>`)
    .join('')}
  <line x1="220" y1="${nameY + nameLines.length * 42 - 8}" x2="380" y2="${nameY + nameLines.length * 42 - 8}" stroke="${fg}" stroke-opacity="0.5"/>
  ${p.origin ? `<text x="300" y="${nameY + nameLines.length * 42 + 26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="${fg}" opacity="0.9">${esc(p.origin.toUpperCase())}</text>` : ''}
  ${p.tastingNotes.length ? `<text x="300" y="${nameY + nameLines.length * 42 + 54}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${fg}" opacity="0.8">${esc(p.tastingNotes.join(' · '))}</text>` : ''}
  <g transform="translate(0,0)">${roastDots(p.roastLevel).replaceAll(palette.espresso, fg)}</g>
  <text x="300" y="595" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="2" fill="${fg}" opacity="0.7">${esc(p.process?.toUpperCase() ?? 'WHOLE BEAN')}</text>`;
}

function gear(p: SeedProduct): string {
  const a = p.art.accent;
  const shapes: Record<string, string> = {
    dripper: `<path d="M170 250 h260 l-90 250 h-80z" fill="${a}" stroke="${palette.espresso}" stroke-width="6"/><rect x="220" y="500" width="160" height="30" rx="8" fill="${palette.espresso}"/><rect x="255" y="530" width="90" height="70" rx="6" fill="${palette.latte}"/>`,
    kettle: `<path d="M190 330 q110 -40 220 0 v200 a30 30 0 0 1 -30 30 h-160 a30 30 0 0 1 -30 -30z" fill="${a}"/><path d="M410 380 q90 -60 60 -140" stroke="${a}" stroke-width="22" fill="none" stroke-linecap="round"/><rect x="150" y="300" width="60" height="150" rx="14" fill="${palette.latte}"/><circle cx="300" cy="320" r="18" fill="${palette.foam}"/>`,
    grinder: `<rect x="230" y="260" width="140" height="300" rx="28" fill="${a}"/><rect x="250" y="300" width="100" height="120" rx="12" fill="${palette.foam}" opacity="0.7"/><rect x="290" y="200" width="20" height="70" fill="${palette.espresso}"/><path d="M300 200 h110 a14 14 0 0 1 0 28 h-110" fill="${palette.espresso}"/>`,
    scale: `<rect x="150" y="380" width="300" height="160" rx="22" fill="${a}"/><rect x="180" y="400" width="240" height="60" rx="8" fill="${palette.latte}"/><rect x="200" y="480" width="160" height="34" rx="6" fill="#1a1a1a"/><text x="280" y="505" text-anchor="middle" font-family="monospace" font-size="24" fill="#8CFFB0">18.0 g</text>`,
    filters: `<path d="M160 240 h280 l-90 250 h-100z" fill="${a}" stroke="${palette.latte}" stroke-width="4"/><path d="M175 255 h250 l-85 225 h-80z" fill="${palette.foam}" stroke="${palette.latte}" stroke-width="3"/><path d="M190 270 h220 l-80 200 h-60z" fill="${a}" stroke="${palette.latte}" stroke-width="3"/>`,
    mug: `<rect x="190" y="280" width="200" height="260" rx="26" fill="${a}"/><path d="M390 330 h30 a45 45 0 0 1 0 110 h-30" fill="none" stroke="${a}" stroke-width="28"/><rect x="230" y="330" width="120" height="120" rx="60" fill="${palette.latte}" opacity="0.35"/>`,
  };
  return `
  <rect width="${W}" height="${H}" fill="${palette.cream}"/>
  <ellipse cx="300" cy="590" rx="190" ry="26" fill="${palette.espresso}" opacity="0.12"/>
  ${shapes[p.art.shape] ?? shapes.mug}
  <text x="300" y="660" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette.espresso}">${esc(p.name)}</text>
  <text x="300" y="690" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="3" fill="${palette.latte}">COFRESSO EQUIPMENT</text>`;
}

function render(p: SeedProduct): string {
  const body = p.art.shape === 'bag' ? bag(p) : gear(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(p.name)}">${body}\n</svg>\n`;
}

const outDir = path.resolve(process.cwd(), 'public/products');
mkdirSync(outDir, { recursive: true });
for (const p of seedProducts) {
  writeFileSync(path.join(outDir, `${p.slug}.svg`), render(p));
}
console.log(`Wrote ${seedProducts.length} product images to ${outDir}`);
```

Add script: `"art:generate": "tsx scripts/generate-product-art.ts"`.

Run: `pnpm art:generate && ls public/products | wc -l`
Expected: 18 files. Open one in a browser (`open public/products/morning-frame.svg`) and confirm it renders as a bag with a label.

- [ ] **Step 7: Seed the local database**

Run: `pnpm db:seed`
Expected: `Seed complete: {"collections":4,"products":18,"variants":45,"reviews":48,"discountCodes":3}` (variant and review counts may differ by a few; products must be 18).

- [ ] **Step 8: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add catalog seed data, idempotent seeder and generated product art"
```

---

### Task 4: Pure pricing module

**Files:**
- Create: `src/lib/pricing/types.ts`, `src/lib/pricing/index.ts`, `src/lib/pricing/discounts.ts`
- Test: `src/lib/pricing/index.test.ts`, `src/lib/pricing/discounts.test.ts`

**Interfaces:**
- Produces:
  - `type PricingLine = { unitPriceCents: number; quantity: number; purchaseType: 'one_time' | 'subscription' }`
  - `type DiscountRule = { kind: 'percent' | 'fixed' | 'free_shipping'; value: number; minSubtotalCents: number }`
  - `type Totals = { itemCount; subtotalCents; subscriptionSavingsCents; discountCents; discountedSubtotalCents; shippingCents; taxCents; totalCents; freeShippingRemainingCents; freeShippingUnlocked }`
  - `effectiveUnitPriceCents(line, cfg)`, `lineTotalCents(line, cfg)`, `computeDiscountCents(rule, subtotalCents)`, `computeTotals(lines, rule, cfg)`, `formatPrice(cents)`
  - `evaluateDiscountCode(code: DiscountCodeLike, subtotalCents, now): { ok: true; rule: DiscountRule } | { ok: false; reason: DiscountFailure; message: string }`
- Consumes: `siteConfig.pricing` from Task 2.

- [ ] **Step 1: Failing tests for totals**

`src/lib/pricing/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeDiscountCents, computeTotals, effectiveUnitPriceCents, formatPrice, lineTotalCents } from './index';
import type { PricingConfig, PricingLine } from './types';

const cfg: PricingConfig = {
  subscriptionDiscountPercent: 15,
  shippingFlatCents: 600,
  freeShippingThresholdCents: 4500,
  taxRate: 0.08,
};

const line = (unitPriceCents: number, quantity = 1, purchaseType: PricingLine['purchaseType'] = 'one_time'): PricingLine => ({
  unitPriceCents,
  quantity,
  purchaseType,
});

describe('effectiveUnitPriceCents', () => {
  it('returns the list price for one-time purchases', () => {
    expect(effectiveUnitPriceCents(line(1800), cfg)).toBe(1800);
  });
  it('applies the subscription discount rounded to the cent', () => {
    expect(effectiveUnitPriceCents(line(1800, 1, 'subscription'), cfg)).toBe(1530);
    expect(effectiveUnitPriceCents(line(1999, 1, 'subscription'), cfg)).toBe(1699);
  });
});

describe('lineTotalCents', () => {
  it('multiplies by quantity', () => {
    expect(lineTotalCents(line(1800, 3), cfg)).toBe(5400);
    expect(lineTotalCents(line(1800, 2, 'subscription'), cfg)).toBe(3060);
  });
});

describe('computeDiscountCents', () => {
  it('handles percent, fixed and free shipping', () => {
    expect(computeDiscountCents({ kind: 'percent', value: 10, minSubtotalCents: 0 }, 5400)).toBe(540);
    expect(computeDiscountCents({ kind: 'fixed', value: 1000, minSubtotalCents: 0 }, 5400)).toBe(1000);
    expect(computeDiscountCents({ kind: 'fixed', value: 10000, minSubtotalCents: 0 }, 5400)).toBe(5400);
    expect(computeDiscountCents({ kind: 'free_shipping', value: 0, minSubtotalCents: 0 }, 5400)).toBe(0);
    expect(computeDiscountCents(null, 5400)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('charges flat shipping under the threshold and tax on the discounted subtotal', () => {
    const t = computeTotals([line(1800, 2)], null, cfg);
    expect(t).toMatchObject({
      itemCount: 2,
      subtotalCents: 3600,
      subscriptionSavingsCents: 0,
      discountCents: 0,
      discountedSubtotalCents: 3600,
      shippingCents: 600,
      taxCents: 288,
      totalCents: 4488,
      freeShippingRemainingCents: 900,
      freeShippingUnlocked: false,
    });
  });

  it('unlocks free shipping at the threshold', () => {
    const t = computeTotals([line(4500)], null, cfg);
    expect(t.shippingCents).toBe(0);
    expect(t.freeShippingUnlocked).toBe(true);
    expect(t.freeShippingRemainingCents).toBe(0);
  });

  it('applies subscription savings before the discount code', () => {
    const t = computeTotals([line(2000, 2, 'subscription')], { kind: 'percent', value: 10, minSubtotalCents: 0 }, cfg);
    expect(t.subscriptionSavingsCents).toBe(600);
    expect(t.subtotalCents).toBe(3400);
    expect(t.discountCents).toBe(340);
    expect(t.discountedSubtotalCents).toBe(3060);
    expect(t.shippingCents).toBe(600);
    expect(t.taxCents).toBe(245);
    expect(t.totalCents).toBe(3905);
  });

  it('free shipping code zeroes shipping and nothing else', () => {
    const t = computeTotals([line(1000)], { kind: 'free_shipping', value: 0, minSubtotalCents: 0 }, cfg);
    expect(t.discountCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(1080);
  });

  it('a discount can drop the subtotal below the free-shipping threshold', () => {
    const t = computeTotals([line(4600)], { kind: 'fixed', value: 500, minSubtotalCents: 0 }, cfg);
    expect(t.discountedSubtotalCents).toBe(4100);
    expect(t.shippingCents).toBe(600);
  });

  it('never goes negative', () => {
    const t = computeTotals([line(500)], { kind: 'fixed', value: 99999, minSubtotalCents: 0 }, cfg);
    expect(t.discountedSubtotalCents).toBe(0);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(600);
  });

  it('handles an empty cart', () => {
    const t = computeTotals([], null, cfg);
    expect(t.totalCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.itemCount).toBe(0);
  });
});

describe('formatPrice', () => {
  it('formats cents as USD', () => {
    expect(formatPrice(1800)).toBe('$18.00');
    expect(formatPrice(4488)).toBe('$44.88');
    expect(formatPrice(0)).toBe('$0.00');
  });
});
```

Run: `pnpm test:unit src/lib/pricing`
Expected: FAIL, module not found.

- [ ] **Step 2: Implement types and totals**

`src/lib/pricing/types.ts`:
```ts
export type PricingPurchaseType = 'one_time' | 'subscription';

export interface PricingLine {
  unitPriceCents: number;
  quantity: number;
  purchaseType: PricingPurchaseType;
}

export type DiscountRuleKind = 'percent' | 'fixed' | 'free_shipping';

export interface DiscountRule {
  kind: DiscountRuleKind;
  /** Percent (0-100) for `percent`, cents for `fixed`, ignored for `free_shipping`. */
  value: number;
  minSubtotalCents: number;
}

export interface PricingConfig {
  subscriptionDiscountPercent: number;
  shippingFlatCents: number;
  freeShippingThresholdCents: number;
  taxRate: number;
}

export interface Totals {
  itemCount: number;
  /** Sum of line totals after subscription savings, before discount codes. */
  subtotalCents: number;
  subscriptionSavingsCents: number;
  discountCents: number;
  discountedSubtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShippingRemainingCents: number;
  freeShippingUnlocked: boolean;
}
```

`src/lib/pricing/index.ts`:
```ts
import { siteConfig } from '@/lib/config';
import type { DiscountRule, PricingConfig, PricingLine, Totals } from './types';

export * from './types';
export * from './discounts';

export const defaultPricingConfig: PricingConfig = siteConfig.pricing;

export function subscriptionUnitPriceCents(unitPriceCents: number, cfg: PricingConfig): number {
  return Math.round((unitPriceCents * (100 - cfg.subscriptionDiscountPercent)) / 100);
}

export function effectiveUnitPriceCents(line: PricingLine, cfg: PricingConfig = defaultPricingConfig): number {
  return line.purchaseType === 'subscription'
    ? subscriptionUnitPriceCents(line.unitPriceCents, cfg)
    : line.unitPriceCents;
}

export function lineTotalCents(line: PricingLine, cfg: PricingConfig = defaultPricingConfig): number {
  return effectiveUnitPriceCents(line, cfg) * line.quantity;
}

export function computeDiscountCents(rule: DiscountRule | null, subtotalCents: number): number {
  if (!rule) return 0;
  switch (rule.kind) {
    case 'percent':
      return Math.min(subtotalCents, Math.round((subtotalCents * rule.value) / 100));
    case 'fixed':
      return Math.min(subtotalCents, Math.max(0, rule.value));
    case 'free_shipping':
      return 0;
  }
}

export function computeTotals(
  lines: PricingLine[],
  rule: DiscountRule | null,
  cfg: PricingConfig = defaultPricingConfig,
): Totals {
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const listSubtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const subtotalCents = lines.reduce((n, l) => n + lineTotalCents(l, cfg), 0);
  const subscriptionSavingsCents = listSubtotal - subtotalCents;
  const discountCents = computeDiscountCents(rule, subtotalCents);
  const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);

  const freeShippingUnlocked = discountedSubtotalCents >= cfg.freeShippingThresholdCents;
  const freeShippingRemainingCents = Math.max(0, cfg.freeShippingThresholdCents - discountedSubtotalCents);
  const shippingCents =
    itemCount === 0 || freeShippingUnlocked || rule?.kind === 'free_shipping' ? 0 : cfg.shippingFlatCents;

  const taxCents = Math.round(discountedSubtotalCents * cfg.taxRate);
  const totalCents = discountedSubtotalCents + shippingCents + taxCents;

  return {
    itemCount,
    subtotalCents,
    subscriptionSavingsCents,
    discountCents,
    discountedSubtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    freeShippingRemainingCents,
    freeShippingUnlocked,
  };
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}
```

- [ ] **Step 3: Failing tests for discount code evaluation**

`src/lib/pricing/discounts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { evaluateDiscountCode, type DiscountCodeLike } from './discounts';

const base: DiscountCodeLike = {
  code: 'WELCOME10',
  kind: 'percent',
  value: 10,
  minSubtotalCents: 0,
  active: true,
  startsAt: null,
  expiresAt: null,
};
const now = new Date('2026-09-06T12:00:00Z');

describe('evaluateDiscountCode', () => {
  it('returns a rule for a valid code', () => {
    expect(evaluateDiscountCode(base, 5000, now)).toEqual({
      ok: true,
      rule: { kind: 'percent', value: 10, minSubtotalCents: 0 },
    });
  });
  it('rejects inactive codes', () => {
    expect(evaluateDiscountCode({ ...base, active: false }, 5000, now)).toMatchObject({ ok: false, reason: 'inactive' });
  });
  it('rejects codes that have not started or have expired', () => {
    expect(evaluateDiscountCode({ ...base, startsAt: new Date('2027-01-01') }, 5000, now)).toMatchObject({ ok: false, reason: 'not_started' });
    expect(evaluateDiscountCode({ ...base, expiresAt: new Date('2026-01-01') }, 5000, now)).toMatchObject({ ok: false, reason: 'expired' });
  });
  it('enforces the minimum subtotal with a helpful message', () => {
    const r = evaluateDiscountCode({ ...base, minSubtotalCents: 3000 }, 2500, now);
    expect(r).toMatchObject({ ok: false, reason: 'min_subtotal' });
    if (!r.ok) expect(r.message).toContain('$30.00');
  });
});
```

- [ ] **Step 4: Implement `discounts.ts`**

```ts
import type { DiscountRule } from './types';

export interface DiscountCodeLike {
  code: string;
  kind: DiscountRule['kind'];
  value: number;
  minSubtotalCents: number;
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
}

export type DiscountFailure = 'inactive' | 'not_started' | 'expired' | 'min_subtotal';

export type DiscountEvaluation =
  | { ok: true; rule: DiscountRule }
  | { ok: false; reason: DiscountFailure; message: string };

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function evaluateDiscountCode(code: DiscountCodeLike, subtotalCents: number, now = new Date()): DiscountEvaluation {
  if (!code.active) return { ok: false, reason: 'inactive', message: 'That code is no longer active.' };
  if (code.startsAt && code.startsAt > now) return { ok: false, reason: 'not_started', message: 'That code is not active yet.' };
  if (code.expiresAt && code.expiresAt < now) return { ok: false, reason: 'expired', message: 'That code has expired.' };
  if (subtotalCents < code.minSubtotalCents) {
    return {
      ok: false,
      reason: 'min_subtotal',
      message: `Spend at least ${usd.format(code.minSubtotalCents / 100)} to use ${code.code}.`,
    };
  }
  return { ok: true, rule: { kind: code.kind, value: code.value, minSubtotalCents: code.minSubtotalCents } };
}
```

Run: `pnpm test:unit src/lib/pricing`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add pure pricing module with subscription, discount, shipping and tax rules"
```

---

### Task 5: Payment provider interface and simulated provider

**Files:**
- Create: `src/lib/payments/types.ts`, `src/lib/payments/luhn.ts`, `src/lib/payments/simulated.ts`, `src/lib/payments/index.ts`
- Test: `src/lib/payments/luhn.test.ts`, `src/lib/payments/simulated.test.ts`

**Interfaces:**
- Produces:
  - `interface CardInput { number: string; expMonth: number; expYear: number; cvc: string; name: string }`
  - `interface AuthorizeInput { amountCents: number; currency: 'USD'; card: CardInput; idempotencyKey: string }`
  - `type AuthorizeResult = { ok: true; reference: string; last4: string } | { ok: false; code: PaymentDeclineCode; message: string }`
  - `type PaymentDeclineCode = 'declined' | 'insufficient_funds' | 'invalid_card' | 'processing_error'`
  - `interface PaymentProvider { readonly name: string; authorize(input: AuthorizeInput): Promise<AuthorizeResult> }`
  - `class SimulatedPaymentProvider implements PaymentProvider` with constructor `({ now?: () => Date })`
  - `getPaymentProvider(): PaymentProvider`, `luhnCheck(number: string): boolean`, `normalizeCardNumber(s): string`, `TEST_CARDS`

- [ ] **Step 1: Luhn test then implementation**

`src/lib/payments/luhn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { luhnCheck, normalizeCardNumber } from './luhn';

describe('luhn', () => {
  it('accepts valid numbers with or without spaces', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
    expect(luhnCheck('4000000000000002')).toBe(true);
    expect(luhnCheck('5555 5555 5555 4444')).toBe(true);
  });
  it('rejects invalid numbers and garbage', () => {
    expect(luhnCheck('4242 4242 4242 4241')).toBe(false);
    expect(luhnCheck('1234')).toBe(false);
    expect(luhnCheck('abcd')).toBe(false);
    expect(luhnCheck('')).toBe(false);
  });
  it('normalizes by stripping non-digits', () => {
    expect(normalizeCardNumber('4242-4242 4242.4242')).toBe('4242424242424242');
  });
});
```

`src/lib/payments/luhn.ts`:
```ts
export function normalizeCardNumber(input: string): string {
  return input.replace(/\D/g, '');
}

export function luhnCheck(input: string): boolean {
  const digits = normalizeCardNumber(input);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
```

- [ ] **Step 2: Simulated provider tests**

`src/lib/payments/simulated.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SimulatedPaymentProvider, TEST_CARDS } from './simulated';
import type { CardInput } from './types';

const now = () => new Date('2026-09-06T00:00:00Z');
const provider = new SimulatedPaymentProvider({ now });
const card = (number: string, overrides: Partial<CardInput> = {}): CardInput => ({
  number,
  expMonth: 12,
  expYear: 2030,
  cvc: '123',
  name: 'Ada Lovelace',
  ...overrides,
});
const authorize = (c: CardInput) =>
  provider.authorize({ amountCents: 4488, currency: 'USD', card: c, idempotencyKey: 'key-1' });

describe('SimulatedPaymentProvider', () => {
  it('approves the standard test card and returns last4', async () => {
    const r = await authorize(card(TEST_CARDS.approved));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reference).toMatch(/^sim_[a-z0-9]+$/);
      expect(r.last4).toBe('4242');
    }
  });
  it('maps the decline test cards', async () => {
    await expect(authorize(card(TEST_CARDS.declined))).resolves.toMatchObject({ ok: false, code: 'declined' });
    await expect(authorize(card(TEST_CARDS.insufficientFunds))).resolves.toMatchObject({ ok: false, code: 'insufficient_funds' });
    await expect(authorize(card(TEST_CARDS.processingError))).resolves.toMatchObject({ ok: false, code: 'processing_error' });
  });
  it('rejects invalid card data', async () => {
    await expect(authorize(card('4242 4242 4242 4241'))).resolves.toMatchObject({ ok: false, code: 'invalid_card' });
    await expect(authorize(card(TEST_CARDS.approved, { expYear: 2020 }))).resolves.toMatchObject({ ok: false, code: 'invalid_card' });
    await expect(authorize(card(TEST_CARDS.approved, { cvc: '1' }))).resolves.toMatchObject({ ok: false, code: 'invalid_card' });
    await expect(authorize(card(TEST_CARDS.approved, { expMonth: 13 }))).resolves.toMatchObject({ ok: false, code: 'invalid_card' });
  });
  it('approves any other Luhn-valid card', async () => {
    const r = await authorize(card('5555 5555 5555 4444'));
    expect(r.ok).toBe(true);
  });
  it('rejects a card expiring this month last month', async () => {
    const r = await authorize(card(TEST_CARDS.approved, { expMonth: 8, expYear: 2026 }));
    expect(r).toMatchObject({ ok: false, code: 'invalid_card' });
    const ok = await authorize(card(TEST_CARDS.approved, { expMonth: 9, expYear: 2026 }));
    expect(ok.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Implement types, simulated provider and index**

`src/lib/payments/types.ts`:
```ts
export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  name: string;
}

export interface AuthorizeInput {
  amountCents: number;
  currency: 'USD';
  card: CardInput;
  idempotencyKey: string;
}

export type PaymentDeclineCode = 'declined' | 'insufficient_funds' | 'invalid_card' | 'processing_error';

export type AuthorizeResult =
  | { ok: true; reference: string; last4: string }
  | { ok: false; code: PaymentDeclineCode; message: string };

export interface PaymentProvider {
  readonly name: string;
  authorize(input: AuthorizeInput): Promise<AuthorizeResult>;
}
```

`src/lib/payments/simulated.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { luhnCheck, normalizeCardNumber } from './luhn';
import type { AuthorizeInput, AuthorizeResult, PaymentDeclineCode, PaymentProvider } from './types';

export const TEST_CARDS = {
  approved: '4242424242424242',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
  processingError: '4000000000000119',
} as const;

const outcomes: Record<string, { code: PaymentDeclineCode; message: string }> = {
  [TEST_CARDS.declined]: { code: 'declined', message: 'Your card was declined.' },
  [TEST_CARDS.insufficientFunds]: { code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
  [TEST_CARDS.processingError]: { code: 'processing_error', message: 'We could not process your card. Try again.' },
};

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    const number = normalizeCardNumber(input.card.number);
    const invalid = (message: string): AuthorizeResult => ({ ok: false, code: 'invalid_card', message });

    if (!luhnCheck(number)) return invalid('That card number does not look right.');
    if (!/^\d{3,4}$/.test(input.card.cvc)) return invalid('Enter the 3 or 4 digit security code.');
    if (!Number.isInteger(input.card.expMonth) || input.card.expMonth < 1 || input.card.expMonth > 12) {
      return invalid('Enter a valid expiry month.');
    }
    const now = this.now();
    const expiresEnd = new Date(Date.UTC(input.card.expYear, input.card.expMonth, 1));
    if (expiresEnd <= now) return invalid('That card has expired.');
    if (input.card.name.trim().length < 2) return invalid('Enter the name on the card.');
    if (input.amountCents <= 0) return { ok: false, code: 'processing_error', message: 'Nothing to charge.' };

    const forced = outcomes[number];
    if (forced) return { ok: false, ...forced };

    return { ok: true, reference: `sim_${randomUUID().replace(/-/g, '').slice(0, 20)}`, last4: number.slice(-4) };
  }
}
```

`src/lib/payments/index.ts`:
```ts
import { SimulatedPaymentProvider } from './simulated';
import type { PaymentProvider } from './types';

export * from './types';
export * from './luhn';
export { SimulatedPaymentProvider, TEST_CARDS } from './simulated';

let provider: PaymentProvider | undefined;

/** The only provider today is simulated. Swap here when a real gateway lands. */
export function getPaymentProvider(): PaymentProvider {
  provider ??= new SimulatedPaymentProvider();
  return provider;
}
```

Run: `pnpm test:unit src/lib/payments`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add PaymentProvider interface with simulated provider and test cards"
```

---

### Task 6: Cart domain: cookie, queries, mutations, server actions

**Files:**
- Create: `src/lib/cart/cookie.ts`, `src/lib/cart/types.ts`, `src/lib/cart/schemas.ts`, `src/lib/cart/queries.ts`, `src/lib/cart/mutations.ts`, `src/lib/cart/actions.ts`
- Test: `src/lib/cart/schemas.test.ts`, `tests/integration/cart.test.ts`

**Interfaces:**
- Consumes: `getDb`, schema tables (Task 2), pricing (Task 4), `ActionResult` helpers (Task 2).
- Produces:
  - `CART_COOKIE_NAME = 'cofresso_cart'`; `readCartId(): Promise<string | null>`; `writeCartId(id): Promise<void>`; `clearCartCookie(): Promise<void>`
  - `type CartLine = { id; quantity; grind: Grind | null; purchaseType; subscriptionIntervalWeeks: number | null; unitPriceCents; effectiveUnitPriceCents; lineTotalCents; variant: { id; name; sku; stockQuantity }; product: { id; slug; name; imagePath; category } }`
  - `type CartView = { id; discountCode: string | null; discount: DiscountRule | null; discountMessage: string | null; lines: CartLine[]; totals: Totals }`
  - `getCartView(cartId, db?): Promise<CartView | null>`; `getCartItemCount(cartId, db?): Promise<number>`
  - `ensureCart(db)`, `addLine(db, cartId, input: AddLineInput)`, `setLineQuantity(db, cartId, lineId, qty)`, `removeLine(db, cartId, lineId)`, `applyDiscountCode(db, cartId, code)`, `clearDiscountCode(db, cartId)`
  - `CartMutationError` with `code: 'variant_not_found' | 'out_of_stock' | 'line_not_found' | 'invalid_code'`
  - Server actions: `addToCartAction(prev, formData)`, `updateCartLineAction(lineId, quantity)`, `removeCartLineAction(lineId)`, `applyPromoAction(prev, formData)`, `removePromoAction()`
  - `addToCartSchema` (Zod) and `type AddLineInput`

- [ ] **Step 1: Cookie helpers**

`src/lib/cart/cookie.ts`:
```ts
import { cookies } from 'next/headers';

export const CART_COOKIE_NAME = 'cofresso_cart';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readCartId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE_NAME)?.value;
  return value && /^[0-9a-f-]{36}$/.test(value) ? value : null;
}

export async function writeCartId(id: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
}

export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}
```

- [ ] **Step 2: Types and Zod schema (with test)**

`src/lib/cart/types.ts`:
```ts
import type { Grind, ProductCategory, PurchaseType } from '@/lib/db/schema';
import type { DiscountRule, Totals } from '@/lib/pricing';

export interface CartLine {
  id: string;
  quantity: number;
  grind: Grind | null;
  purchaseType: PurchaseType;
  subscriptionIntervalWeeks: number | null;
  unitPriceCents: number;
  effectiveUnitPriceCents: number;
  lineTotalCents: number;
  variant: { id: string; name: string; sku: string; stockQuantity: number };
  product: { id: string; slug: string; name: string; imagePath: string; category: ProductCategory };
}

export interface CartView {
  id: string;
  discountCode: string | null;
  discount: DiscountRule | null;
  /** Set when a stored code no longer applies (for example the subtotal dropped below its minimum). */
  discountMessage: string | null;
  lines: CartLine[];
  totals: Totals;
}
```

`src/lib/cart/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addToCartSchema } from './schemas';

describe('addToCartSchema', () => {
  const variantId = '3f2d0d3e-2f4a-4a7e-9d5b-4c6c1d2f3a4b';
  it('accepts a one-time whole-bean line', () => {
    const r = addToCartSchema.safeParse({ variantId, quantity: '2', grind: 'whole_bean', purchaseType: 'one_time' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ variantId, quantity: 2, grind: 'whole_bean', purchaseType: 'one_time', subscriptionIntervalWeeks: null });
  });
  it('requires an interval for subscriptions', () => {
    expect(addToCartSchema.safeParse({ variantId, quantity: 1, purchaseType: 'subscription' }).success).toBe(false);
    const ok = addToCartSchema.safeParse({ variantId, quantity: 1, purchaseType: 'subscription', subscriptionIntervalWeeks: '4' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.subscriptionIntervalWeeks).toBe(4);
  });
  it('caps quantity and rejects bad ids', () => {
    expect(addToCartSchema.safeParse({ variantId, quantity: 11, purchaseType: 'one_time' }).success).toBe(false);
    expect(addToCartSchema.safeParse({ variantId: 'nope', quantity: 1, purchaseType: 'one_time' }).success).toBe(false);
  });
});
```

`src/lib/cart/schemas.ts`:
```ts
import { z } from 'zod';
import { grindEnum, purchaseTypeEnum } from '@/lib/db/schema';

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const addToCartSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(10).default(1),
    grind: z.preprocess(emptyToNull, z.enum(grindEnum.enumValues).nullable().default(null)),
    purchaseType: z.enum(purchaseTypeEnum.enumValues).default('one_time'),
    subscriptionIntervalWeeks: z.preprocess(
      emptyToNull,
      z.coerce.number().int().refine((n) => [2, 4, 6].includes(n), 'Choose 2, 4 or 6 weeks').nullable().default(null),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.purchaseType === 'subscription' && v.subscriptionIntervalWeeks === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subscriptionIntervalWeeks'], message: 'Choose a delivery interval.' });
    }
  })
  .transform((v) => ({ ...v, subscriptionIntervalWeeks: v.purchaseType === 'subscription' ? v.subscriptionIntervalWeeks : null }));

export type AddLineInput = z.infer<typeof addToCartSchema>;

export const updateQuantitySchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(10),
});

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter a code.')
    .max(32)
    .transform((s) => s.toUpperCase()),
});
```

Run: `pnpm test:unit src/lib/cart` → PASS.

- [ ] **Step 3: Queries**

`src/lib/cart/queries.ts`:
```ts
import { eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db/client';
import { cartItems, carts, discountCodes } from '@/lib/db/schema';
import { computeTotals, effectiveUnitPriceCents, evaluateDiscountCode, lineTotalCents, type DiscountRule } from '@/lib/pricing';
import type { CartLine, CartView } from './types';

export async function getCartView(cartId: string, db: Db = getDb()): Promise<CartView | null> {
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.createdAt)],
        with: { variant: { with: { product: true } } },
      },
    },
  });
  if (!cart) return null;

  const lines: CartLine[] = cart.items.map((item) => {
    const pricingLine = { unitPriceCents: item.variant.priceCents, quantity: item.quantity, purchaseType: item.purchaseType };
    return {
      id: item.id,
      quantity: item.quantity,
      grind: item.grind,
      purchaseType: item.purchaseType,
      subscriptionIntervalWeeks: item.subscriptionIntervalWeeks,
      unitPriceCents: item.variant.priceCents,
      effectiveUnitPriceCents: effectiveUnitPriceCents(pricingLine),
      lineTotalCents: lineTotalCents(pricingLine),
      variant: {
        id: item.variant.id,
        name: item.variant.name,
        sku: item.variant.sku,
        stockQuantity: item.variant.stockQuantity,
      },
      product: {
        id: item.variant.product.id,
        slug: item.variant.product.slug,
        name: item.variant.product.name,
        imagePath: item.variant.product.imagePath,
        category: item.variant.product.category,
      },
    };
  });

  const pricingLines = lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity, purchaseType: l.purchaseType }));
  const preDiscount = computeTotals(pricingLines, null);

  let discount: DiscountRule | null = null;
  let discountMessage: string | null = null;
  if (cart.discountCode) {
    const row = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, cart.discountCode) });
    if (!row) {
      discountMessage = 'That code is no longer available.';
    } else {
      const evaluation = evaluateDiscountCode(row, preDiscount.subtotalCents);
      if (evaluation.ok) discount = evaluation.rule;
      else discountMessage = evaluation.message;
    }
  }

  return {
    id: cart.id,
    discountCode: cart.discountCode,
    discount,
    discountMessage,
    lines,
    totals: computeTotals(pricingLines, discount),
  };
}

export async function getCartItemCount(cartId: string, db: Db = getDb()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row?.n ?? 0;
}
```

- [ ] **Step 4: Mutations**

`src/lib/cart/mutations.ts`:
```ts
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { cartItems, carts, discountCodes, productVariants } from '@/lib/db/schema';
import { computeTotals, evaluateDiscountCode } from '@/lib/pricing';
import type { AddLineInput } from './schemas';

export type CartMutationCode = 'variant_not_found' | 'out_of_stock' | 'line_not_found' | 'invalid_code';

export class CartMutationError extends Error {
  constructor(
    public readonly code: CartMutationCode,
    message: string,
  ) {
    super(message);
    this.name = 'CartMutationError';
  }
}

export async function ensureCart(db: Db, cartId: string | null): Promise<string> {
  if (cartId) {
    const existing = await db.query.carts.findFirst({ where: eq(carts.id, cartId), columns: { id: true } });
    if (existing) return existing.id;
  }
  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  return created.id;
}

async function touch(db: Db, cartId: string) {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function addLine(db: Db, cartId: string, input: AddLineInput) {
  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, input.variantId),
    with: { product: { columns: { active: true, category: true } } },
  });
  if (!variant || !variant.product.active) throw new CartMutationError('variant_not_found', 'That product is not available.');

  const grind = variant.product.category === 'coffee' ? (input.grind ?? 'whole_bean') : null;

  const [existing] = await db
    .select({ id: cartItems.id, quantity: cartItems.quantity })
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.variantId, input.variantId),
        grind ? eq(cartItems.grind, grind) : sql`${cartItems.grind} is null`,
        eq(cartItems.purchaseType, input.purchaseType),
        input.subscriptionIntervalWeeks
          ? eq(cartItems.subscriptionIntervalWeeks, input.subscriptionIntervalWeeks)
          : sql`${cartItems.subscriptionIntervalWeeks} is null`,
      ),
    );

  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
  if (nextQuantity > variant.stockQuantity) {
    throw new CartMutationError(
      'out_of_stock',
      variant.stockQuantity === 0 ? 'That item is sold out.' : `Only ${variant.stockQuantity} left in stock.`,
    );
  }

  if (existing) {
    await db.update(cartItems).set({ quantity: nextQuantity }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      variantId: input.variantId,
      quantity: input.quantity,
      grind,
      purchaseType: input.purchaseType,
      subscriptionIntervalWeeks: input.subscriptionIntervalWeeks,
    });
  }
  await touch(db, cartId);
}

export async function setLineQuantity(db: Db, cartId: string, lineId: string, quantity: number) {
  if (quantity <= 0) return removeLine(db, cartId, lineId);
  const line = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.id, lineId), eq(cartItems.cartId, cartId)),
    with: { variant: { columns: { stockQuantity: true } } },
  });
  if (!line) throw new CartMutationError('line_not_found', 'That item is no longer in your cart.');
  if (quantity > line.variant.stockQuantity) {
    throw new CartMutationError('out_of_stock', `Only ${line.variant.stockQuantity} left in stock.`);
  }
  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, lineId));
  await touch(db, cartId);
}

export async function removeLine(db: Db, cartId: string, lineId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.id, lineId), eq(cartItems.cartId, cartId)));
  await touch(db, cartId);
}

export async function applyDiscountCode(db: Db, cartId: string, code: string) {
  const row = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code.toUpperCase()) });
  if (!row) throw new CartMutationError('invalid_code', 'We do not recognize that code.');

  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, cartId),
    with: { variant: { columns: { priceCents: true } } },
  });
  const subtotal = computeTotals(
    items.map((i) => ({ unitPriceCents: i.variant.priceCents, quantity: i.quantity, purchaseType: i.purchaseType })),
    null,
  ).subtotalCents;

  const evaluation = evaluateDiscountCode(row, subtotal);
  if (!evaluation.ok) throw new CartMutationError('invalid_code', evaluation.message);

  await db.update(carts).set({ discountCode: row.code, updatedAt: new Date() }).where(eq(carts.id, cartId));
  return row.code;
}

export async function clearDiscountCode(db: Db, cartId: string) {
  await db.update(carts).set({ discountCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function clearCart(db: Db, cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await db.update(carts).set({ discountCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
}
```

- [ ] **Step 5: Integration tests**

`tests/integration/cart.test.ts`:
```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addLine, applyDiscountCode, CartMutationError, clearCart, ensureCart, removeLine, setLineQuantity } from '../../src/lib/cart/mutations';
import { getCartItemCount, getCartView } from '../../src/lib/cart/queries';
import { productVariants } from '../../src/lib/db/schema';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

async function variantBySku(sku: string) {
  const [v] = await db.select().from(productVariants).where(eq(productVariants.sku, sku));
  return v;
}

describe('cart', () => {
  let cartId: string;
  beforeEach(async () => {
    cartId = await ensureCart(db, null);
  });

  it('adds, merges and prices lines', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: 'whole_bean', purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    await addLine(db, cartId, { variantId: v.id, quantity: 2, grind: 'whole_bean', purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: 'drip', purchaseType: 'one_time', subscriptionIntervalWeeks: null });

    const view = await getCartView(cartId, db);
    expect(view?.lines).toHaveLength(2);
    const whole = view!.lines.find((l) => l.grind === 'whole_bean')!;
    expect(whole.quantity).toBe(3);
    expect(whole.lineTotalCents).toBe(3 * v.priceCents);
    expect(view!.totals.itemCount).toBe(4);
    expect(await getCartItemCount(cartId, db)).toBe(4);
  });

  it('applies subscription pricing per line', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: 'whole_bean', purchaseType: 'subscription', subscriptionIntervalWeeks: 4 });
    const view = await getCartView(cartId, db);
    expect(view!.lines[0].effectiveUnitPriceCents).toBe(Math.round(v.priceCents * 0.85));
    expect(view!.totals.subscriptionSavingsCents).toBe(v.priceCents - Math.round(v.priceCents * 0.85));
  });

  it('enforces stock', async () => {
    const v = await variantBySku('KETTLE-2');
    await expect(
      addLine(db, cartId, { variantId: v.id, quantity: 10, grind: null, purchaseType: 'one_time', subscriptionIntervalWeeks: null }),
    ).resolves.toBeUndefined();
    await expect(
      addLine(db, cartId, { variantId: v.id, quantity: 10, grind: null, purchaseType: 'one_time', subscriptionIntervalWeeks: null }),
    ).rejects.toMatchObject({ code: 'out_of_stock' });
  });

  it('updates and removes lines', async () => {
    const v = await variantBySku('MUG-1');
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: null, purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    let view = await getCartView(cartId, db);
    await setLineQuantity(db, cartId, view!.lines[0].id, 3);
    view = await getCartView(cartId, db);
    expect(view!.lines[0].quantity).toBe(3);
    await setLineQuantity(db, cartId, view!.lines[0].id, 0);
    view = await getCartView(cartId, db);
    expect(view!.lines).toHaveLength(0);
    await expect(setLineQuantity(db, cartId, view!.id, 1)).rejects.toBeInstanceOf(CartMutationError);
    await removeLine(db, cartId, '00000000-0000-0000-0000-000000000000');
  });

  it('applies and validates discount codes', async () => {
    const v = await variantBySku('MORNINGFRAME-1');
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: 'whole_bean', purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    await expect(applyDiscountCode(db, cartId, 'NOPE')).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(applyDiscountCode(db, cartId, 'coframe15')).rejects.toMatchObject({ code: 'invalid_code' }); // min $30
    await applyDiscountCode(db, cartId, 'welcome10');
    const view = await getCartView(cartId, db);
    expect(view!.discountCode).toBe('WELCOME10');
    expect(view!.totals.discountCents).toBe(Math.round(v.priceCents * 0.1));
  });

  it('reports a stored code that no longer applies', async () => {
    const v = await variantBySku('MORNINGFRAME-2'); // 2 lb, above $30
    await addLine(db, cartId, { variantId: v.id, quantity: 1, grind: 'whole_bean', purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    await applyDiscountCode(db, cartId, 'COFRAME15');
    const view = await getCartView(cartId, db);
    await removeLine(db, cartId, view!.lines[0].id);
    const mug = await variantBySku('MUG-1');
    await addLine(db, cartId, { variantId: mug.id, quantity: 1, grind: null, purchaseType: 'one_time', subscriptionIntervalWeeks: null });
    const after = await getCartView(cartId, db);
    expect(after!.discount).toBeNull();
    expect(after!.discountMessage).toContain('$30.00');
    await clearCart(db, cartId);
    expect((await getCartView(cartId, db))!.lines).toHaveLength(0);
  });
});
```

Run: `pnpm test:integration`
Expected: PASS.

- [ ] **Step 6: Server actions**

`src/lib/cart/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getDb } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { readCartId, writeCartId } from './cookie';
import {
  addLine,
  applyDiscountCode,
  CartMutationError,
  clearDiscountCode,
  ensureCart,
  removeLine,
  setLineQuantity,
} from './mutations';
import { getCartItemCount } from './queries';
import { addToCartSchema, promoCodeSchema, updateQuantitySchema } from './schemas';

function revalidateCart() {
  revalidatePath('/', 'layout');
}

function handleError<T>(err: unknown, fallback: string): ActionResult<T> {
  if (err instanceof CartMutationError) return fail(err.message);
  logger.error('cart action failed', { err });
  return fail(fallback);
}

export async function addToCartAction(
  _prev: ActionResult<{ itemCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = addToCartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail('Check your selection.', parsed.error.flatten().fieldErrors);
  }
  try {
    const db = getDb();
    const cartId = await ensureCart(db, await readCartId());
    await writeCartId(cartId);
    await addLine(db, cartId, parsed.data);
    revalidateCart();
    return ok({ itemCount: await getCartItemCount(cartId, db) });
  } catch (err) {
    return handleError(err, 'Could not add that to your cart.');
  }
}

export async function updateCartLineAction(lineId: string, quantity: number): Promise<ActionResult> {
  const parsed = updateQuantitySchema.safeParse({ lineId, quantity });
  if (!parsed.success) return fail('Invalid quantity.');
  const cartId = await readCartId();
  if (!cartId) return fail('Your cart has expired.');
  try {
    await setLineQuantity(getDb(), cartId, parsed.data.lineId, parsed.data.quantity);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not update your cart.');
  }
}

export async function removeCartLineAction(lineId: string): Promise<ActionResult> {
  const cartId = await readCartId();
  if (!cartId) return fail('Your cart has expired.');
  try {
    await removeLine(getDb(), cartId, lineId);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not update your cart.');
  }
}

export async function applyPromoAction(_prev: ActionResult<{ code: string }> | null, formData: FormData): Promise<ActionResult<{ code: string }>> {
  const parsed = promoCodeSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Enter a code.');
  const cartId = await readCartId();
  if (!cartId) return fail('Add something to your cart first.');
  try {
    const code = await applyDiscountCode(getDb(), cartId, parsed.data.code);
    revalidateCart();
    return ok({ code });
  } catch (err) {
    return handleError(err, 'Could not apply that code.');
  }
}

export async function removePromoAction(): Promise<ActionResult> {
  const cartId = await readCartId();
  if (!cartId) return ok(undefined);
  try {
    await clearDiscountCode(getDb(), cartId);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not remove that code.');
  }
}
```

- [ ] **Step 7: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add cart cookie, queries, mutations and server actions"
```

---

### Task 7: Checkout: schemas, order placement transaction, order queries

**Files:**
- Create: `src/lib/checkout/schemas.ts`, `src/lib/checkout/order-number.ts`, `src/lib/checkout/place-order.ts`, `src/lib/checkout/queries.ts`
- Test: `src/lib/checkout/schemas.test.ts`, `src/lib/checkout/order-number.test.ts`, `tests/integration/place-order.test.ts`

**Interfaces:**
- Consumes: cart queries/mutations (Task 6), pricing (Task 4), payments (Task 5), schema (Task 2).
- Produces:
  - `checkoutSchema` (Zod) and `type CheckoutInput = { email; shippingName; address1; address2?; city; state; postalCode; country; cardNumber; cardName; expMonth; expYear; cvc; idempotencyKey }`, plus step schemas `contactSchema`, `shippingSchema`, `paymentSchema`
  - `formatOrderNumber(n: number): string` (`CF-10001`), `isOrderNumber(s): boolean`
  - `placeOrder(params: { cartId: string; input: CheckoutInput; db?: Db; provider?: PaymentProvider; now?: Date }): Promise<PlaceOrderResult>`
  - `type PlaceOrderResult = { ok: true; orderId; orderNumber; lookupToken } | { ok: false; code: PlaceOrderFailure; message: string; lineId?: string }`
  - `type PlaceOrderFailure = 'empty_cart' | 'out_of_stock' | 'payment_declined' | 'invalid_discount' | 'unknown'`
  - `getOrderForConfirmation(orderNumber, token, db?)`, `getOrderForLookup(orderNumber, email, db?)` returning `OrderView | null`
  - `type OrderView = { id; orderNumber; email; status; createdAt; shipping: {...}; totals: { subtotalCents; discountCents; shippingCents; taxCents; totalCents }; discountCode; cardLast4; items: OrderItemView[] }`

- [ ] **Step 1: Schemas + tests**

`src/lib/checkout/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { checkoutSchema, shippingSchema } from './schemas';

const valid = {
  email: 'ada@example.com',
  shippingName: 'Ada Lovelace',
  address1: '1 Analytical Way',
  address2: '',
  city: 'London',
  state: 'CA',
  postalCode: '94110',
  country: 'US',
  cardNumber: '4242 4242 4242 4242',
  cardName: 'Ada Lovelace',
  expMonth: '12',
  expYear: '2030',
  cvc: '123',
  idempotencyKey: '3f2d0d3e-2f4a-4a7e-9d5b-4c6c1d2f3a4b',
};

describe('checkoutSchema', () => {
  it('coerces and normalises a valid payload', () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expMonth).toBe(12);
      expect(r.data.expYear).toBe(2030);
      expect(r.data.address2).toBeUndefined();
      expect(r.data.email).toBe('ada@example.com');
    }
  });
  it('rejects a bad email and a short postal code', () => {
    expect(checkoutSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(shippingSchema.safeParse({ ...valid, postalCode: '12' }).success).toBe(false);
  });
  it('rejects a Luhn-invalid card at the schema level', () => {
    expect(checkoutSchema.safeParse({ ...valid, cardNumber: '4242 4242 4242 4241' }).success).toBe(false);
  });
});
```

`src/lib/checkout/schemas.ts`:
```ts
import { z } from 'zod';
import { luhnCheck } from '@/lib/payments/luhn';

const optionalText = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(120).optional());

export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

export const shippingSchema = z.object({
  shippingName: z.string().trim().min(2, 'Enter the recipient name.').max(120),
  address1: z.string().trim().min(3, 'Enter a street address.').max(120),
  address2: optionalText,
  city: z.string().trim().min(2, 'Enter a city.').max(80),
  state: z.string().trim().min(2, 'Enter a state or region.').max(40),
  postalCode: z.string().trim().min(3, 'Enter a postal code.').max(12),
  country: z.string().trim().length(2, 'Use a two-letter country code.').toUpperCase().default('US'),
});

export const paymentSchema = z.object({
  cardNumber: z.string().refine((s) => luhnCheck(s), 'Enter a valid card number.'),
  cardName: z.string().trim().min(2, 'Enter the name on the card.').max(120),
  expMonth: z.coerce.number().int().min(1, 'Enter a valid month.').max(12, 'Enter a valid month.'),
  expYear: z.coerce.number().int().min(2024).max(2100),
  cvc: z.string().trim().regex(/^\d{3,4}$/, 'Enter the 3 or 4 digit code.'),
});

export const checkoutSchema = contactSchema.merge(shippingSchema).merge(paymentSchema).extend({
  idempotencyKey: z.string().uuid(),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ShippingInput = z.infer<typeof shippingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 2: Order number helpers + test**

`src/lib/checkout/order-number.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatOrderNumber, isOrderNumber, normalizeOrderNumber } from './order-number';

describe('order numbers', () => {
  it('formats with the CF prefix and 5+ digits', () => {
    expect(formatOrderNumber(10001)).toBe('CF-10001');
    expect(formatOrderNumber(123456)).toBe('CF-123456');
  });
  it('validates and normalises user input', () => {
    expect(isOrderNumber('CF-10001')).toBe(true);
    expect(isOrderNumber('cf-10001')).toBe(true);
    expect(isOrderNumber('10001')).toBe(false);
    expect(normalizeOrderNumber(' cf-10001 ')).toBe('CF-10001');
  });
});
```

`src/lib/checkout/order-number.ts`:
```ts
export function formatOrderNumber(sequence: number): string {
  return `CF-${String(sequence).padStart(5, '0')}`;
}

export function normalizeOrderNumber(input: string): string {
  return input.trim().toUpperCase();
}

export function isOrderNumber(input: string): boolean {
  return /^CF-\d{5,}$/.test(normalizeOrderNumber(input));
}
```

- [ ] **Step 3: Failing integration tests for placeOrder**

`tests/integration/place-order.test.ts`:
```ts
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { addLine, applyDiscountCode, ensureCart } from '../../src/lib/cart/mutations';
import { getCartView } from '../../src/lib/cart/queries';
import { placeOrder } from '../../src/lib/checkout/place-order';
import { getOrderForConfirmation, getOrderForLookup } from '../../src/lib/checkout/queries';
import type { CheckoutInput } from '../../src/lib/checkout/schemas';
import { productVariants } from '../../src/lib/db/schema';
import { TEST_CARDS } from '../../src/lib/payments';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  email: 'ada@example.com',
  shippingName: 'Ada Lovelace',
  address1: '1 Analytical Way',
  address2: undefined,
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94110',
  country: 'US',
  cardNumber: TEST_CARDS.approved,
  cardName: 'Ada Lovelace',
  expMonth: 12,
  expYear: 2030,
  cvc: '123',
  idempotencyKey: randomUUID(),
  ...overrides,
});

async function variantBySku(sku: string) {
  const [v] = await db.select().from(productVariants).where(eq(productVariants.sku, sku));
  return v;
}

async function cartWith(sku: string, quantity = 1) {
  const cartId = await ensureCart(db, null);
  const v = await variantBySku(sku);
  await addLine(db, cartId, { variantId: v.id, quantity, grind: null, purchaseType: 'one_time', subscriptionIntervalWeeks: null });
  return { cartId, variant: v };
}

describe('placeOrder', () => {
  it('creates an order, decrements stock, clears the cart', async () => {
    const { cartId, variant } = await cartWith('SCALE-1', 2);
    await applyDiscountCode(db, cartId, 'WELCOME10');
    const before = (await variantBySku('SCALE-1')).stockQuantity;

    const result = await placeOrder({ cartId, input: input(), db });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^CF-\d{5,}$/);

    const after = (await variantBySku('SCALE-1')).stockQuantity;
    expect(after).toBe(before - 2);

    const cart = await getCartView(cartId, db);
    expect(cart!.lines).toHaveLength(0);
    expect(cart!.discountCode).toBeNull();

    const order = await getOrderForConfirmation(result.orderNumber, result.lookupToken, db);
    expect(order).not.toBeNull();
    expect(order!.items[0]).toMatchObject({ variantId: variant.id, quantity: 2, unitPriceCents: variant.priceCents });
    expect(order!.totals.discountCents).toBe(Math.round(variant.priceCents * 2 * 0.1));
    expect(order!.discountCode).toBe('WELCOME10');
    expect(order!.cardLast4).toBe('4242');

    expect(await getOrderForConfirmation(result.orderNumber, 'wrong-token', db)).toBeNull();
    expect(await getOrderForLookup(result.orderNumber, 'ADA@example.com', db)).not.toBeNull();
    expect(await getOrderForLookup(result.orderNumber, 'someone@else.com', db)).toBeNull();
  });

  it('returns the same order when the idempotency key is replayed', async () => {
    const { cartId } = await cartWith('MUG-1');
    const key = randomUUID();
    const first = await placeOrder({ cartId, input: input({ idempotencyKey: key }), db });
    const second = await placeOrder({ cartId, input: input({ idempotencyKey: key }), db });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.orderNumber).toBe(first.orderNumber);
  });

  it('rejects an empty cart', async () => {
    const cartId = await ensureCart(db, null);
    await expect(placeOrder({ cartId, input: input(), db })).resolves.toMatchObject({ ok: false, code: 'empty_cart' });
  });

  it('fails on decline and leaves stock and cart untouched', async () => {
    const { cartId } = await cartWith('FILTERS-1', 3);
    const before = (await variantBySku('FILTERS-1')).stockQuantity;
    const result = await placeOrder({ cartId, input: input({ cardNumber: TEST_CARDS.declined }), db });
    expect(result).toMatchObject({ ok: false, code: 'payment_declined' });
    expect((await variantBySku('FILTERS-1')).stockQuantity).toBe(before);
    expect((await getCartView(cartId, db))!.lines).toHaveLength(1);
  });

  it('fails when stock ran out after the item was added', async () => {
    const { cartId, variant } = await cartWith('GRINDER-1', 2);
    await db.update(productVariants).set({ stockQuantity: 1 }).where(eq(productVariants.id, variant.id));
    const result = await placeOrder({ cartId, input: input(), db });
    expect(result).toMatchObject({ ok: false, code: 'out_of_stock' });
    await db.update(productVariants).set({ stockQuantity: variant.stockQuantity }).where(eq(productVariants.id, variant.id));
  });
});
```

Run: `pnpm test:integration tests/integration/place-order.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement placeOrder**

`src/lib/checkout/place-order.ts`:
```ts
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { clearCart } from '@/lib/cart/mutations';
import { getDb, type Db } from '@/lib/db/client';
import { cartItems, carts, discountCodes, orderItems, orders, productVariants } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getPaymentProvider, type PaymentProvider } from '@/lib/payments';
import { computeTotals, effectiveUnitPriceCents, evaluateDiscountCode, type DiscountRule } from '@/lib/pricing';
import { formatOrderNumber } from './order-number';
import type { CheckoutInput } from './schemas';

export type PlaceOrderFailure = 'empty_cart' | 'out_of_stock' | 'payment_declined' | 'invalid_discount' | 'unknown';

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; lookupToken: string }
  | { ok: false; code: PlaceOrderFailure; message: string; lineId?: string };

class PlaceOrderError extends Error {
  constructor(
    public readonly code: PlaceOrderFailure,
    message: string,
    public readonly lineId?: string,
  ) {
    super(message);
  }
}

export async function placeOrder(params: {
  cartId: string;
  input: CheckoutInput;
  db?: Db;
  provider?: PaymentProvider;
  now?: Date;
}): Promise<PlaceOrderResult> {
  const db = params.db ?? getDb();
  const provider = params.provider ?? getPaymentProvider();
  const now = params.now ?? new Date();
  const { cartId, input } = params;

  const existing = await db.query.orders.findFirst({
    where: eq(orders.idempotencyKey, input.idempotencyKey),
    columns: { id: true, orderNumber: true, lookupToken: true },
  });
  if (existing) return { ok: true, orderId: existing.id, orderNumber: existing.orderNumber, lookupToken: existing.lookupToken };

  try {
    return await db.transaction(async (tx) => {
      const cart = await tx.query.carts.findFirst({ where: eq(carts.id, cartId), columns: { id: true, discountCode: true } });
      const items = cart
        ? await tx.query.cartItems.findMany({ where: eq(cartItems.cartId, cartId), orderBy: (t, { asc }) => [asc(t.createdAt)] })
        : [];
      if (!cart || items.length === 0) throw new PlaceOrderError('empty_cart', 'Your cart is empty.');

      const variantIds = items.map((i) => i.variantId);
      const lockedVariants = await tx
        .select()
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
        .for('update');
      const variantById = new Map(lockedVariants.map((v) => [v.id, v]));
      const products = await tx.query.products.findMany({
        where: (p, { inArray: inArr }) => inArr(p.id, [...new Set(lockedVariants.map((v) => v.productId))]),
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      for (const item of items) {
        const variant = variantById.get(item.variantId);
        if (!variant) throw new PlaceOrderError('out_of_stock', 'An item in your cart is no longer available.', item.id);
        if (variant.stockQuantity < item.quantity) {
          const product = productById.get(variant.productId);
          throw new PlaceOrderError(
            'out_of_stock',
            `Only ${variant.stockQuantity} of ${product?.name ?? 'that item'} (${variant.name}) left. Please adjust your cart.`,
            item.id,
          );
        }
      }

      const pricingLines = items.map((item) => ({
        unitPriceCents: variantById.get(item.variantId)!.priceCents,
        quantity: item.quantity,
        purchaseType: item.purchaseType,
      }));

      let discount: DiscountRule | null = null;
      let discountRow: typeof discountCodes.$inferSelect | undefined;
      if (cart.discountCode) {
        discountRow = await tx.query.discountCodes.findFirst({ where: eq(discountCodes.code, cart.discountCode) });
        const subtotal = computeTotals(pricingLines, null).subtotalCents;
        const evaluation = discountRow ? evaluateDiscountCode(discountRow, subtotal, now) : null;
        if (!evaluation || !evaluation.ok) {
          throw new PlaceOrderError('invalid_discount', evaluation?.message ?? 'Your promo code is no longer valid. Remove it to continue.');
        }
        discount = evaluation.rule;
      }

      const totals = computeTotals(pricingLines, discount);

      const authorization = await provider.authorize({
        amountCents: totals.totalCents,
        currency: 'USD',
        idempotencyKey: input.idempotencyKey,
        card: { number: input.cardNumber, expMonth: input.expMonth, expYear: input.expYear, cvc: input.cvc, name: input.cardName },
      });
      if (!authorization.ok) throw new PlaceOrderError('payment_declined', authorization.message);

      const [{ nextval }] = await tx.execute<{ nextval: string }>(sql`select nextval('order_number_seq') as nextval`);
      const orderNumber = formatOrderNumber(Number(nextval));
      const lookupToken = randomBytes(16).toString('hex');

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          email: input.email,
          status: 'paid',
          shippingName: input.shippingName,
          shippingAddress1: input.address1,
          shippingAddress2: input.address2 ?? null,
          shippingCity: input.city,
          shippingState: input.state,
          shippingPostalCode: input.postalCode,
          shippingCountry: input.country,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          shippingCents: totals.shippingCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          discountCode: discount ? cart.discountCode : null,
          paymentProvider: provider.name,
          paymentReference: authorization.reference,
          cardLast4: authorization.last4,
          lookupToken,
          idempotencyKey: input.idempotencyKey,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        items.map((item) => {
          const variant = variantById.get(item.variantId)!;
          const product = productById.get(variant.productId)!;
          return {
            orderId: order.id,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            productSlug: product.slug,
            variantName: variant.name,
            imagePath: product.imagePath,
            grind: item.grind,
            purchaseType: item.purchaseType,
            subscriptionIntervalWeeks: item.subscriptionIntervalWeeks,
            unitPriceCents: effectiveUnitPriceCents({ unitPriceCents: variant.priceCents, quantity: item.quantity, purchaseType: item.purchaseType }),
            quantity: item.quantity,
          };
        }),
      );

      for (const item of items) {
        await tx
          .update(productVariants)
          .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}` })
          .where(and(eq(productVariants.id, item.variantId)));
      }

      if (discountRow) {
        await tx.update(discountCodes).set({ usageCount: sql`${discountCodes.usageCount} + 1` }).where(eq(discountCodes.id, discountRow.id));
      }

      await clearCart(tx as unknown as Db, cartId);

      logger.info('order placed', { orderNumber, totalCents: totals.totalCents, items: items.length });
      return { ok: true, orderId: order.id, orderNumber, lookupToken } satisfies PlaceOrderResult;
    });
  } catch (err) {
    if (err instanceof PlaceOrderError) {
      return { ok: false, code: err.code, message: err.message, lineId: err.lineId };
    }
    logger.error('placeOrder failed', { err, cartId });
    return { ok: false, code: 'unknown', message: 'Something went wrong placing your order. You have not been charged.' };
  }
}
```

Note on `clearCart(tx as unknown as Db, cartId)`: Drizzle's transaction type is structurally compatible for the query builders `clearCart` uses. If TypeScript still complains, change `clearCart`'s parameter type in `src/lib/cart/mutations.ts` to `Pick<Db, 'delete' | 'update'>`.

- [ ] **Step 5: Order queries**

`src/lib/checkout/queries.ts`:
```ts
import { eq } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db/client';
import { orders, type Order, type OrderItem } from '@/lib/db/schema';
import { normalizeOrderNumber } from './order-number';

export interface OrderItemView {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productSlug: string;
  variantName: string;
  imagePath: string;
  grind: OrderItem['grind'];
  purchaseType: OrderItem['purchaseType'];
  subscriptionIntervalWeeks: number | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  email: string;
  status: Order['status'];
  createdAt: Date;
  shipping: { name: string; address1: string; address2: string | null; city: string; state: string; postalCode: string; country: string };
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number };
  discountCode: string | null;
  cardLast4: string | null;
  items: OrderItemView[];
}

function toView(order: Order & { items: OrderItem[] }): OrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    status: order.status,
    createdAt: order.createdAt,
    shipping: {
      name: order.shippingName,
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    totals: {
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
    },
    discountCode: order.discountCode,
    cardLast4: order.cardLast4,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      variantName: i.variantName,
      imagePath: i.imagePath,
      grind: i.grind,
      purchaseType: i.purchaseType,
      subscriptionIntervalWeeks: i.subscriptionIntervalWeeks,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.unitPriceCents * i.quantity,
    })),
  };
}

async function findOrder(orderNumber: string, db: Db) {
  return db.query.orders.findFirst({
    where: eq(orders.orderNumber, normalizeOrderNumber(orderNumber)),
    with: { items: true },
  });
}

export async function getOrderForConfirmation(orderNumber: string, token: string, db: Db = getDb()): Promise<OrderView | null> {
  const order = await findOrder(orderNumber, db);
  if (!order || !token || order.lookupToken !== token) return null;
  return toView(order);
}

export async function getOrderForLookup(orderNumber: string, email: string, db: Db = getDb()): Promise<OrderView | null> {
  const order = await findOrder(orderNumber, db);
  if (!order || order.email !== email.trim().toLowerCase()) return null;
  return toView(order);
}
```

Run: `pnpm test:integration`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add checkout schemas and transactional order placement with idempotency"
```

---

### Task 8: Analytics events, SDK slot, easter eggs, robots, sitemap

**Files:**
- Create: `src/lib/analytics/events.ts`, `src/lib/analytics/track.ts`, `src/lib/analytics/global.d.ts`
- Create: `src/components/analytics/analytics-provider.tsx`, `src/components/analytics/third-party-scripts.tsx`, `src/components/analytics/console-easter-egg.tsx`
- Create: `src/app/coffee/route.ts`, `public/humans.txt`, `src/app/robots.ts`, `src/app/sitemap.ts`
- Test: `src/lib/analytics/track.test.ts`

**Interfaces:**
- Produces: `type AnalyticsEvent` union (see below); `track(event: AnalyticsEvent): void`; `<AnalyticsProvider />`, `<ThirdPartyScripts />`, `<ConsoleEasterEgg />`; `window.cofresso.events`.
- Consumes: `siteConfig.easterEggUrl`, `getServerEnv()`, product/collection list queries from Task 12/13 for the sitemap (`listProductSlugs`, `listCollections` — define `listProductSlugs` in Task 13; until then the sitemap imports only what exists and Task 13 extends it).

- [ ] **Step 1: Event types**

`src/lib/analytics/events.ts`:
```ts
export interface AnalyticsItem {
  productId: string;
  slug: string;
  name: string;
  variantId?: string;
  variantName?: string;
  priceCents: number;
  quantity?: number;
  purchaseType?: 'one_time' | 'subscription';
}

export type AnalyticsEvent =
  | { name: 'page_view'; path: string; title?: string }
  | { name: 'view_item_list'; listId: string; items: AnalyticsItem[] }
  | { name: 'view_item'; item: AnalyticsItem }
  | { name: 'select_variant'; item: AnalyticsItem }
  | { name: 'add_to_cart'; item: AnalyticsItem; cartItemCount: number }
  | { name: 'remove_from_cart'; item: AnalyticsItem }
  | { name: 'view_cart'; valueCents: number; itemCount: number }
  | { name: 'begin_checkout'; valueCents: number; itemCount: number }
  | { name: 'add_shipping_info'; valueCents: number }
  | { name: 'add_payment_info'; valueCents: number }
  | { name: 'purchase'; orderNumber: string; valueCents: number; items: AnalyticsItem[]; discountCode?: string | null }
  | { name: 'apply_promo'; code: string; success: boolean }
  | { name: 'newsletter_signup'; source: string }
  | { name: 'search'; query: string; resultCount: number };

export type AnalyticsEventName = AnalyticsEvent['name'];

export interface TrackedEvent {
  event: AnalyticsEvent;
  timestamp: string;
}
```

`src/lib/analytics/global.d.ts`:
```ts
import type { TrackedEvent } from './events';

declare global {
  interface Window {
    cofresso?: { events: TrackedEvent[] };
  }
}

export {};
```

- [ ] **Step 2: Failing test for `track`**

`src/lib/analytics/track.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BUFFERED_EVENTS, track } from './track';

describe('track', () => {
  beforeEach(() => {
    delete window.cofresso;
  });

  it('buffers events on window and dispatches a DOM event', () => {
    const listener = vi.fn();
    window.addEventListener('cofresso:event', listener);
    track({ name: 'page_view', path: '/shop' });
    expect(window.cofresso?.events).toHaveLength(1);
    expect(window.cofresso?.events[0].event).toEqual({ name: 'page_view', path: '/shop' });
    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.event.name).toBe('page_view');
    window.removeEventListener('cofresso:event', listener);
  });

  it('caps the buffer', () => {
    for (let i = 0; i < MAX_BUFFERED_EVENTS + 5; i++) track({ name: 'search', query: String(i), resultCount: 0 });
    expect(window.cofresso?.events).toHaveLength(MAX_BUFFERED_EVENTS);
    expect((window.cofresso?.events[0].event as { query: string }).query).toBe('5');
  });
});
```

- [ ] **Step 3: Implement `track`**

`src/lib/analytics/track.ts`:
```ts
import type { AnalyticsEvent, TrackedEvent } from './events';

export const MAX_BUFFERED_EVENTS = 200;
export const EVENT_NAME = 'cofresso:event';

/**
 * Client-side event sink. Buffers on `window.cofresso.events` and dispatches a
 * `cofresso:event` CustomEvent so any SDK (Coframe, GTM, etc.) can subscribe
 * without this codebase depending on it. Safe to call on the server (no-op).
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const tracked: TrackedEvent = { event, timestamp: new Date().toISOString() };
  window.cofresso ??= { events: [] };
  window.cofresso.events.push(tracked);
  if (window.cofresso.events.length > MAX_BUFFERED_EVENTS) {
    window.cofresso.events.splice(0, window.cofresso.events.length - MAX_BUFFERED_EVENTS);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: tracked }));
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event.name, event);
  }
}
```

Run: `pnpm test:unit src/lib/analytics` → PASS.

- [ ] **Step 4: Client components**

`src/components/analytics/analytics-provider.tsx`:
```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    track({ name: 'page_view', path: pathname, title: document.title });
  }, [pathname]);
  return null;
}
```

`src/components/analytics/console-easter-egg.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { siteConfig } from '@/lib/config';

export function ConsoleEasterEgg() {
  useEffect(() => {
    if (window.sessionStorage.getItem('cofresso:egg')) return;
    window.sessionStorage.setItem('cofresso:egg', '1');
    console.log(
      '%c☕ Cofresso %cPsst. The beans are open source: ' + siteConfig.easterEggUrl,
      'background:#4A2C24;color:#F6F1EB;padding:2px 8px;border-radius:4px;font-weight:600',
      'color:#A08977;padding-left:8px',
    );
  }, []);
  return null;
}
```

`src/components/analytics/third-party-scripts.tsx` (server component):
```tsx
import Script from 'next/script';
import { getServerEnv } from '@/lib/env';

/**
 * Integration point for the Coframe SDK. Renders nothing unless COFRAME_SITE_KEY
 * is set in the server environment. Read at request time so it can be toggled per
 * environment without rebuilding the image.
 */
export function ThirdPartyScripts() {
  const env = getServerEnv();
  if (!env.COFRAME_SITE_KEY) return null;
  const src = env.COFRAME_SCRIPT_URL ?? 'https://cdn.coframe.com/sdk.js';
  return <Script id="coframe-sdk" src={src} data-site-key={env.COFRAME_SITE_KEY} strategy="afterInteractive" />;
}
```

- [ ] **Step 5: Easter egg route, humans.txt, robots, sitemap**

`src/app/coffee/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { siteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(siteConfig.easterEggUrl, 302);
}
```

`public/humans.txt`:
```
/* TEAM */
Roasters, developers and one very patient kettle.
Site: https://cofresso.com

/* THANKS */
Built as a sandbox for Coframe. The beans are open source:
https://github.com/coframe/coffee

/* SITE */
Standards: HTML5, CSS3, TypeScript
Components: Next.js, React, Tailwind CSS, Drizzle ORM, Postgres
```

`src/app/robots.ts`:
```ts
import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = getServerEnv().SITE_URL;
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/checkout', '/orders', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

`src/app/sitemap.ts` (initial version; Task 13 adds products and collections):
```ts
import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().SITE_URL;
  const staticRoutes = ['', '/shop', '/about', '/faq', '/brew-guides', '/orders'];
  return staticRoutes.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly', priority: path === '' ? 1 : 0.7 }));
}
```

- [ ] **Step 6: Wire into the root layout**

Edit `src/app/layout.tsx` body:
```tsx
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { ConsoleEasterEgg } from '@/components/analytics/console-easter-egg';
import { ThirdPartyScripts } from '@/components/analytics/third-party-scripts';
// ...
      <body className="flex min-h-screen flex-col">
        {children}
        <AnalyticsProvider />
        <ConsoleEasterEgg />
        <ThirdPartyScripts />
      </body>
```

Run: `pnpm dev` then `curl -sI localhost:3000/coffee | head -3` → `HTTP/1.1 302` with `location: https://github.com/coframe/coffee`. `curl -s localhost:3000/robots.txt` shows the sitemap line. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add typed analytics events, Coframe SDK slot, easter eggs, robots and sitemap"
```

---

### Task 9: UI primitives

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/price.tsx`, `src/components/ui/rating.tsx`, `src/components/ui/container.tsx`, `src/components/ui/section-heading.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/icons.tsx`, `src/components/ui/quantity-stepper.tsx`, `src/components/ui/skeleton.tsx`
- Test: `src/components/ui/button.test.tsx`, `src/components/ui/price.test.tsx`

**Interfaces:**
- Produces: `Button`, `ButtonLink`, `buttonClasses({ variant, size })`; `Input`, `Label`, `Field`, `FieldError`; `Select`; `Badge`; `Price`; `Rating`; `Container`; `SectionHeading`; `Sheet` (client); icons `IconBag IconSearch IconMenu IconX IconMinus IconPlus IconStar IconArrowRight IconCheck IconLeaf`; `QuantityStepper` (client); `Skeleton`.

- [ ] **Step 1: Failing component tests**

`src/components/ui/button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './button';

describe('Button', () => {
  it('renders a primary button by default', () => {
    render(<Button>Add to cart</Button>);
    const btn = screen.getByRole('button', { name: 'Add to cart' });
    expect(btn.className).toContain('bg-espresso');
  });
  it('shows a busy state', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
  it('renders links with button styling', () => {
    render(<ButtonLink href="/shop" variant="outline">Shop</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Shop' });
    expect(link).toHaveAttribute('href', '/shop');
    expect(link.className).toContain('border');
  });
});
```

`src/components/ui/price.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Price } from './price';

describe('Price', () => {
  it('formats cents', () => {
    render(<Price cents={1800} />);
    expect(screen.getByText('$18.00')).toBeInTheDocument();
  });
  it('shows a struck-through compare-at price when higher', () => {
    render(<Price cents={6400} compareAtCents={6800} />);
    expect(screen.getByText('$68.00')).toHaveClass('line-through');
  });
});
```

Run: `pnpm test:unit src/components/ui` → FAIL.

- [ ] **Step 2: Button**

`src/components/ui/button.tsx`:
```tsx
import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'copper';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-espresso text-foam hover:bg-espresso-dark focus-visible:ring-espresso',
  secondary: 'bg-latte/20 text-espresso hover:bg-latte/30 focus-visible:ring-latte',
  outline: 'border border-espresso/30 text-espresso hover:border-espresso hover:bg-espresso/5 focus-visible:ring-espresso',
  ghost: 'text-espresso hover:bg-espresso/5 focus-visible:ring-espresso',
  copper: 'bg-copper text-foam hover:bg-copper-dark focus-visible:ring-copper',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant, size, className, loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({ variant, size, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Form primitives**

`src/components/ui/input.tsx`:
```tsx
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-espresso', className)} {...props} />;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border bg-foam px-3 text-base text-espresso placeholder:text-latte focus:outline-none focus:ring-2 focus:ring-espresso/40',
        invalid ? 'border-red-500' : 'border-latte/50',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-700">
      {children}
    </p>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !message ? <p className="mt-1 text-xs text-latte">{hint}</p> : null}
      <FieldError id={`${htmlFor}-error`}>{message}</FieldError>
    </div>
  );
}
```

`src/components/ui/select.tsx`:
```tsx
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-lg border border-latte/50 bg-foam px-3 pr-9 text-base text-espresso focus:outline-none focus:ring-2 focus:ring-espresso/40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-latte" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Badge, Price, Rating, Container, SectionHeading, Skeleton, Icons**

`src/components/ui/badge.tsx`:
```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'copper' | 'leaf' | 'espresso';
const tones: Record<Tone, string> = {
  neutral: 'bg-latte/20 text-espresso',
  copper: 'bg-copper/15 text-copper-dark',
  leaf: 'bg-leaf/15 text-leaf',
  espresso: 'bg-espresso text-foam',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide', tones[tone], className)}
      {...props}
    />
  );
}
```

`src/components/ui/price.tsx`:
```tsx
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface PriceProps {
  cents: number;
  compareAtCents?: number | null;
  className?: string;
  suffix?: string;
}

export function Price({ cents, compareAtCents, className, suffix }: PriceProps) {
  const showCompare = typeof compareAtCents === 'number' && compareAtCents > cents;
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-medium tabular-nums">{formatPrice(cents)}</span>
      {showCompare ? <span className="text-sm text-latte line-through tabular-nums">{formatPrice(compareAtCents)}</span> : null}
      {suffix ? <span className="text-sm text-latte">{suffix}</span> : null}
    </span>
  );
}
```

`src/components/ui/rating.tsx`:
```tsx
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function Rating({ value, count, size = 'sm', className }: RatingProps) {
  const rounded = Math.round(value * 2) / 2;
  const dim = size === 'sm' ? 'size-3.5' : 'size-5';
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 20 20" className={cn(dim, i <= rounded ? 'text-copper' : 'text-latte/40')} fill="currentColor">
            <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8z" />
          </svg>
        ))}
      </span>
      {typeof count === 'number' ? <span className="text-xs text-latte">({count})</span> : null}
    </span>
  );
}
```

`src/components/ui/container.tsx`:
```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
```

`src/components/ui/section-heading.tsx`:
```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, action, align = 'left', className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', align === 'center' && 'text-center sm:flex-col sm:items-center', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">{eyebrow}</p> : null}
        <h2 className="text-3xl leading-tight sm:text-4xl">{title}</h2>
        {description ? <p className="mt-3 text-latte">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
```

`src/components/ui/skeleton.tsx`:
```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-latte/20', className)} aria-hidden="true" />;
}
```

`src/components/ui/icons.tsx`:
```tsx
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconBag = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconMenu = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconX = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconMinus = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconLeaf = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" /><path d="M5 19c3-4 6-7 10-10" /></svg>
);
export const IconTruck = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>
);
```

- [ ] **Step 5: Sheet and QuantityStepper (client)**

`src/components/ui/sheet.tsx`:
```tsx
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconX } from './icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}

export function Sheet({ open, onClose, title, side = 'right', children, footer, testId }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div
        className={cn('absolute inset-0 bg-espresso/40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={cn(
          'absolute inset-y-0 flex w-full max-w-md flex-col bg-foam shadow-2xl transition-transform duration-300 focus:outline-none',
          side === 'right' ? 'right-0' : 'left-0',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-latte/30 px-5 py-4">
          <h2 className="text-xl">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-espresso/5">
            <IconX />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-latte/30 bg-cream px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
```

`src/components/ui/quantity-stepper.tsx`:
```tsx
'use client';

import { cn } from '@/lib/utils';
import { IconMinus, IconPlus } from './icons';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = 10, disabled, label = 'Quantity', size = 'md', className }: QuantityStepperProps) {
  const btn = cn('flex items-center justify-center text-espresso disabled:opacity-40', size === 'sm' ? 'size-8' : 'size-10');
  return (
    <div className={cn('inline-flex items-center rounded-full border border-latte/50 bg-foam', className)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <IconMinus width={16} height={16} />
      </button>
      <span className={cn('min-w-8 text-center tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <IconPlus width={16} height={16} />
      </button>
    </div>
  );
}
```

Run: `pnpm test:unit src/components/ui` → PASS.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add UI primitives (button, form fields, badge, price, rating, sheet, stepper)"
```

---

### Task 10: Layout shell, cart components, cart drawer and cart page

**Files:**
- Create: `src/lib/catalog/labels.ts`, `src/lib/catalog/labels.test.ts`
- Create: `src/components/layout/logo.tsx`, `src/components/layout/header.tsx`, `src/components/layout/footer.tsx`, `src/components/layout/mobile-nav.tsx`, `src/components/layout/cart-button.tsx`, `src/components/layout/cart-drawer-context.tsx`, `src/components/layout/cart-drawer.tsx`, `src/components/layout/search-form.tsx`
- Create: `src/components/cart/cart-line.tsx`, `src/components/cart/cart-summary.tsx`, `src/components/cart/promo-code-form.tsx`, `src/components/cart/free-shipping-bar.tsx`, `src/components/cart/cart-panel.tsx`, `src/components/cart/empty-cart.tsx`
- Create: `src/app/(checkout)/cart/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: cart queries/actions (Task 6), UI primitives (Task 9), `siteConfig`, `track`.
- Produces: `grindLabel(g)`, `roastLabel(r)`, `purchaseTypeLabel(p, weeks)`, `intervalLabel(weeks)`, `categoryLabel(c)`; `<Header />`, `<Footer />`, `<CartDrawer />` (server), `CartDrawerProvider`, `useCartDrawer(): { open: boolean; openDrawer(): void; closeDrawer(): void }`; `<CartPanel cart mode="drawer" | "page" />`; `<FreeShippingBar remainingCents unlocked />`; `<CartSummary totals discountCode discountMessage />`.

- [ ] **Step 1: Labels with test**

`src/lib/catalog/labels.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { grindLabel, intervalLabel, purchaseTypeLabel, roastLabel } from './labels';

describe('labels', () => {
  it('humanises enums', () => {
    expect(grindLabel('whole_bean')).toBe('Whole bean');
    expect(grindLabel('french_press')).toBe('French press');
    expect(grindLabel(null)).toBe('');
    expect(roastLabel('medium_dark')).toBe('Medium-dark');
    expect(intervalLabel(4)).toBe('Every 4 weeks');
    expect(purchaseTypeLabel('subscription', 2)).toBe('Subscription · Every 2 weeks');
    expect(purchaseTypeLabel('one_time', null)).toBe('One-time');
  });
});
```

`src/lib/catalog/labels.ts`:
```ts
import type { Grind, ProductCategory, PurchaseType, RoastLevel } from '@/lib/db/schema';

const grinds: Record<Grind, string> = {
  whole_bean: 'Whole bean',
  drip: 'Drip',
  espresso: 'Espresso',
  french_press: 'French press',
  pour_over: 'Pour over',
};

const roasts: Record<RoastLevel, string> = {
  light: 'Light',
  medium: 'Medium',
  medium_dark: 'Medium-dark',
  dark: 'Dark',
};

const categories: Record<ProductCategory, string> = { coffee: 'Coffee', equipment: 'Equipment', merch: 'Merch' };

export const GRIND_OPTIONS = (Object.keys(grinds) as Grind[]).map((value) => ({ value, label: grinds[value] }));
export const ROAST_OPTIONS = (Object.keys(roasts) as RoastLevel[]).map((value) => ({ value, label: roasts[value] }));

export function grindLabel(grind: Grind | null | undefined): string {
  return grind ? grinds[grind] : '';
}

export function roastLabel(level: RoastLevel | null | undefined): string {
  return level ? roasts[level] : '';
}

export function categoryLabel(category: ProductCategory): string {
  return categories[category];
}

export function intervalLabel(weeks: number): string {
  return `Every ${weeks} weeks`;
}

export function purchaseTypeLabel(type: PurchaseType, weeks: number | null): string {
  return type === 'subscription' && weeks ? `Subscription · ${intervalLabel(weeks)}` : 'One-time';
}
```

Run: `pnpm test:unit src/lib/catalog` → PASS.

- [ ] **Step 2: Cart drawer context, cart button, logo, search form, mobile nav**

`src/components/layout/cart-drawer-context.tsx`:
```tsx
'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface CartDrawerState {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartDrawerContext = createContext<CartDrawerState | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer }), [open, openDrawer, closeDrawer]);
  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}

export function useCartDrawer(): CartDrawerState {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) throw new Error('useCartDrawer must be used inside CartDrawerProvider');
  return ctx;
}
```

`src/components/layout/cart-button.tsx`:
```tsx
'use client';

import { IconBag } from '@/components/ui/icons';
import { useCartDrawer } from './cart-drawer-context';

export function CartButton({ count }: { count: number }) {
  const { openDrawer } = useCartDrawer();
  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative rounded-full p-2 text-espresso hover:bg-espresso/5"
      aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
      data-testid="cart-button"
    >
      <IconBag width={22} height={22} />
      {count > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-copper text-[11px] font-semibold text-foam"
          data-testid="cart-count"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
```

`src/components/layout/logo.tsx`:
```tsx
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5', className)} aria-label="Cofresso home">
      <Image src="/logo.png" alt="" width={36} height={36} priority className="size-9" />
      {wordmark ? <span className="font-display text-2xl font-semibold tracking-tight">Cofresso</span> : null}
    </Link>
  );
}
```

`src/components/layout/search-form.tsx`:
```tsx
import { IconSearch } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function SearchForm({ className, defaultValue = '' }: { className?: string; defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className={cn('relative', className)}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search coffee, gear…"
        className="h-10 w-full rounded-full border border-latte/40 bg-foam pl-10 pr-4 text-sm placeholder:text-latte focus:outline-none focus:ring-2 focus:ring-espresso/30"
      />
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-latte" width={16} height={16} />
    </form>
  );
}
```

`src/components/layout/mobile-nav.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconMenu } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { siteConfig } from '@/lib/config';
import { SearchForm } from './search-form';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="rounded-full p-2 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <IconMenu width={22} height={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <div className="flex flex-col gap-6 p-5">
          <SearchForm />
          <nav className="flex flex-col gap-1">
            {siteConfig.nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-lg hover:bg-espresso/5">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-1 border-t border-latte/30 pt-4 text-sm text-latte">
            {siteConfig.footerLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="px-3 py-2 hover:text-espresso">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 3: Header and footer (server components)**

`src/components/layout/header.tsx`:
```tsx
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { siteConfig } from '@/lib/config';
import { readCartId } from '@/lib/cart/cookie';
import { getCartItemCount } from '@/lib/cart/queries';
import { CartButton } from './cart-button';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';

export async function Header() {
  const cartId = await readCartId();
  const count = cartId ? await getCartItemCount(cartId) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-latte/20 bg-cream/90 backdrop-blur">
      <div className="bg-espresso text-center text-xs text-foam" data-testid="announcement-bar">
        <Container className="py-2">Free shipping on orders over $45 · Subscribe &amp; save 15%</Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Logo />
        </div>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {siteConfig.nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-espresso/80 transition-colors hover:text-espresso">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SearchForm className="hidden w-56 lg:block" />
          <Link href="/search" className="rounded-full p-2 lg:hidden" aria-label="Search">
            <span className="sr-only">Search</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </Link>
          <CartButton count={count} />
        </div>
      </Container>
    </header>
  );
}
```

`src/components/layout/footer.tsx`:
```tsx
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { siteConfig } from '@/lib/config';
import { Logo } from './logo';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-latte/20 bg-foam">
      <Container className="grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-latte">{siteConfig.description}</p>
        </div>
        <div>
          <h3 className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-latte">Shop</h3>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {siteConfig.nav.slice(0, 4).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-copper">{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-latte">Help</h3>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {siteConfig.footerLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-copper">{item.label}</Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-copper">{siteConfig.supportEmail}</a>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-latte/20">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-latte sm:flex-row">
          <p>© {year} Cofresso Coffee Co. All rights reserved.</p>
          <p>
            Made with{' '}
            <a href={siteConfig.easterEggUrl} className="hover:text-copper" title="The beans are open source" data-testid="easter-egg-link" rel="noopener">
              ☕
            </a>{' '}
            in a very small roastery.
          </p>
        </Container>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Cart components**

`src/components/cart/free-shipping-bar.tsx`:
```tsx
import { IconTruck } from '@/components/ui/icons';
import { formatPrice } from '@/lib/pricing';

export function FreeShippingBar({ remainingCents, unlocked, thresholdCents }: { remainingCents: number; unlocked: boolean; thresholdCents: number }) {
  const progress = unlocked ? 100 : Math.min(100, Math.round(((thresholdCents - remainingCents) / thresholdCents) * 100));
  return (
    <div className="rounded-xl bg-cream p-4" data-testid="free-shipping-bar" data-unlocked={unlocked}>
      <p className="flex items-center gap-2 text-sm">
        <IconTruck className="text-copper" />
        {unlocked ? (
          <span className="font-medium text-leaf">You unlocked free shipping.</span>
        ) : (
          <span>
            Add <strong>{formatPrice(remainingCents)}</strong> more for free shipping.
          </span>
        )}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-latte/30" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-copper transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

`src/components/cart/cart-summary.tsx`:
```tsx
import { formatPrice, type Totals } from '@/lib/pricing';

interface CartSummaryProps {
  totals: Totals;
  discountCode?: string | null;
  compact?: boolean;
}

export function CartSummary({ totals, discountCode, compact = false }: CartSummaryProps) {
  const row = 'flex items-center justify-between text-sm';
  return (
    <dl className="flex flex-col gap-2" data-testid="cart-summary">
      <div className={row}>
        <dt>Subtotal</dt>
        <dd className="tabular-nums" data-testid="summary-subtotal">{formatPrice(totals.subtotalCents)}</dd>
      </div>
      {totals.subscriptionSavingsCents > 0 ? (
        <div className={`${row} text-leaf`}>
          <dt>Subscription savings</dt>
          <dd className="tabular-nums">−{formatPrice(totals.subscriptionSavingsCents)}</dd>
        </div>
      ) : null}
      {totals.discountCents > 0 ? (
        <div className={`${row} text-leaf`}>
          <dt>Discount{discountCode ? ` (${discountCode})` : ''}</dt>
          <dd className="tabular-nums" data-testid="summary-discount">−{formatPrice(totals.discountCents)}</dd>
        </div>
      ) : null}
      {!compact ? (
        <>
          <div className={row}>
            <dt>Shipping</dt>
            <dd className="tabular-nums" data-testid="summary-shipping">{totals.shippingCents === 0 ? 'Free' : formatPrice(totals.shippingCents)}</dd>
          </div>
          <div className={row}>
            <dt>Estimated tax</dt>
            <dd className="tabular-nums">{formatPrice(totals.taxCents)}</dd>
          </div>
        </>
      ) : null}
      <div className="mt-1 flex items-center justify-between border-t border-latte/30 pt-3 text-base font-semibold">
        <dt>{compact ? 'Estimated total' : 'Total'}</dt>
        <dd className="tabular-nums" data-testid="summary-total">{formatPrice(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
```

`src/components/cart/promo-code-form.tsx`:
```tsx
'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics/track';
import { applyPromoAction, removePromoAction } from '@/lib/cart/actions';

interface PromoCodeFormProps {
  appliedCode: string | null;
  message?: string | null;
}

export function PromoCodeForm({ appliedCode, message }: PromoCodeFormProps) {
  const [state, formAction, pending] = useActionState(applyPromoAction, null);
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state) track({ name: 'apply_promo', code: state.ok ? state.data.code : 'unknown', success: state.ok });
  }, [state]);

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-leaf/60 bg-leaf/5 px-3 py-2 text-sm" data-testid="promo-applied">
        <span>
          Code <strong>{appliedCode}</strong> applied{message ? <span className="block text-xs text-copper-dark">{message}</span> : null}
        </span>
        <Button variant="ghost" size="sm" loading={removing} onClick={() => startRemove(async () => void (await removePromoAction()))}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1" data-testid="promo-form">
      <div className="flex gap-2">
        <Input name="code" placeholder="Promo code" aria-label="Promo code" autoComplete="off" className="h-10 uppercase" />
        <Button type="submit" variant="outline" size="sm" className="h-10" loading={pending}>
          Apply
        </Button>
      </div>
      {state && !state.ok ? <p className="text-xs text-red-700" role="alert">{state.error}</p> : null}
    </form>
  );
}
```

`src/components/cart/cart-line.tsx`:
```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { track } from '@/lib/analytics/track';
import { removeCartLineAction, updateCartLineAction } from '@/lib/cart/actions';
import type { CartLine as CartLineData } from '@/lib/cart/types';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import { formatPrice } from '@/lib/pricing';

export function CartLine({ line, compact = false }: { line: CartLineData; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const update = (quantity: number) =>
    start(async () => {
      setError(null);
      const result = await updateCartLineAction(line.id, quantity);
      if (!result.ok) setError(result.error);
    });

  const remove = () =>
    start(async () => {
      track({ name: 'remove_from_cart', item: { productId: line.product.id, slug: line.product.slug, name: line.product.name, variantId: line.variant.id, variantName: line.variant.name, priceCents: line.effectiveUnitPriceCents, quantity: line.quantity } });
      const result = await removeCartLineAction(line.id);
      if (!result.ok) setError(result.error);
    });

  const details = [line.variant.name, grindLabel(line.grind), purchaseTypeLabel(line.purchaseType, line.subscriptionIntervalWeeks)].filter(Boolean);

  return (
    <li className="flex gap-4 py-4" data-testid="cart-line" data-line-id={line.id}>
      <Link href={`/products/${line.product.slug}`} className="shrink-0 overflow-hidden rounded-lg bg-cream">
        <Image src={line.product.imagePath} alt={line.product.name} width={compact ? 72 : 96} height={compact ? 90 : 120} unoptimized className="h-auto w-[72px] sm:w-24" />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/products/${line.product.slug}`} className="font-medium hover:text-copper">
              {line.product.name}
            </Link>
            <p className="text-xs text-latte">{details.join(' · ')}</p>
          </div>
          <p className="text-sm font-medium tabular-nums" data-testid="line-total">{formatPrice(line.lineTotalCents)}</p>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <QuantityStepper size="sm" value={line.quantity} onChange={update} disabled={pending} max={Math.min(10, line.variant.stockQuantity)} />
          <button type="button" onClick={remove} disabled={pending} className="text-xs text-latte underline-offset-2 hover:text-espresso hover:underline">
            Remove
          </button>
        </div>
        {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
      </div>
    </li>
  );
}
```

`src/components/cart/empty-cart.tsx`:
```tsx
import { ButtonLink } from '@/components/ui/button';

export function EmptyCart({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center" data-testid="empty-cart">
      <p className="text-4xl">☕</p>
      <h3 className="text-2xl">Your cart is empty</h3>
      <p className="max-w-xs text-sm text-latte">Fresh roasts ship within 48 hours of roasting. Find your next favorite.</p>
      <ButtonLink href="/shop" onClick={onNavigate}>
        Shop coffee
      </ButtonLink>
    </div>
  );
}
```

`src/components/cart/cart-panel.tsx`:
```tsx
'use client';

import { ButtonLink } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';
import type { CartView } from '@/lib/cart/types';
import { siteConfig } from '@/lib/config';
import { CartLine } from './cart-line';
import { CartSummary } from './cart-summary';
import { EmptyCart } from './empty-cart';
import { FreeShippingBar } from './free-shipping-bar';
import { PromoCodeForm } from './promo-code-form';

interface CartPanelProps {
  cart: CartView | null;
  mode: 'drawer' | 'page';
  onNavigate?: () => void;
}

export function CartPanel({ cart, mode, onNavigate }: CartPanelProps) {
  if (!cart || cart.lines.length === 0) return <EmptyCart onNavigate={onNavigate} />;

  const beginCheckout = () => {
    track({ name: 'begin_checkout', valueCents: cart.totals.totalCents, itemCount: cart.totals.itemCount });
    onNavigate?.();
  };

  const lines = (
    <ul className="divide-y divide-latte/20" data-testid="cart-lines">
      {cart.lines.map((line) => (
        <CartLine key={line.id} line={line} compact={mode === 'drawer'} />
      ))}
    </ul>
  );

  const aside = (
    <div className="flex flex-col gap-4">
      <FreeShippingBar remainingCents={cart.totals.freeShippingRemainingCents} unlocked={cart.totals.freeShippingUnlocked} thresholdCents={siteConfig.pricing.freeShippingThresholdCents} />
      <PromoCodeForm appliedCode={cart.discountCode} message={cart.discountMessage} />
      <CartSummary totals={cart.totals} discountCode={cart.discountCode} compact={mode === 'drawer'} />
      <ButtonLink href="/checkout" size="lg" variant="copper" className="w-full" onClick={beginCheckout} data-testid="checkout-link">
        Checkout
      </ButtonLink>
      {mode === 'drawer' ? (
        <ButtonLink href="/cart" variant="ghost" size="sm" onClick={onNavigate}>
          View full cart
        </ButtonLink>
      ) : null}
    </div>
  );

  if (mode === 'drawer') {
    return (
      <div className="flex flex-col gap-6 px-5 py-2">
        {lines}
        {aside}
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>{lines}</div>
      <aside className="rounded-2xl bg-foam p-6 shadow-sm lg:sticky lg:top-28">{aside}</aside>
    </div>
  );
}
```

- [ ] **Step 5: Cart drawer (server + client shell) and layout wiring**

`src/components/layout/cart-drawer.tsx`:
```tsx
import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';
import { CartDrawerShell } from './cart-drawer-shell';

export async function CartDrawer() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  return <CartDrawerShell cart={cart} />;
}
```

`src/components/layout/cart-drawer-shell.tsx`:
```tsx
'use client';

import { Sheet } from '@/components/ui/sheet';
import { CartPanel } from '@/components/cart/cart-panel';
import type { CartView } from '@/lib/cart/types';
import { useCartDrawer } from './cart-drawer-context';

export function CartDrawerShell({ cart }: { cart: CartView | null }) {
  const { open, closeDrawer } = useCartDrawer();
  const count = cart?.totals.itemCount ?? 0;
  return (
    <Sheet open={open} onClose={closeDrawer} title={count ? `Your cart (${count})` : 'Your cart'} testId="cart-drawer">
      <CartPanel cart={cart} mode="drawer" onNavigate={closeDrawer} />
    </Sheet>
  );
}
```

Update `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { ConsoleEasterEgg } from '@/components/analytics/console-easter-egg';
import { ThirdPartyScripts } from '@/components/analytics/third-party-scripts';
import { CartDrawer } from '@/components/layout/cart-drawer';
import { CartDrawerProvider } from '@/components/layout/cart-drawer-context';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { siteConfig } from '@/lib/config';
import { getServerEnv } from '@/lib/env';
import { fraunces, inter } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const base = getServerEnv().SITE_URL;
  return {
    metadataBase: new URL(base),
    title: { default: `${siteConfig.name} — ${siteConfig.tagline}`, template: `%s · ${siteConfig.name}` },
    description: siteConfig.description,
    openGraph: { type: 'website', siteName: siteConfig.name, images: ['/logo.png'] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <CartDrawerProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartDrawerProvider>
        <AnalyticsProvider />
        <ConsoleEasterEgg />
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Cart page**

`src/app/(checkout)/cart/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { CartPanel } from '@/components/cart/cart-panel';
import { Container } from '@/components/ui/container';
import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';
import { CartPageTracker } from './tracker';

export const metadata: Metadata = { title: 'Your cart' };

export default async function CartPage() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  return (
    <Container className="py-12">
      <h1 className="mb-8 text-4xl">Your cart</h1>
      <CartPanel cart={cart} mode="page" />
      <CartPageTracker valueCents={cart?.totals.totalCents ?? 0} itemCount={cart?.totals.itemCount ?? 0} />
    </Container>
  );
}
```

`src/app/(checkout)/cart/tracker.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function CartPageTracker({ valueCents, itemCount }: { valueCents: number; itemCount: number }) {
  useEffect(() => {
    track({ name: 'view_cart', valueCents, itemCount });
  }, [valueCents, itemCount]);
  return null;
}
```

- [ ] **Step 7: Verify in the browser**

Run: `pnpm dev`. Visit `http://localhost:3000/cart`: header with logo, nav, search, cart icon; empty cart state; footer with the ☕ easter egg link. Click the cart icon: drawer slides in with the empty state. Resize narrow: hamburger opens the left sheet. Stop the server.

- [ ] **Step 8: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add layout shell, cart drawer, cart components and cart page"
```

---

### Task 11: Product components and add-to-cart form

**Files:**
- Create: `src/lib/catalog/types.ts`, `src/components/product/product-card.tsx`, `src/components/product/product-grid.tsx`, `src/components/product/variant-selector.tsx`, `src/components/product/grind-selector.tsx`, `src/components/product/purchase-type-toggle.tsx`, `src/components/product/add-to-cart-form.tsx`
- Test: `src/components/product/add-to-cart-form.test.tsx`

**Interfaces:**
- Produces:
  - `type ProductCardData = { product: Product; variants: ProductVariant[]; rating: { average: number; count: number } }`
  - `type ProductDetailData = ProductCardData & { collections: Collection[]; reviews: Review[] }`
  - `<ProductCard data listId? />`, `<ProductGrid items listId emptyMessage? />`
  - `<AddToCartForm product variants />` (client) using `addToCartAction`, `useCartDrawer`, `track`
  - `<VariantSelector variants value onChange />`, `<GrindSelector value onChange />`, `<PurchaseTypeToggle value interval onChange />`

- [ ] **Step 1: Catalog view types**

`src/lib/catalog/types.ts`:
```ts
import type { Collection, Product, ProductVariant, Review } from '@/lib/db/schema';

export interface ProductRating {
  average: number;
  count: number;
}

export interface ProductCardData {
  product: Product;
  variants: ProductVariant[];
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
  return [...variants].sort((a, b) => a.position - b.position).find((v) => v.stockQuantity > 0) ?? variants[0];
}
```

- [ ] **Step 2: Failing test for AddToCartForm**

`src/components/product/add-to-cart-form.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { CartDrawerProvider } from '@/components/layout/cart-drawer-context';
import { AddToCartForm } from './add-to-cart-form';

vi.mock('@/lib/cart/actions', () => ({
  addToCartAction: vi.fn(async () => ({ ok: true, data: { itemCount: 1 } })),
}));

const product = {
  id: 'p1',
  slug: 'morning-frame',
  name: 'Morning Frame',
  category: 'coffee',
} as Product;

const variants: ProductVariant[] = [
  { id: '11111111-1111-4111-8111-111111111111', productId: 'p1', sku: 'A', name: '12 oz', weightGrams: 340, priceCents: 1800, compareAtPriceCents: null, stockQuantity: 10, position: 0 },
  { id: '22222222-2222-4222-8222-222222222222', productId: 'p1', sku: 'B', name: '2 lb', weightGrams: 907, priceCents: 4400, compareAtPriceCents: null, stockQuantity: 0, position: 1 },
];

function renderForm() {
  return render(
    <CartDrawerProvider>
      <AddToCartForm product={product} variants={variants} />
    </CartDrawerProvider>,
  );
}

describe('AddToCartForm', () => {
  it('shows the selected variant price and subscription savings', async () => {
    renderForm();
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$18.00');
    await userEvent.click(screen.getByRole('radio', { name: /subscribe/i }));
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$15.30');
  });

  it('disables sold out variants', () => {
    renderForm();
    expect(screen.getByRole('radio', { name: /2 lb/i })).toBeDisabled();
  });

  it('changes quantity and keeps price per unit', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$18.00');
    expect(screen.getByRole('button', { name: /add to cart/i })).toHaveTextContent('$36.00');
  });
});
```

Run: `pnpm test:unit src/components/product` → FAIL.

- [ ] **Step 3: Selectors**

`src/components/product/variant-selector.tsx`:
```tsx
'use client';

import type { ProductVariant } from '@/lib/db/schema';
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  value: string;
  onChange: (variantId: string) => void;
}

export function VariantSelector({ variants, value, onChange }: VariantSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Size</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {[...variants]
          .sort((a, b) => a.position - b.position)
          .map((v) => {
            const soldOut = v.stockQuantity <= 0;
            const selected = v.id === value;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={soldOut}
                onClick={() => onChange(v.id)}
                data-testid={`variant-${v.sku}`}
                className={cn(
                  'flex min-w-24 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-colors',
                  selected ? 'border-espresso bg-espresso text-foam' : 'border-latte/50 bg-foam hover:border-espresso',
                  soldOut && 'cursor-not-allowed opacity-50 line-through',
                )}
              >
                <span className="text-sm font-medium">{v.name}</span>
                <span className={cn('text-xs', selected ? 'text-foam/80' : 'text-latte')}>{soldOut ? 'Sold out' : formatPrice(v.priceCents)}</span>
              </button>
            );
          })}
      </div>
    </fieldset>
  );
}
```

`src/components/product/grind-selector.tsx`:
```tsx
'use client';

import { Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { GRIND_OPTIONS } from '@/lib/catalog/labels';
import type { Grind } from '@/lib/db/schema';

export function GrindSelector({ value, onChange }: { value: Grind; onChange: (grind: Grind) => void }) {
  return (
    <div>
      <Label htmlFor="grind">Grind</Label>
      <Select id="grind" name="grind" value={value} onChange={(e) => onChange(e.target.value as Grind)} data-testid="grind-select">
        {GRIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-latte">We grind to order. Whole bean stays fresh longest.</p>
    </div>
  );
}
```

`src/components/product/purchase-type-toggle.tsx`:
```tsx
'use client';

import { Select } from '@/components/ui/select';
import { intervalLabel } from '@/lib/catalog/labels';
import { siteConfig, type SubscriptionInterval } from '@/lib/config';
import type { PurchaseType } from '@/lib/db/schema';
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface PurchaseTypeToggleProps {
  value: PurchaseType;
  interval: SubscriptionInterval;
  oneTimeCents: number;
  subscriptionCents: number;
  onChange: (next: { purchaseType: PurchaseType; interval: SubscriptionInterval }) => void;
}

export function PurchaseTypeToggle({ value, interval, oneTimeCents, subscriptionCents, onChange }: PurchaseTypeToggleProps) {
  const option = (type: PurchaseType, title: string, price: number, hint: string) => {
    const selected = value === type;
    return (
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
          selected ? 'border-copper bg-copper/5' : 'border-latte/50 bg-foam hover:border-espresso/50',
        )}
      >
        <input
          type="radio"
          name="purchaseTypeChoice"
          className="mt-1 accent-copper"
          checked={selected}
          onChange={() => onChange({ purchaseType: type, interval })}
          aria-label={title}
        />
        <span className="flex flex-1 flex-col">
          <span className="flex items-center justify-between text-sm font-medium">
            <span>{title}</span>
            <span className="tabular-nums">{formatPrice(price)}</span>
          </span>
          <span className="text-xs text-latte">{hint}</span>
        </span>
      </label>
    );
  };

  return (
    <fieldset className="flex flex-col gap-2" data-testid="purchase-type">
      <legend className="mb-2 text-sm font-medium">Purchase</legend>
      {option('one_time', 'One-time purchase', oneTimeCents, 'Ships within 48 hours of roasting.')}
      {option('subscription', `Subscribe & save ${siteConfig.pricing.subscriptionDiscountPercent}%`, subscriptionCents, 'Pause, skip or cancel anytime. Free shipping on every subscription order over $45.')}
      {value === 'subscription' ? (
        <Select
          aria-label="Delivery interval"
          value={interval}
          onChange={(e) => onChange({ purchaseType: 'subscription', interval: Number(e.target.value) as SubscriptionInterval })}
          data-testid="interval-select"
        >
          {siteConfig.subscriptionIntervals.map((weeks) => (
            <option key={weeks} value={weeks}>
              {intervalLabel(weeks)}
            </option>
          ))}
        </Select>
      ) : null}
    </fieldset>
  );
}
```

- [ ] **Step 4: AddToCartForm**

`src/components/product/add-to-cart-form.tsx`:
```tsx
'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useCartDrawer } from '@/components/layout/cart-drawer-context';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { track } from '@/lib/analytics/track';
import { addToCartAction } from '@/lib/cart/actions';
import { defaultVariant } from '@/lib/catalog/types';
import type { SubscriptionInterval } from '@/lib/config';
import type { Grind, Product, ProductVariant, PurchaseType } from '@/lib/db/schema';
import { effectiveUnitPriceCents, formatPrice } from '@/lib/pricing';
import { GrindSelector } from './grind-selector';
import { PurchaseTypeToggle } from './purchase-type-toggle';
import { VariantSelector } from './variant-selector';

interface AddToCartFormProps {
  product: Pick<Product, 'id' | 'slug' | 'name' | 'category'>;
  variants: ProductVariant[];
}

export function AddToCartForm({ product, variants }: AddToCartFormProps) {
  const initial = defaultVariant(variants);
  const [variantId, setVariantId] = useState(initial?.id ?? '');
  const [grind, setGrind] = useState<Grind>('whole_bean');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('one_time');
  const [interval, setInterval] = useState<SubscriptionInterval>(4);
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState(addToCartAction, null);
  const { openDrawer } = useCartDrawer();

  const variant = useMemo(() => variants.find((v) => v.id === variantId) ?? initial, [variants, variantId, initial]);
  const unitCents = variant ? effectiveUnitPriceCents({ unitPriceCents: variant.priceCents, quantity, purchaseType }) : 0;
  const subscriptionCents = variant ? effectiveUnitPriceCents({ unitPriceCents: variant.priceCents, quantity: 1, purchaseType: 'subscription' }) : 0;
  const isCoffee = product.category === 'coffee';
  const soldOut = !variant || variant.stockQuantity <= 0;

  useEffect(() => {
    if (variant) {
      track({ name: 'select_variant', item: { productId: product.id, slug: product.slug, name: product.name, variantId: variant.id, variantName: variant.name, priceCents: unitCents, purchaseType } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, purchaseType]);

  useEffect(() => {
    if (state?.ok && variant) {
      track({ name: 'add_to_cart', cartItemCount: state.data.itemCount, item: { productId: product.id, slug: product.slug, name: product.name, variantId: variant.id, variantName: variant.name, priceCents: unitCents, quantity, purchaseType } });
      openDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6" data-testid="add-to-cart-form">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="purchaseType" value={purchaseType} />
      <input type="hidden" name="subscriptionIntervalWeeks" value={purchaseType === 'subscription' ? interval : ''} />
      {isCoffee ? <input type="hidden" name="grind" value={grind} /> : null}

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-medium tabular-nums" data-testid="selected-price">{formatPrice(unitCents)}</span>
        {purchaseType === 'subscription' && variant ? <span className="text-sm text-latte line-through tabular-nums">{formatPrice(variant.priceCents)}</span> : null}
        {variant?.weightGrams ? <span className="text-sm text-latte">{variant.weightGrams} g</span> : null}
      </div>

      {variants.length > 1 || variants[0]?.name ? <VariantSelector variants={variants} value={variantId} onChange={setVariantId} /> : null}
      {isCoffee ? <GrindSelector value={grind} onChange={setGrind} /> : null}
      {isCoffee && variant ? (
        <PurchaseTypeToggle
          value={purchaseType}
          interval={interval}
          oneTimeCents={variant.priceCents}
          subscriptionCents={subscriptionCents}
          onChange={({ purchaseType: pt, interval: iv }) => {
            setPurchaseType(pt);
            setInterval(iv);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} max={Math.min(10, variant?.stockQuantity ?? 1)} disabled={soldOut} />
        <Button type="submit" size="lg" variant="copper" className="flex-1" loading={pending} disabled={soldOut} data-testid="add-to-cart">
          {soldOut ? 'Sold out' : `Add to cart · ${formatPrice(unitCents * quantity)}`}
        </Button>
      </div>

      {state && !state.ok ? <p className="text-sm text-red-700" role="alert">{state.error}</p> : null}
      {variant && variant.stockQuantity > 0 && variant.stockQuantity <= 10 ? (
        <p className="text-xs text-copper-dark">Only {variant.stockQuantity} left at this size.</p>
      ) : null}
    </form>
  );
}
```

Run: `pnpm test:unit src/components/product` → PASS.

- [ ] **Step 5: ProductCard and ProductGrid**

`src/components/product/product-card.tsx`:
```tsx
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { roastLabel } from '@/lib/catalog/labels';
import { lowestPriceCents, type ProductCardData } from '@/lib/catalog/types';

export function ProductCard({ data, priority = false }: { data: ProductCardData; priority?: boolean }) {
  const { product, variants, rating } = data;
  const soldOut = variants.every((v) => v.stockQuantity <= 0);
  const compareAt = variants.find((v) => v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents)?.compareAtPriceCents ?? null;
  return (
    <article className="group flex flex-col" data-testid="product-card" data-slug={product.slug}>
      <Link href={`/products/${product.slug}`} className="relative block overflow-hidden rounded-2xl bg-foam">
        <Image
          src={product.imagePath}
          alt={product.name}
          width={600}
          height={750}
          unoptimized
          priority={priority}
          className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
          {compareAt ? <Badge tone="copper">Sale</Badge> : null}
          {soldOut ? <Badge tone="espresso">Sold out</Badge> : null}
        </div>
      </Link>
      <div className="mt-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug">
            <Link href={`/products/${product.slug}`} className="hover:text-copper">
              {product.name}
            </Link>
          </h3>
          <Price cents={lowestPriceCents(variants)} compareAtCents={compareAt} className="shrink-0 text-sm" suffix={variants.length > 1 ? '+' : undefined} />
        </div>
        <p className="text-sm text-latte">{product.origin ?? product.tagline}</p>
        {product.tastingNotes.length ? <p className="text-xs text-espresso/70">{product.tastingNotes.join(' · ')}</p> : null}
        {rating.count > 0 ? <Rating value={rating.average} count={rating.count} className="mt-1" /> : null}
      </div>
    </article>
  );
}
```

`src/components/product/product-grid.tsx`:
```tsx
import type { ProductCardData } from '@/lib/catalog/types';
import { ProductCard } from './product-card';
import { ProductListTracker } from './product-list-tracker';

interface ProductGridProps {
  items: ProductCardData[];
  listId: string;
  emptyMessage?: string;
}

export function ProductGrid({ items, listId, emptyMessage = 'No products match those filters yet.' }: ProductGridProps) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-foam p-10 text-center text-latte" data-testid="empty-grid">{emptyMessage}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4" data-testid="product-grid">
        {items.map((item, i) => (
          <ProductCard key={item.product.id} data={item} priority={i < 4} />
        ))}
      </div>
      <ProductListTracker listId={listId} items={items} />
    </>
  );
}
```

`src/components/product/product-list-tracker.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import { lowestPriceCents, type ProductCardData } from '@/lib/catalog/types';

export function ProductListTracker({ listId, items }: { listId: string; items: ProductCardData[] }) {
  useEffect(() => {
    track({
      name: 'view_item_list',
      listId,
      items: items.map((i) => ({ productId: i.product.id, slug: i.product.slug, name: i.product.name, priceCents: lowestPriceCents(i.variants) })),
    });
  }, [listId, items]);
  return null;
}
```

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add product card, grid and add-to-cart form with variant, grind and subscription selectors"
```

---

### Task 12: Catalog queries, filter parsing and content modules

**Files:**
- Create: `src/lib/db/queries/catalog.ts`, `src/lib/db/queries/newsletter.ts`, `src/lib/shop/filters.ts`, `src/lib/shop/filters.test.ts`
- Create: `src/content/brew-guides/index.ts`, `src/content/faq.ts`, `src/lib/content/brew-guides.ts`, `src/lib/content/faq.ts`
- Test: `tests/integration/catalog.test.ts`, `tests/integration/newsletter.test.ts`

**Interfaces:**
- Produces:
  - `type ProductFilters = { collection?: string; roast?: RoastLevel; origin?: string; category?: ProductCategory; sort: ProductSort }`, `type ProductSort = 'featured' | 'price_asc' | 'price_desc' | 'newest'`, `SORT_OPTIONS`, `parseProductFilters(searchParams): ProductFilters`, `filtersToSearchParams(filters): URLSearchParams`
  - `listProducts(filters?, db?)`, `listFeaturedProducts(limit?, db?)`, `getProductBySlug(slug, db?)`, `listRelatedProducts(product, limit?, db?)`, `searchProducts(query, db?)`, `listCollections(db?)`, `getCollectionBySlug(slug, db?)`, `listOrigins(db?)`, `listRecentReviews(limit?, db?)`, `listProductSlugs(db?)`
  - `subscribeToNewsletter(email, source, db?): Promise<{ created: boolean }>`
  - `type BrewGuide = { slug; title; summary; method; ratio; grind; waterTempC; totalTime; steps: string[]; tips: string[]; recommendedSlugs: string[] }`, `brewGuides`, `getBrewGuide(slug)`, `type FaqItem = { question; answer }`, `faqItems`

- [ ] **Step 1: Filter parsing with tests**

`src/lib/shop/filters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { filtersToSearchParams, parseProductFilters } from './filters';

describe('parseProductFilters', () => {
  it('defaults to featured sort with no filters', () => {
    expect(parseProductFilters({})).toEqual({ sort: 'featured' });
  });
  it('accepts known values and drops unknown ones', () => {
    expect(parseProductFilters({ collection: 'blends', roast: 'light', sort: 'price_asc', origin: 'Kenya', bogus: 'x' })).toEqual({
      collection: 'blends',
      roast: 'light',
      origin: 'Kenya',
      sort: 'price_asc',
    });
    expect(parseProductFilters({ roast: 'burnt', sort: 'sideways' })).toEqual({ sort: 'featured' });
  });
  it('takes the first value of repeated params', () => {
    expect(parseProductFilters({ collection: ['decaf', 'blends'] }).collection).toBe('decaf');
  });
  it('round-trips through search params', () => {
    const f = parseProductFilters({ collection: 'blends', sort: 'newest' });
    expect(filtersToSearchParams(f).toString()).toBe('collection=blends&sort=newest');
    expect(filtersToSearchParams(parseProductFilters({})).toString()).toBe('');
  });
});
```

`src/lib/shop/filters.ts`:
```ts
import { z } from 'zod';
import { productCategoryEnum, roastLevelEnum } from '@/lib/db/schema';

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
] as const;

export type ProductSort = (typeof SORT_OPTIONS)[number]['value'];

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  collection: z.preprocess(first, z.string().regex(/^[a-z0-9-]+$/).optional()),
  roast: z.preprocess(first, z.enum(roastLevelEnum.enumValues).optional()),
  origin: z.preprocess(first, z.string().trim().min(1).max(60).optional()),
  category: z.preprocess(first, z.enum(productCategoryEnum.enumValues).optional()),
  sort: z.preprocess(first, z.enum(SORT_OPTIONS.map((o) => o.value) as [ProductSort, ...ProductSort[]]).optional()),
});

export type ProductFilters = {
  collection?: string;
  roast?: (typeof roastLevelEnum.enumValues)[number];
  origin?: string;
  category?: (typeof productCategoryEnum.enumValues)[number];
  sort: ProductSort;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseProductFilters(searchParams: RawSearchParams): ProductFilters {
  const out: ProductFilters = { sort: 'featured' };
  for (const [key, field] of Object.entries(schema.shape)) {
    const result = field.safeParse(searchParams[key]);
    if (result.success && result.data !== undefined) {
      (out as Record<string, unknown>)[key] = result.data;
    }
  }
  return out;
}

export function filtersToSearchParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.collection) params.set('collection', filters.collection);
  if (filters.roast) params.set('roast', filters.roast);
  if (filters.origin) params.set('origin', filters.origin);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  return params;
}
```

Run: `pnpm test:unit src/lib/shop` → PASS.

- [ ] **Step 2: Catalog queries**

`src/lib/db/queries/catalog.ts`:
```ts
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { lowestPriceCents, type ProductCardData, type ProductDetailData } from '@/lib/catalog/types';
import { getDb, type Db } from '@/lib/db/client';
import { collections, productCollections, products, reviews, type Collection, type Product, type Review } from '@/lib/db/schema';
import type { ProductFilters } from '@/lib/shop/filters';

type ProductWithRelations = Product & {
  variants: ProductCardData['variants'];
  reviews: Pick<Review, 'rating'>[];
};

function toCard(p: ProductWithRelations): ProductCardData {
  const count = p.reviews.length;
  const average = count ? p.reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  const { reviews: _reviews, variants, ...product } = p;
  return {
    product,
    variants: [...variants].sort((a, b) => a.position - b.position),
    rating: { average: Math.round(average * 10) / 10, count },
  };
}

function sortCards(items: ProductCardData[], sort: ProductFilters['sort']): ProductCardData[] {
  const byName = (a: ProductCardData, b: ProductCardData) => a.product.name.localeCompare(b.product.name);
  switch (sort) {
    case 'price_asc':
      return items.sort((a, b) => lowestPriceCents(a.variants) - lowestPriceCents(b.variants) || byName(a, b));
    case 'price_desc':
      return items.sort((a, b) => lowestPriceCents(b.variants) - lowestPriceCents(a.variants) || byName(a, b));
    case 'newest':
      return items.sort((a, b) => b.product.createdAt.getTime() - a.product.createdAt.getTime() || byName(a, b));
    default:
      return items.sort((a, b) => Number(b.product.featured) - Number(a.product.featured) || byName(a, b));
  }
}

export async function listProducts(filters: ProductFilters = { sort: 'featured' }, db: Db = getDb()): Promise<ProductCardData[]> {
  const conditions = [eq(products.active, true)];
  if (filters.roast) conditions.push(eq(products.roastLevel, filters.roast));
  if (filters.category) conditions.push(eq(products.category, filters.category));
  if (filters.origin) conditions.push(ilike(products.origin, `%${filters.origin}%`));
  if (filters.collection) {
    conditions.push(
      inArray(
        products.id,
        db
          .select({ id: productCollections.productId })
          .from(productCollections)
          .innerJoin(collections, eq(collections.id, productCollections.collectionId))
          .where(eq(collections.slug, filters.collection)),
      ),
    );
  }

  const rows = await db.query.products.findMany({
    where: and(...conditions),
    with: { variants: true, reviews: { columns: { rating: true } } },
  });
  return sortCards(rows.map(toCard), filters.sort);
}

export async function listFeaturedProducts(limit = 4, db: Db = getDb()): Promise<ProductCardData[]> {
  const rows = await db.query.products.findMany({
    where: and(eq(products.active, true), eq(products.featured, true)),
    with: { variants: true, reviews: { columns: { rating: true } } },
    orderBy: [asc(products.name)],
    limit,
  });
  return rows.map(toCard);
}

export async function getProductBySlug(slug: string, db: Db = getDb()): Promise<ProductDetailData | null> {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      variants: true,
      reviews: { orderBy: [desc(reviews.createdAt)] },
      productCollections: { with: { collection: true }, orderBy: [asc(productCollections.position)] },
    },
  });
  if (!row) return null;
  const { productCollections: pcs, reviews: fullReviews, ...rest } = row;
  const card = toCard({ ...rest, reviews: fullReviews });
  return { ...card, collections: pcs.map((pc) => pc.collection), reviews: fullReviews };
}

export async function listRelatedProducts(product: Product, limit = 4, db: Db = getDb()): Promise<ProductCardData[]> {
  const rows = await db.query.products.findMany({
    where: and(eq(products.active, true), ne(products.id, product.id), eq(products.category, product.category)),
    with: { variants: true, reviews: { columns: { rating: true } } },
    orderBy: [desc(products.featured), asc(products.name)],
    limit,
  });
  return rows.map(toCard);
}

export async function searchProducts(query: string, db: Db = getDb()): Promise<ProductCardData[]> {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[%_]/g, '')}%`;
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
    with: { variants: true, reviews: { columns: { rating: true } } },
    orderBy: [desc(products.featured), asc(products.name)],
  });
  return rows.map(toCard);
}

export async function listCollections(db: Db = getDb()): Promise<Collection[]> {
  return db.query.collections.findMany({ orderBy: [asc(collections.position)] });
}

export async function getCollectionBySlug(slug: string, db: Db = getDb()): Promise<Collection | null> {
  return (await db.query.collections.findFirst({ where: eq(collections.slug, slug) })) ?? null;
}

export async function listOrigins(db: Db = getDb()): Promise<string[]> {
  const rows = await db
    .selectDistinct({ origin: products.origin })
    .from(products)
    .where(and(eq(products.active, true), eq(products.category, 'coffee')))
    .orderBy(asc(products.origin));
  return rows.map((r) => r.origin).filter((o): o is string => Boolean(o));
}

export type RecentReview = Review & { product: Pick<Product, 'slug' | 'name'> };

export async function listRecentReviews(limit = 6, db: Db = getDb()): Promise<RecentReview[]> {
  return db.query.reviews.findMany({
    where: sql`${reviews.rating} >= 4`,
    with: { product: { columns: { slug: true, name: true } } },
    orderBy: [desc(reviews.createdAt)],
    limit,
  });
}

export async function listProductSlugs(db: Db = getDb()): Promise<Array<{ slug: string; createdAt: Date }>> {
  return db.select({ slug: products.slug, createdAt: products.createdAt }).from(products).where(eq(products.active, true));
}
```

`src/lib/db/queries/newsletter.ts`:
```ts
import { getDb, type Db } from '@/lib/db/client';
import { newsletterSubscribers } from '@/lib/db/schema';

export async function subscribeToNewsletter(email: string, source: string, db: Db = getDb()): Promise<{ created: boolean }> {
  const rows = await db
    .insert(newsletterSubscribers)
    .values({ email: email.trim().toLowerCase(), source })
    .onConflictDoNothing({ target: newsletterSubscribers.email })
    .returning({ id: newsletterSubscribers.id });
  return { created: rows.length > 0 };
}
```

- [ ] **Step 3: Integration tests**

`tests/integration/catalog.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest';
import { lowestPriceCents } from '../../src/lib/catalog/types';
import {
  getCollectionBySlug,
  getProductBySlug,
  listCollections,
  listFeaturedProducts,
  listOrigins,
  listProducts,
  listRecentReviews,
  listRelatedProducts,
  searchProducts,
} from '../../src/lib/db/queries/catalog';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('catalog queries', () => {
  it('lists active products featured-first by default', async () => {
    const items = await listProducts(undefined, db);
    expect(items.length).toBeGreaterThanOrEqual(18);
    expect(items[0].product.featured).toBe(true);
    expect(items.every((i) => i.variants.length > 0)).toBe(true);
  });

  it('filters by collection, roast and origin', async () => {
    const gear = await listProducts({ collection: 'equipment', sort: 'featured' }, db);
    expect(gear.every((i) => i.product.category !== 'coffee')).toBe(true);
    const light = await listProducts({ roast: 'light', sort: 'featured' }, db);
    expect(light.every((i) => i.product.roastLevel === 'light')).toBe(true);
    const kenya = await listProducts({ origin: 'kenya', sort: 'featured' }, db);
    expect(kenya.map((i) => i.product.slug)).toEqual(['kenya-nyeri']);
  });

  it('sorts by price', async () => {
    const asc = await listProducts({ sort: 'price_asc' }, db);
    const prices = asc.map((i) => lowestPriceCents(i.variants));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('loads a product with sorted variants, reviews and collections', async () => {
    const p = await getProductBySlug('morning-frame', db);
    expect(p).not.toBeNull();
    expect(p!.variants.map((v) => v.name)).toEqual(['12 oz', '2 lb', '5 lb']);
    expect(p!.reviews.length).toBeGreaterThan(0);
    expect(p!.collections.map((c) => c.slug)).toEqual(['blends']);
    expect(p!.rating.count).toBe(p!.reviews.length);
    expect(await getProductBySlug('does-not-exist', db)).toBeNull();
  });

  it('finds related products in the same category excluding itself', async () => {
    const p = await getProductBySlug('gooseneck-kettle', db);
    const related = await listRelatedProducts(p!.product, 3, db);
    expect(related).toHaveLength(3);
    expect(related.every((r) => r.product.category !== 'coffee' && r.product.slug !== 'gooseneck-kettle')).toBe(true);
  });

  it('searches names, origins and tasting notes', async () => {
    expect((await searchProducts('ethiopia', db)).map((i) => i.product.slug)).toContain('ethiopia-yirgacheffe');
    expect((await searchProducts('jasmine', db)).map((i) => i.product.slug)).toContain('ethiopia-yirgacheffe');
    expect(await searchProducts('   ', db)).toEqual([]);
    expect(await searchProducts('zzzz-nothing', db)).toEqual([]);
  });

  it('lists collections, origins, featured and recent reviews', async () => {
    expect((await listCollections(db)).map((c) => c.slug)).toEqual(['single-origin', 'blends', 'decaf', 'equipment']);
    expect((await getCollectionBySlug('blends', db))?.name).toBe('Blends');
    expect(await listOrigins(db)).toContain('Kenya');
    expect((await listFeaturedProducts(4, db)).length).toBe(4);
    const recent = await listRecentReviews(5, db);
    expect(recent).toHaveLength(5);
    expect(recent[0].product.slug).toBeTruthy();
  });
});
```

`tests/integration/newsletter.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest';
import { subscribeToNewsletter } from '../../src/lib/db/queries/newsletter';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('subscribeToNewsletter', () => {
  it('creates once and is a no-op on repeat', async () => {
    const email = `test-${Date.now()}@example.com`;
    expect(await subscribeToNewsletter(email, 'test', db)).toEqual({ created: true });
    expect(await subscribeToNewsletter(email.toUpperCase(), 'test', db)).toEqual({ created: false });
  });
});
```

Run: `pnpm test:integration` → PASS.

- [ ] **Step 4: Content modules**

`src/content/brew-guides/index.ts`:
```ts
export interface BrewGuide {
  slug: string;
  title: string;
  summary: string;
  method: string;
  ratio: string;
  grind: string;
  waterTempC: number;
  totalTime: string;
  steps: string[];
  tips: string[];
  recommendedSlugs: string[];
}

export const brewGuides: BrewGuide[] = [
  {
    slug: 'pour-over',
    title: 'Pour Over (V60 / Cofresso Dripper)',
    summary: 'Clean, bright and expressive. The best way to taste what a single origin is doing.',
    method: 'Pour over',
    ratio: '1:16 (22 g coffee to 350 g water)',
    grind: 'Medium-fine, like table salt',
    waterTempC: 94,
    totalTime: '3:00 – 3:30',
    steps: [
      'Rinse the filter with hot water and discard the rinse water.',
      'Add 22 g of coffee and level the bed. Start your timer as you begin pouring.',
      'Bloom with 60 g of water in a spiral. Wait 40 seconds while it degasses.',
      'Pour to 200 g in slow circles by 1:15, keeping the water level steady.',
      'Pour to 350 g by 2:00. Give the dripper a gentle swirl to flatten the bed.',
      'Drawdown should finish between 3:00 and 3:30. Adjust grind finer if faster, coarser if slower.',
    ],
    tips: ['Weigh everything. Ratio drift is the number one cause of inconsistent cups.', 'Ethiopian and Kenyan coffees shine here. Try the Yirgacheffe.'],
    recommendedSlugs: ['ethiopia-yirgacheffe', 'kenya-nyeri', 'costa-rica-tarrazu'],
  },
  {
    slug: 'french-press',
    title: 'French Press',
    summary: 'Full-bodied and forgiving. Great for blends and darker roasts.',
    method: 'Immersion',
    ratio: '1:15 (30 g coffee to 450 g water)',
    grind: 'Coarse, like sea salt',
    waterTempC: 93,
    totalTime: '4:00 + 4:00 settle',
    steps: [
      'Preheat the press with hot water, then discard it.',
      'Add 30 g of coarse coffee and pour 450 g of water over it. Start the timer.',
      'At 4:00, stir the crust gently and scoop off the foam and floating grounds.',
      'Wait another 4 minutes without plunging. Fines settle and the cup gets cleaner.',
      'Press the plunger just below the surface and pour immediately.',
    ],
    tips: ['Skip the hard plunge. Pressing to the bottom stirs up sediment.', 'Morning Frame and Sumatra Mandheling are built for this.'],
    recommendedSlugs: ['morning-frame', 'sumatra-mandheling', 'brazil-cerrado'],
  },
  {
    slug: 'espresso',
    title: 'Espresso',
    summary: 'Concentrated and syrupy. Dial in with a scale and a timer, not vibes.',
    method: 'Pressure',
    ratio: '1:2 (18 g in, 36 g out)',
    grind: 'Fine, like powdered sugar with a little grit',
    waterTempC: 93,
    totalTime: '25 – 32 seconds',
    steps: [
      'Dose 18 g into a clean, dry portafilter basket.',
      'Distribute evenly and tamp level with firm, consistent pressure.',
      'Lock in and start the shot immediately. Aim for first drips around 6 to 8 seconds.',
      'Stop at 36 g of liquid in the cup. Note the time.',
      'Under 25 seconds and sour? Grind finer. Over 32 seconds and bitter? Grind coarser.',
    ],
    tips: ['Change one variable at a time.', 'Dark Mode Espresso is designed for this ratio and will forgive a lot.'],
    recommendedSlugs: ['dark-mode-espresso', 'guatemala-antigua', 'costa-rica-tarrazu'],
  },
  {
    slug: 'cold-brew',
    title: 'Cold Brew',
    summary: 'Low acidity, huge sweetness, and it keeps in the fridge for a week.',
    method: 'Cold immersion',
    ratio: '1:8 concentrate (100 g coffee to 800 g water), dilute 1:1 to serve',
    grind: 'Extra coarse',
    waterTempC: 20,
    totalTime: '16 hours',
    steps: [
      'Combine 100 g of extra-coarse coffee with 800 g of cold filtered water in a jar.',
      'Stir until every ground is wet. Cover.',
      'Steep in the fridge for 14 to 18 hours.',
      'Strain through a paper filter or a fine sieve lined with a filter.',
      'Dilute with equal parts water or milk over ice. Keeps for 7 days refrigerated.',
    ],
    tips: ['Hot Reload is blended specifically for this recipe.', 'Too strong? Dilute more. Too weak? Steep longer next time, not finer.'],
    recommendedSlugs: ['hot-reload-cold-brew', 'brazil-cerrado', 'peru-cajamarca'],
  },
];
```

`src/content/faq.ts`:
```ts
export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  { question: 'When do you roast and ship?', answer: 'We roast Monday through Thursday and ship every order within 48 hours of roasting. Most US orders arrive in 2 to 4 business days.' },
  { question: 'How does Subscribe & Save work?', answer: 'Choose a delivery interval of 2, 4 or 6 weeks on any coffee and save 15% on every bag. You can pause, skip or cancel at any time from the link in your confirmation email.' },
  { question: 'Do you offer free shipping?', answer: 'Yes. Orders over $45 after discounts ship free in the US. Everything else ships for a flat $6.' },
  { question: 'Whole bean or ground?', answer: 'We recommend whole bean for freshness, but we will grind to order for drip, espresso, French press or pour over at no charge.' },
  { question: 'How should I store my coffee?', answer: 'Keep the bag sealed in a cool, dark cupboard. Do not refrigerate. Coffee is best from 5 to 30 days after the roast date printed on the bag.' },
  { question: 'Can I return coffee?', answer: 'If a bag is not right for you, email hello@cofresso.com within 30 days and we will replace it or refund you. Equipment can be returned unused within 30 days.' },
  { question: 'Is this a real store?', answer: 'Cofresso is a fully working demo storefront used by Coframe to test tooling. Orders are simulated and no cards are ever charged.' },
];
```

`src/lib/content/brew-guides.ts`:
```ts
import { brewGuides, type BrewGuide } from '@/content/brew-guides';

export { brewGuides };
export type { BrewGuide };

export function getBrewGuide(slug: string): BrewGuide | undefined {
  return brewGuides.find((g) => g.slug === slug);
}
```

`src/lib/content/faq.ts`:
```ts
export { faqItems, type FaqItem } from '@/content/faq';
```

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add catalog and newsletter queries, filter parsing and content modules"
```

---

### Task 13: Home page and marketing components

**Files:**
- Create: `src/components/marketing/hero.tsx`, `src/components/marketing/collection-grid.tsx`, `src/components/marketing/story.tsx`, `src/components/marketing/brew-guides-teaser.tsx`, `src/components/marketing/reviews-strip.tsx`, `src/components/marketing/newsletter-form.tsx`, `src/components/marketing/value-props.tsx`
- Create: `src/app/(marketing)/page.tsx`, `src/app/(marketing)/actions.ts`
- Delete: `src/app/page.tsx`

**Interfaces:**
- Consumes: catalog queries, `ProductGrid`, `subscribeToNewsletter`, `track`, `siteConfig`.
- Produces: `subscribeNewsletterAction(prev, formData): Promise<ActionResult<{ created: boolean }>>`; `<NewsletterForm source />`.

- [ ] **Step 1: Newsletter action and form**

`src/app/(marketing)/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { subscribeToNewsletter } from '@/lib/db/queries/newsletter';
import { logger } from '@/lib/logger';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  source: z.string().trim().max(40).default('site'),
});

export async function subscribeNewsletterAction(
  _prev: ActionResult<{ created: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ created: boolean }>> {
  const parsed = schema.safeParse({ email: formData.get('email'), source: formData.get('source') ?? 'site' });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
  try {
    return ok(await subscribeToNewsletter(parsed.data.email, parsed.data.source));
  } catch (err) {
    logger.error('newsletter subscribe failed', { err });
    return fail('Something went wrong. Please try again.');
  }
}
```

`src/components/marketing/newsletter-form.tsx`:
```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { subscribeNewsletterAction } from '@/app/(marketing)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics/track';

export function NewsletterForm({ source = 'home' }: { source?: string }) {
  const [state, formAction, pending] = useActionState(subscribeNewsletterAction, null);

  useEffect(() => {
    if (state?.ok) track({ name: 'newsletter_signup', source });
  }, [state, source]);

  if (state?.ok) {
    return (
      <p className="rounded-xl bg-leaf/10 px-4 py-3 text-sm text-leaf" role="status" data-testid="newsletter-success">
        {state.data.created ? 'You are on the list. First roast notes land next week.' : 'You were already on the list. We like your enthusiasm.'}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row" data-testid="newsletter-form">
      <input type="hidden" name="source" value={source} />
      <Input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" className="sm:max-w-xs" />
      <Button type="submit" variant="copper" loading={pending}>
        Get roast notes
      </Button>
      {state && !state.ok ? <p className="text-sm text-red-700 sm:self-center" role="alert">{state.error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 2: Marketing components**

`src/components/marketing/hero.tsx`:
```tsx
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import type { ProductCardData } from '@/lib/catalog/types';

export function Hero({ featured }: { featured: ProductCardData[] }) {
  const [a, b, c] = featured;
  return (
    <section className="relative overflow-hidden bg-espresso text-foam" data-testid="hero">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(200,118,58,0.35),_transparent_55%)]" aria-hidden="true" />
      <Container className="relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-copper">Small-batch specialty coffee</p>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Coffee, <em className="font-light italic text-latte-light">framed</em> right.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-foam/80">
            Roasted to order, shipped within 48 hours, and dialed in for the way you actually brew. Subscribe and save 15% on every bag.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/shop" size="lg" variant="copper" data-testid="hero-cta">
              Shop coffee
            </ButtonLink>
            <ButtonLink href="/brew-guides" size="lg" variant="outline" className="border-foam/40 text-foam hover:bg-foam/10 hover:border-foam">
              Find your brew
            </ButtonLink>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-foam/15 pt-6 text-sm">
            <div><dt className="text-foam/60">Roast to ship</dt><dd className="text-lg font-medium">48 hours</dd></div>
            <div><dt className="text-foam/60">Origins</dt><dd className="text-lg font-medium">9 countries</dd></div>
            <div><dt className="text-foam/60">Free shipping</dt><dd className="text-lg font-medium">over $45</dd></div>
          </dl>
        </div>
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
      </Container>
    </section>
  );
}
```

`src/components/marketing/value-props.tsx`:
```tsx
import { Container } from '@/components/ui/container';
import { IconCheck, IconLeaf, IconTruck } from '@/components/ui/icons';

const props = [
  { icon: IconTruck, title: 'Roasted, then shipped', body: 'Every bag leaves within 48 hours of roasting with the roast date printed on it.' },
  { icon: IconLeaf, title: 'Traceable to the farm', body: 'Producer, altitude and process on every single origin. No mystery blends.' },
  { icon: IconCheck, title: 'Ground to order', body: 'Whole bean, drip, espresso, French press or pour over. Same price.' },
];

export function ValueProps() {
  return (
    <section className="border-b border-latte/20 bg-foam">
      <Container className="grid gap-8 py-10 sm:grid-cols-3">
        {props.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-copper/10 text-copper"><Icon /></span>
            <div>
              <h3 className="font-body text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-latte">{body}</p>
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}
```

`src/components/marketing/collection-grid.tsx`:
```tsx
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/icons';
import type { Collection } from '@/lib/db/schema';

const art: Record<string, string> = {
  'single-origin': 'from-copper/30 to-cream',
  blends: 'from-espresso/30 to-cream',
  decaf: 'from-leaf/30 to-cream',
  equipment: 'from-latte/40 to-cream',
};

export function CollectionGrid({ collections }: { collections: Collection[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="collection-grid">
      {collections.map((c) => (
        <Link
          key={c.id}
          href={`/collections/${c.slug}`}
          className={`group flex min-h-44 flex-col justify-between rounded-2xl bg-gradient-to-br p-6 transition-shadow hover:shadow-lg ${art[c.slug] ?? 'from-latte/30 to-cream'}`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-espresso/60">Collection</span>
          <span>
            <span className="block font-display text-2xl">{c.name}</span>
            <span className="mt-1 block text-sm text-espresso/70">{c.description}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-copper-dark">
              Browse <IconArrowRight width={16} height={16} className="transition-transform group-hover:translate-x-1" />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
```

`src/components/marketing/story.tsx`:
```tsx
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';

export function Story() {
  return (
    <section className="grid items-center gap-10 rounded-3xl bg-espresso p-8 text-foam sm:p-12 lg:grid-cols-2" data-testid="story">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-copper">Our story</p>
        <h2 className="text-3xl sm:text-4xl">We started with a spreadsheet and a popcorn popper.</h2>
        <p className="mt-5 text-foam/80">
          Cofresso began as an engineering team's obsession with getting the office coffee right. We logged every roast, every ratio and
          every brew until the numbers turned into something we were proud to drink. Now we roast for a few thousand people who care as
          much as we do.
        </p>
        <ButtonLink href="/about" variant="outline" className="mt-8 border-foam/40 text-foam hover:border-foam hover:bg-foam/10">
          Read more
        </ButtonLink>
      </div>
      <div className="flex justify-center">
        <Image src="/logo.png" alt="Cofresso double-bean mark" width={260} height={260} className="drop-shadow-2xl" />
      </div>
    </section>
  );
}
```

`src/components/marketing/brew-guides-teaser.tsx`:
```tsx
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/icons';
import { brewGuides } from '@/lib/content/brew-guides';

export function BrewGuidesTeaser() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="brew-guides-teaser">
      {brewGuides.map((g) => (
        <Link key={g.slug} href={`/brew-guides/${g.slug}`} className="group rounded-2xl border border-latte/30 bg-foam p-6 transition-colors hover:border-copper">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-latte">{g.method}</p>
          <h3 className="mt-2 text-xl">{g.title}</h3>
          <p className="mt-2 text-sm text-latte">{g.summary}</p>
          <p className="mt-4 text-sm text-espresso/70">
            {g.ratio.split(' (')[0]} · {g.totalTime}
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-copper-dark">
            Read guide <IconArrowRight width={16} height={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      ))}
    </div>
  );
}
```

`src/components/marketing/reviews-strip.tsx`:
```tsx
import Link from 'next/link';
import { Rating } from '@/components/ui/rating';
import type { RecentReview } from '@/lib/db/queries/catalog';

export function ReviewsStrip({ reviews }: { reviews: RecentReview[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="reviews-strip">
      {reviews.map((r) => (
        <figure key={r.id} className="flex flex-col gap-3 rounded-2xl bg-foam p-6">
          <Rating value={r.rating} />
          <blockquote className="text-sm leading-relaxed">“{r.body}”</blockquote>
          <figcaption className="mt-auto text-xs text-latte">
            {r.authorName}
            {r.verified ? ' · Verified buyer' : ''} · on{' '}
            <Link href={`/products/${r.product.slug}`} className="text-espresso underline-offset-2 hover:underline">
              {r.product.name}
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Home page**

Delete `src/app/page.tsx`, then create `src/app/(marketing)/page.tsx`:
```tsx
import { BrewGuidesTeaser } from '@/components/marketing/brew-guides-teaser';
import { CollectionGrid } from '@/components/marketing/collection-grid';
import { Hero } from '@/components/marketing/hero';
import { NewsletterForm } from '@/components/marketing/newsletter-form';
import { ReviewsStrip } from '@/components/marketing/reviews-strip';
import { Story } from '@/components/marketing/story';
import { ValueProps } from '@/components/marketing/value-props';
import { ProductGrid } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { listCollections, listFeaturedProducts, listRecentReviews } from '@/lib/db/queries/catalog';

export default async function HomePage() {
  const [featured, collections, reviews] = await Promise.all([listFeaturedProducts(4), listCollections(), listRecentReviews(3)]);

  return (
    <>
      <Hero featured={featured} />
      <ValueProps />

      <Container className="py-20">
        <SectionHeading eyebrow="Featured" title="This week on the bar" description="The coffees our roasters keep reaching for." action={<ButtonLink href="/shop" variant="outline">Shop all</ButtonLink>} />
        <ProductGrid items={featured} listId="home_featured" />
      </Container>

      <Container className="pb-20">
        <SectionHeading eyebrow="Collections" title="Find your lane" />
        <CollectionGrid collections={collections} />
      </Container>

      <Container className="pb-20">
        <Story />
      </Container>

      <Container className="pb-20">
        <SectionHeading eyebrow="Brew guides" title="Brew it like we do" description="Ratios, grind sizes and timings for every brewer in the cupboard." />
        <BrewGuidesTeaser />
      </Container>

      <Container className="pb-20">
        <SectionHeading eyebrow="Reviews" title="From the inbox" />
        <ReviewsStrip reviews={reviews} />
      </Container>

      <section id="newsletter" className="bg-copper/10">
        <Container className="grid items-center gap-8 py-16 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Roast notes</p>
            <h2 className="text-3xl sm:text-4xl">New coffees, first.</h2>
            <p className="mt-3 text-latte">One email when a new lot lands. No drip campaigns, pun intended.</p>
          </div>
          <NewsletterForm source="home" />
        </Container>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm dev`, open `http://localhost:3000`. The hero, value props, four featured products, collection cards, story block, brew guides, three reviews and the newsletter section render. Submit the newsletter form with a valid email: success message. Stop the server.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add home page with hero, featured products, collections, story, guides, reviews and newsletter"
```

---

### Task 14: Shop, collection and search pages

**Files:**
- Create: `src/components/product/shop-filters.tsx`, `src/app/(shop)/shop/page.tsx`, `src/app/(shop)/collections/[slug]/page.tsx`, `src/app/(shop)/search/page.tsx`, `src/app/(shop)/search/search-tracker.tsx`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `listProducts`, `listCollections`, `listOrigins`, `getCollectionBySlug`, `searchProducts`, `parseProductFilters`, `ProductGrid`.
- Produces: routes `/shop`, `/collections/[slug]`, `/search`.

- [ ] **Step 1: Filters component (client, URL-driven)**

`src/components/product/shop-filters.tsx`:
```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/select';
import { ROAST_OPTIONS } from '@/lib/catalog/labels';
import type { Collection } from '@/lib/db/schema';
import { filtersToSearchParams, SORT_OPTIONS, type ProductFilters } from '@/lib/shop/filters';

interface ShopFiltersProps {
  filters: ProductFilters;
  collections: Collection[];
  origins: string[];
  resultCount: number;
  lockCollection?: boolean;
}

export function ShopFilters({ filters, collections, origins, resultCount, lockCollection = false }: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const update = (patch: Partial<ProductFilters>) => {
    const next = { ...filters, ...patch } as ProductFilters;
    for (const key of Object.keys(next) as (keyof ProductFilters)[]) if (next[key] === undefined || next[key] === '') delete next[key];
    if (!next.sort) next.sort = 'featured';
    const qs = filtersToSearchParams(next).toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const hasFilters = Boolean(filters.roast || filters.origin || (!lockCollection && filters.collection));

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-foam p-4 sm:flex-row sm:flex-wrap sm:items-end" data-testid="shop-filters" aria-busy={pending}>
      {!lockCollection ? (
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-latte">
          Collection
          <Select value={filters.collection ?? ''} onChange={(e) => update({ collection: e.target.value || undefined })} data-testid="filter-collection">
            <option value="">All</option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-latte">
        Roast
        <Select value={filters.roast ?? ''} onChange={(e) => update({ roast: (e.target.value || undefined) as ProductFilters['roast'] })} data-testid="filter-roast">
          <option value="">Any</option>
          {ROAST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-latte">
        Origin
        <Select value={filters.origin ?? ''} onChange={(e) => update({ origin: e.target.value || undefined })} data-testid="filter-origin">
          <option value="">Any</option>
          {origins.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-latte">
        Sort
        <Select value={filters.sort} onChange={(e) => update({ sort: e.target.value as ProductFilters['sort'] })} data-testid="filter-sort">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </label>
      <div className="flex items-center justify-between gap-4 text-sm text-latte sm:ml-auto">
        <span data-testid="result-count">{resultCount} {resultCount === 1 ? 'product' : 'products'}</span>
        {hasFilters ? (
          <button type="button" className="underline-offset-2 hover:text-espresso hover:underline" onClick={() => update({ roast: undefined, origin: undefined, collection: lockCollection ? filters.collection : undefined })}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Shop page**

`src/app/(shop)/shop/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product/product-grid';
import { ShopFilters } from '@/components/product/shop-filters';
import { Container } from '@/components/ui/container';
import { listCollections, listOrigins, listProducts } from '@/lib/db/queries/catalog';
import { parseProductFilters, type RawSearchParams } from '@/lib/shop/filters';

export const metadata: Metadata = { title: 'Shop', description: 'Single origins, blends, decaf and the gear to brew them.' };

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const filters = parseProductFilters(await searchParams);
  const [items, collections, origins] = await Promise.all([listProducts(filters), listCollections(), listOrigins()]);

  return (
    <Container className="py-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Shop</p>
        <h1 className="text-4xl sm:text-5xl">All coffee &amp; gear</h1>
      </div>
      <ShopFilters filters={filters} collections={collections} origins={origins} resultCount={items.length} />
      <ProductGrid items={items} listId="shop" />
    </Container>
  );
}
```

- [ ] **Step 3: Collection page**

`src/app/(shop)/collections/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product/product-grid';
import { ShopFilters } from '@/components/product/shop-filters';
import { Container } from '@/components/ui/container';
import { getCollectionBySlug, listCollections, listOrigins, listProducts } from '@/lib/db/queries/catalog';
import { parseProductFilters, type RawSearchParams } from '@/lib/shop/filters';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = await getCollectionBySlug((await params).slug);
  return collection ? { title: collection.name, description: collection.description } : { title: 'Collection' };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const filters = { ...parseProductFilters(await searchParams), collection: slug };
  const [items, collections, origins] = await Promise.all([listProducts(filters), listCollections(), listOrigins()]);

  return (
    <Container className="py-12">
      <div className="mb-8 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Collection</p>
        <h1 className="text-4xl sm:text-5xl" data-testid="collection-title">{collection.name}</h1>
        <p className="mt-3 text-latte">{collection.description}</p>
      </div>
      <ShopFilters filters={filters} collections={collections} origins={origins} resultCount={items.length} lockCollection />
      <ProductGrid items={items} listId={`collection_${slug}`} />
    </Container>
  );
}
```

- [ ] **Step 4: Search page**

`src/app/(shop)/search/search-tracker.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function SearchTracker({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    if (query) track({ name: 'search', query, resultCount });
  }, [query, resultCount]);
  return null;
}
```

`src/app/(shop)/search/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { SearchForm } from '@/components/layout/search-form';
import { ProductGrid } from '@/components/product/product-grid';
import { Container } from '@/components/ui/container';
import { searchProducts } from '@/lib/db/queries/catalog';
import { SearchTracker } from './search-tracker';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? '').slice(0, 80);
  const items = query ? await searchProducts(query) : [];

  return (
    <Container className="py-12">
      <div className="mb-8 max-w-xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Search</p>
        <h1 className="text-4xl">{query ? <>Results for “{query}”</> : 'Search the shop'}</h1>
        <SearchForm className="mt-6" defaultValue={query} />
        {query ? <p className="mt-3 text-sm text-latte" data-testid="search-count">{items.length} {items.length === 1 ? 'result' : 'results'}</p> : null}
      </div>
      {query ? <ProductGrid items={items} listId="search" emptyMessage="Nothing matched. Try an origin like “Ethiopia” or a note like “chocolate”." /> : null}
      <SearchTracker query={query} resultCount={items.length} />
    </Container>
  );
}
```

- [ ] **Step 5: Sitemap with catalog routes**

Replace `src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next';
import { brewGuides } from '@/lib/content/brew-guides';
import { listCollections, listProductSlugs } from '@/lib/db/queries/catalog';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().SITE_URL;
  const [products, collections] = await Promise.all([listProductSlugs(), listCollections()]);
  const staticRoutes = ['', '/shop', '/about', '/faq', '/brew-guides', '/orders'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
  return [
    ...staticRoutes,
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.createdAt, changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...brewGuides.map((g) => ({ url: `${base}/brew-guides/${g.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm dev`. `/shop` lists 18 products; changing Roast to Light updates the URL and grid; `/collections/equipment` shows six items and a locked collection filter; `/search?q=ethiopia` shows one result; `/sitemap.xml` includes product URLs. Stop.

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add shop, collection and search pages with URL-driven filters"
```

---

### Task 15: Product detail page

**Files:**
- Create: `src/app/(shop)/products/[slug]/page.tsx`, `src/app/(shop)/products/[slug]/view-item-tracker.tsx`, `src/components/product/product-details.tsx`, `src/components/product/review-list.tsx`

**Interfaces:**
- Consumes: `getProductBySlug`, `listRelatedProducts`, `AddToCartForm`, `ProductGrid`, `Rating`, `Badge`, labels.

- [ ] **Step 1: Details and reviews components**

`src/components/product/product-details.tsx`:
```tsx
import { roastLabel } from '@/lib/catalog/labels';
import type { Product } from '@/lib/db/schema';

export function ProductDetails({ product }: { product: Product }) {
  const rows: Array<[string, string | null | undefined]> = [
    ['Origin', product.origin],
    ['Region', product.region],
    ['Producer', product.producer],
    ['Altitude', product.altitudeM ? `${product.altitudeM.toLocaleString()} m` : null],
    ['Process', product.process],
    ['Roast', roastLabel(product.roastLevel)],
  ];
  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-foam p-6 text-sm sm:grid-cols-3" data-testid="product-details">
      {visible.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-latte">{k}</dt>
          <dd className="mt-0.5 font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
```

`src/components/product/review-list.tsx`:
```tsx
import { Rating } from '@/components/ui/rating';
import type { Review } from '@/lib/db/schema';

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function ReviewList({ reviews, average }: { reviews: Review[]; average: number }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-latte">No reviews yet. Be the first when you get your bag.</p>;
  }
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  return (
    <div className="grid gap-10 lg:grid-cols-[280px_1fr]" data-testid="reviews">
      <div className="rounded-2xl bg-foam p-6">
        <p className="font-display text-5xl">{average.toFixed(1)}</p>
        <Rating value={average} size="md" className="mt-1" />
        <p className="mt-1 text-sm text-latte">Based on {reviews.length} review{reviews.length === 1 ? '' : 's'}</p>
        <ul className="mt-5 flex flex-col gap-1.5">
          {distribution.map(({ star, count }) => (
            <li key={star} className="flex items-center gap-2 text-xs">
              <span className="w-6 tabular-nums">{star}★</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-latte/20">
                <span className="block h-full bg-copper" style={{ width: `${(count / reviews.length) * 100}%` }} />
              </span>
              <span className="w-4 text-right tabular-nums text-latte">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-latte/20">
        {reviews.map((r) => (
          <li key={r.id} className="py-5">
            <div className="flex items-center justify-between gap-3">
              <Rating value={r.rating} />
              <time dateTime={r.createdAt.toISOString()} className="text-xs text-latte">{dateFormat.format(r.createdAt)}</time>
            </div>
            <h3 className="mt-2 font-body text-base font-semibold">{r.title}</h3>
            <p className="mt-1 text-sm leading-relaxed">{r.body}</p>
            <p className="mt-2 text-xs text-latte">
              {r.authorName}
              {r.verified ? ' · Verified buyer' : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Tracker and page**

`src/app/(shop)/products/[slug]/view-item-tracker.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import type { AnalyticsItem } from '@/lib/analytics/events';

export function ViewItemTracker({ item }: { item: AnalyticsItem }) {
  useEffect(() => {
    track({ name: 'view_item', item });
  }, [item]);
  return null;
}
```

`src/app/(shop)/products/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartForm } from '@/components/product/add-to-cart-form';
import { ProductDetails } from '@/components/product/product-details';
import { ProductGrid } from '@/components/product/product-grid';
import { ReviewList } from '@/components/product/review-list';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { Rating } from '@/components/ui/rating';
import { SectionHeading } from '@/components/ui/section-heading';
import { categoryLabel, roastLabel } from '@/lib/catalog/labels';
import { lowestPriceCents } from '@/lib/catalog/types';
import { getProductBySlug, listRelatedProducts } from '@/lib/db/queries/catalog';
import { getServerEnv } from '@/lib/env';
import { ViewItemTracker } from './view-item-tracker';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProductBySlug((await params).slug);
  if (!data) return { title: 'Product not found' };
  return {
    title: data.product.name,
    description: data.product.tagline,
    openGraph: { title: data.product.name, description: data.product.tagline, images: [data.product.imagePath] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product, variants, rating, collections, reviews } = data;
  const related = await listRelatedProducts(product, 4);
  const base = getServerEnv().SITE_URL;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline,
    image: `${base}${product.imagePath}`,
    sku: variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'Cofresso' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: (lowestPriceCents(variants) / 100).toFixed(2),
      highPrice: (Math.max(...variants.map((v) => v.priceCents)) / 100).toFixed(2),
      offerCount: variants.length,
      availability: variants.some((v) => v.stockQuantity > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(rating.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.count } } : {}),
  };

  return (
    <Container className="py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-latte">
        <Link href="/shop" className="hover:text-espresso">Shop</Link>
        {collections[0] ? (
          <>
            <span className="mx-2">/</span>
            <Link href={`/collections/${collections[0].slug}`} className="hover:text-espresso">{collections[0].name}</Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-espresso">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative overflow-hidden rounded-3xl bg-foam">
          <Image src={product.imagePath} alt={product.name} width={600} height={750} unoptimized priority className="h-auto w-full" />
          <div className="absolute left-4 top-4 flex gap-2">
            {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
            {product.featured ? <Badge tone="copper">Staff pick</Badge> : null}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">{product.origin ?? categoryLabel(product.category)}</p>
            <h1 className="text-4xl leading-tight sm:text-5xl" data-testid="product-title">{product.name}</h1>
            <p className="mt-3 text-lg text-latte">{product.tagline}</p>
            {rating.count > 0 ? (
              <a href="#reviews" className="mt-3 inline-flex">
                <Rating value={rating.average} count={rating.count} size="md" />
              </a>
            ) : null}
            {product.tastingNotes.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tasting notes">
                {product.tastingNotes.map((n) => (
                  <li key={n}><Badge tone="neutral" className="capitalize">{n}</Badge></li>
                ))}
              </ul>
            ) : null}
          </div>

          <AddToCartForm product={product} variants={variants} />

          <ProductDetails product={product} />

          <div className="prose prose-sm max-w-none text-espresso/90">
            <p>{product.description}</p>
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-20 scroll-mt-28">
        <SectionHeading eyebrow="Reviews" title="What people are brewing" />
        <ReviewList reviews={reviews} average={rating.average} />
      </section>

      {related.length ? (
        <section className="mt-20">
          <SectionHeading eyebrow="You might also like" title="Pairs well with" />
          <ProductGrid items={related} listId={`related_${product.slug}`} />
        </section>
      ) : null}

      <ViewItemTracker item={{ productId: product.id, slug: product.slug, name: product.name, priceCents: lowestPriceCents(variants) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </Container>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm dev`, open `/products/morning-frame`: image, badges, title, rating, tasting notes, price updates when choosing 2 lb or subscription, Add to cart opens the drawer with the line, details grid, description, reviews, related. `/products/nope` shows the 404 page. Stop.

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add product detail page with add-to-cart, details, reviews, related and JSON-LD"
```

---

### Task 16: Checkout, confirmation and order lookup

**Files:**
- Create: `src/app/(checkout)/checkout/page.tsx`, `src/app/(checkout)/checkout/actions.ts`, `src/app/(checkout)/checkout/success/[orderNumber]/page.tsx`
- Create: `src/components/checkout/checkout-form.tsx`, `src/components/checkout/order-summary.tsx`, `src/components/checkout/order-details.tsx`, `src/components/checkout/track-purchase.tsx`, `src/components/checkout/card-number-input.tsx`
- Create: `src/app/(checkout)/orders/page.tsx`, `src/app/(checkout)/orders/actions.ts`, `src/app/(checkout)/orders/[orderNumber]/page.tsx`
- Modify: `src/lib/checkout/queries.ts` (add `findLookupToken`)

**Interfaces:**
- Consumes: `placeOrder`, `checkoutSchema` + step schemas, `getCartView`, `readCartId`, `getOrderForConfirmation`, `CartSummary`, `TEST_CARDS`.
- Produces: `placeOrderAction(prev, formData): Promise<CheckoutActionState>` where `type CheckoutActionState = { error: string; code?: PlaceOrderFailure; fieldErrors?: FieldErrors } | null`; `lookupOrderAction(prev, formData): Promise<ActionResult>`; `findLookupToken(orderNumber, email, db?): Promise<string | null>`; `<OrderDetails order />`.

- [ ] **Step 1: Add `findLookupToken` to `src/lib/checkout/queries.ts`**

Append:
```ts
export async function findLookupToken(orderNumber: string, email: string, db: Db = getDb()): Promise<string | null> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, normalizeOrderNumber(orderNumber)),
    columns: { email: true, lookupToken: true },
  });
  if (!order || order.email !== email.trim().toLowerCase()) return null;
  return order.lookupToken;
}
```

- [ ] **Step 2: Checkout action**

`src/app/(checkout)/checkout/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import type { FieldErrors } from '@/lib/action-result';
import { readCartId } from '@/lib/cart/cookie';
import { placeOrder, type PlaceOrderFailure } from '@/lib/checkout/place-order';
import { checkoutSchema } from '@/lib/checkout/schemas';

export type CheckoutActionState = { error: string; code?: PlaceOrderFailure; fieldErrors?: FieldErrors } | null;

export async function placeOrderAction(_prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const cartId = await readCartId();
  if (!cartId) return { error: 'Your cart has expired. Add your items again.', code: 'empty_cart' };

  const result = await placeOrder({ cartId, input: parsed.data });
  if (!result.ok) return { error: result.message, code: result.code };

  redirect(`/checkout/success/${result.orderNumber}?t=${result.lookupToken}`);
}
```

- [ ] **Step 3: Card number input and checkout form**

`src/components/checkout/card-number-input.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';

function groupDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function CardNumberInput(props: Omit<InputProps, 'value' | 'onChange'> & { defaultValue?: string }) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="cc-number"
      placeholder="4242 4242 4242 4242"
      value={value}
      onChange={(e) => setValue(groupDigits(e.target.value))}
    />
  );
}
```

`src/components/checkout/checkout-form.tsx`:
```tsx
'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { placeOrderAction, type CheckoutActionState } from '@/app/(checkout)/checkout/actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { track } from '@/lib/analytics/track';
import type { CartView } from '@/lib/cart/types';
import { contactSchema, paymentSchema, shippingSchema } from '@/lib/checkout/schemas';
import { TEST_CARDS } from '@/lib/payments/simulated';
import { cn } from '@/lib/utils';
import { CardNumberInput } from './card-number-input';

type Step = 'contact' | 'shipping' | 'payment' | 'review';
const steps: Step[] = ['contact', 'shipping', 'payment', 'review'];
const titles: Record<Step, string> = { contact: 'Contact', shipping: 'Shipping address', payment: 'Payment', review: 'Review & place order' };

type Errors = Record<string, string[] | undefined>;

export function CheckoutForm({ cart, idempotencyKey }: { cart: CartView; idempotencyKey: string }) {
  const [step, setStep] = useState<Step>('contact');
  const [errors, setErrors] = useState<Errors>({});
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(placeOrderAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.fieldErrors) {
      setErrors(state.fieldErrors);
      const keys = Object.keys(state.fieldErrors);
      if (keys.some((k) => k in contactSchema.shape)) setStep('contact');
      else if (keys.some((k) => k in shippingSchema.shape)) setStep('shipping');
      else setStep('payment');
    } else if (state?.code === 'payment_declined') {
      setStep('payment');
    }
  }, [state]);

  const values = () => Object.fromEntries(new FormData(formRef.current ?? undefined));
  const fieldError = (name: string) => errors[name]?.[0];

  const validate = (current: Step): boolean => {
    const schema = current === 'contact' ? contactSchema : current === 'shipping' ? shippingSchema : current === 'payment' ? paymentSchema : null;
    if (!schema) return true;
    const result = schema.safeParse(values());
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors as Errors);
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validate(step)) return;
    const idx = steps.indexOf(step);
    if (step === 'shipping') track({ name: 'add_shipping_info', valueCents: cart.totals.totalCents });
    if (step === 'payment') track({ name: 'add_payment_info', valueCents: cart.totals.totalCents });
    setStep(steps[Math.min(idx + 1, steps.length - 1)]);
  };

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => y + i);
  }, []);

  const section = (name: Step, children: React.ReactNode) => {
    const idx = steps.indexOf(name);
    const currentIdx = steps.indexOf(step);
    const done = idx < currentIdx;
    return (
      <section className={cn('rounded-2xl border bg-foam p-6', step === name ? 'border-espresso/40' : 'border-latte/30')} data-testid={`step-${name}`} aria-current={step === name ? 'step' : undefined}>
        <header className="flex items-center justify-between">
          <h2 className="flex items-center gap-3 text-xl">
            <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-leaf text-foam' : step === name ? 'bg-espresso text-foam' : 'bg-latte/30 text-espresso')}>{done ? '✓' : idx + 1}</span>
            {titles[name]}
          </h2>
          {done ? (
            <button type="button" className="text-sm text-latte underline-offset-2 hover:underline" onClick={() => setStep(name)}>Edit</button>
          ) : null}
        </header>
        {/* Inputs stay mounted (hidden) so one form submission carries every field. */}
        <div className={cn('mt-5 flex flex-col gap-4', step !== name && 'hidden')}>{children}</div>
      </section>
    );
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" data-testid="checkout-form" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {section(
        'contact',
        <>
          <Field label="Email" htmlFor="email" error={fieldError('email')} hint="Order confirmation goes here.">
            <Input id="email" name="email" type="email" autoComplete="email" invalid={Boolean(fieldError('email'))} />
          </Field>
          <Button type="button" onClick={next} className="self-start" data-testid="continue-contact">Continue to shipping</Button>
        </>,
      )}

      {section(
        'shipping',
        <>
          <Field label="Full name" htmlFor="shippingName" error={fieldError('shippingName')}>
            <Input id="shippingName" name="shippingName" autoComplete="name" invalid={Boolean(fieldError('shippingName'))} />
          </Field>
          <Field label="Address" htmlFor="address1" error={fieldError('address1')}>
            <Input id="address1" name="address1" autoComplete="address-line1" invalid={Boolean(fieldError('address1'))} />
          </Field>
          <Field label="Apartment, suite, etc. (optional)" htmlFor="address2" error={fieldError('address2')}>
            <Input id="address2" name="address2" autoComplete="address-line2" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" htmlFor="city" error={fieldError('city')}>
              <Input id="city" name="city" autoComplete="address-level2" invalid={Boolean(fieldError('city'))} />
            </Field>
            <Field label="State" htmlFor="state" error={fieldError('state')}>
              <Input id="state" name="state" autoComplete="address-level1" invalid={Boolean(fieldError('state'))} />
            </Field>
            <Field label="ZIP / Postal code" htmlFor="postalCode" error={fieldError('postalCode')}>
              <Input id="postalCode" name="postalCode" autoComplete="postal-code" invalid={Boolean(fieldError('postalCode'))} />
            </Field>
          </div>
          <Field label="Country" htmlFor="country" error={fieldError('country')}>
            <Select id="country" name="country" defaultValue="US" autoComplete="country">
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </Select>
          </Field>
          <Button type="button" onClick={next} className="self-start" data-testid="continue-shipping">Continue to payment</Button>
        </>,
      )}

      {section(
        'payment',
        <>
          <div className="rounded-xl bg-cream px-4 py-3 text-xs text-espresso/80" data-testid="demo-notice">
            <strong>Demo store.</strong> No real charges. Use <code className="rounded bg-foam px-1">4242 4242 4242 4242</code> to succeed or{' '}
            <code className="rounded bg-foam px-1">{TEST_CARDS.declined.replace(/(\d{4})(?=\d)/g, '$1 ')}</code> to see a decline.
          </div>
          <Field label="Card number" htmlFor="cardNumber" error={fieldError('cardNumber')}>
            <CardNumberInput id="cardNumber" name="cardNumber" invalid={Boolean(fieldError('cardNumber'))} />
          </Field>
          <Field label="Name on card" htmlFor="cardName" error={fieldError('cardName')}>
            <Input id="cardName" name="cardName" autoComplete="cc-name" invalid={Boolean(fieldError('cardName'))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Expiry month" htmlFor="expMonth" error={fieldError('expMonth')}>
              <Select id="expMonth" name="expMonth" defaultValue="12" autoComplete="cc-exp-month">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </Select>
            </Field>
            <Field label="Expiry year" htmlFor="expYear" error={fieldError('expYear')}>
              <Select id="expYear" name="expYear" defaultValue={String(years[3])} autoComplete="cc-exp-year">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="CVC" htmlFor="cvc" error={fieldError('cvc')}>
              <Input id="cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" maxLength={4} invalid={Boolean(fieldError('cvc'))} />
            </Field>
          </div>
          <Button type="button" onClick={next} className="self-start" data-testid="continue-payment">Review order</Button>
        </>,
      )}

      {section(
        'review',
        <>
          <p className="text-sm text-latte">Double-check the summary on the right. Placing the order authorizes the simulated payment.</p>
          <Button type="submit" size="lg" variant="copper" loading={pending} className="self-start" data-testid="place-order">
            Place order
          </Button>
        </>,
      )}

      {state?.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="checkout-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Order summary, order details, purchase tracker**

`src/components/checkout/order-summary.tsx`:
```tsx
import Image from 'next/image';
import { CartSummary } from '@/components/cart/cart-summary';
import type { CartView } from '@/lib/cart/types';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import { formatPrice } from '@/lib/pricing';

export function OrderSummary({ cart }: { cart: CartView }) {
  return (
    <aside className="rounded-2xl bg-foam p-6 shadow-sm lg:sticky lg:top-28" data-testid="order-summary">
      <h2 className="text-xl">Order summary</h2>
      <ul className="mt-4 divide-y divide-latte/20">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 py-3">
            <span className="relative shrink-0 overflow-hidden rounded-lg bg-cream">
              <Image src={line.product.imagePath} alt="" width={56} height={70} unoptimized className="h-auto w-14" />
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-espresso text-[10px] font-semibold text-foam">{line.quantity}</span>
            </span>
            <span className="flex-1 text-sm">
              <span className="block font-medium">{line.product.name}</span>
              <span className="block text-xs text-latte">{[line.variant.name, grindLabel(line.grind), purchaseTypeLabel(line.purchaseType, line.subscriptionIntervalWeeks)].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="text-sm tabular-nums">{formatPrice(line.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-latte/20 pt-4">
        <CartSummary totals={cart.totals} discountCode={cart.discountCode} />
      </div>
    </aside>
  );
}
```

`src/components/checkout/order-details.tsx`:
```tsx
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import type { OrderView } from '@/lib/checkout/queries';
import { formatPrice } from '@/lib/pricing';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' });

export function OrderDetails({ order }: { order: OrderView }) {
  const t = order.totals;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]" data-testid="order-details">
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl bg-foam p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-latte">Order number</p>
              <p className="font-display text-3xl" data-testid="order-number">{order.orderNumber}</p>
            </div>
            <Badge tone={order.status === 'paid' ? 'leaf' : 'neutral'} className="capitalize">{order.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-latte">Placed {dateFormat.format(order.createdAt)} · Confirmation sent to {order.email}</p>
        </div>

        <ul className="divide-y divide-latte/20 rounded-2xl bg-foam px-6">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <Image src={item.imagePath} alt="" width={64} height={80} unoptimized className="h-auto w-16 rounded-lg bg-cream" />
              <div className="flex-1 text-sm">
                <Link href={`/products/${item.productSlug}`} className="font-medium hover:text-copper">{item.productName}</Link>
                <p className="text-xs text-latte">{[item.variantName, grindLabel(item.grind), purchaseTypeLabel(item.purchaseType, item.subscriptionIntervalWeeks)].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-latte">Qty {item.quantity} × {formatPrice(item.unitPriceCents)}</p>
              </div>
              <p className="text-sm tabular-nums">{formatPrice(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl bg-foam p-6">
          <h2 className="text-lg">Ship to</h2>
          <address className="mt-2 text-sm not-italic leading-relaxed">
            {order.shipping.name}<br />
            {order.shipping.address1}<br />
            {order.shipping.address2 ? <>{order.shipping.address2}<br /></> : null}
            {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}<br />
            {order.shipping.country}
          </address>
        </div>
        <div className="rounded-2xl bg-foam p-6">
          <h2 className="text-lg">Payment</h2>
          <p className="mt-2 text-sm">{order.cardLast4 ? `Card ending in ${order.cardLast4}` : 'Simulated payment'}</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatPrice(t.subtotalCents)}</dd></div>
            {t.discountCents > 0 ? <div className="flex justify-between text-leaf"><dt>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt><dd className="tabular-nums">−{formatPrice(t.discountCents)}</dd></div> : null}
            <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">{t.shippingCents === 0 ? 'Free' : formatPrice(t.shippingCents)}</dd></div>
            <div className="flex justify-between"><dt>Tax</dt><dd className="tabular-nums">{formatPrice(t.taxCents)}</dd></div>
            <div className="flex justify-between border-t border-latte/30 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums" data-testid="order-total">{formatPrice(t.totalCents)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
```

`src/components/checkout/track-purchase.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import type { OrderView } from '@/lib/checkout/queries';

export function TrackPurchase({ order }: { order: OrderView }) {
  useEffect(() => {
    const key = `cofresso:purchase:${order.orderNumber}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    track({
      name: 'purchase',
      orderNumber: order.orderNumber,
      valueCents: order.totals.totalCents,
      discountCode: order.discountCode,
      items: order.items.map((i) => ({
        productId: i.productId ?? i.productSlug,
        slug: i.productSlug,
        name: i.productName,
        variantId: i.variantId ?? undefined,
        variantName: i.variantName,
        priceCents: i.unitPriceCents,
        quantity: i.quantity,
        purchaseType: i.purchaseType,
      })),
    });
  }, [order]);
  return null;
}
```

- [ ] **Step 5: Checkout page and success page**

`src/app/(checkout)/checkout/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { OrderSummary } from '@/components/checkout/order-summary';
import { Container } from '@/components/ui/container';
import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  if (!cart || cart.lines.length === 0) redirect('/cart');

  return (
    <Container className="py-12">
      <h1 className="mb-8 text-4xl">Checkout</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <CheckoutForm cart={cart} idempotencyKey={randomUUID()} />
        <OrderSummary cart={cart} />
      </div>
    </Container>
  );
}
```

`src/app/(checkout)/checkout/success/[orderNumber]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderDetails } from '@/components/checkout/order-details';
import { TrackPurchase } from '@/components/checkout/track-purchase';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getOrderForConfirmation } from '@/lib/checkout/queries';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

export default async function SuccessPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderForConfirmation(orderNumber, t ?? '');
  if (!order) notFound();

  return (
    <Container className="py-12">
      <div className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-leaf">Order confirmed</p>
        <h1 className="text-4xl sm:text-5xl" data-testid="success-title">Thank you, {order.shipping.name.split(' ')[0]}.</h1>
        <p className="mt-3 text-latte">
          We roast your coffee next and ship within 48 hours. Keep this link to check on your order any time, or look it up with your order number and email.
        </p>
        <div className="mt-6 flex gap-3">
          <ButtonLink href="/shop">Continue shopping</ButtonLink>
          <ButtonLink href="/brew-guides" variant="outline">Brew guides</ButtonLink>
        </div>
      </div>
      <OrderDetails order={order} />
      <TrackPurchase order={order} />
    </Container>
  );
}
```

- [ ] **Step 6: Order lookup**

`src/app/(checkout)/orders/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { isOrderNumber, normalizeOrderNumber } from '@/lib/checkout/order-number';
import { findLookupToken } from '@/lib/checkout/queries';

const schema = z.object({
  orderNumber: z.string().trim().refine(isOrderNumber, 'Order numbers look like CF-10001.'),
  email: z.string().trim().toLowerCase().email('Enter the email used at checkout.'),
});

export async function lookupOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ orderNumber: formData.get('orderNumber'), email: formData.get('email') });
  if (!parsed.success) return fail('Check the order number and email.', parsed.error.flatten().fieldErrors);
  const token = await findLookupToken(parsed.data.orderNumber, parsed.data.email);
  if (!token) return fail('We could not find an order with that number and email.');
  redirect(`/orders/${normalizeOrderNumber(parsed.data.orderNumber)}?t=${token}`);
}
```

`src/app/(checkout)/orders/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { LookupForm } from './lookup-form';

export const metadata: Metadata = { title: 'Track an order' };

export default function OrdersPage() {
  return (
    <Container className="py-12">
      <div className="max-w-md">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Orders</p>
        <h1 className="text-4xl">Track an order</h1>
        <p className="mt-3 text-latte">Enter your order number and the email you used at checkout.</p>
        <LookupForm />
      </div>
    </Container>
  );
}
```

`src/app/(checkout)/orders/lookup-form.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { lookupOrderAction } from './actions';

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookupOrderAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4" data-testid="lookup-form">
      <Field label="Order number" htmlFor="orderNumber" error={errors.orderNumber}>
        <Input id="orderNumber" name="orderNumber" placeholder="CF-10001" autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Button type="submit" loading={pending} className="self-start">Find my order</Button>
      {state && !state.ok ? <p role="alert" className="text-sm text-red-700" data-testid="lookup-error">{state.error}</p> : null}
    </form>
  );
}
```

`src/app/(checkout)/orders/[orderNumber]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderDetails } from '@/components/checkout/order-details';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getOrderForConfirmation } from '@/lib/checkout/queries';

export const metadata: Metadata = { title: 'Order details', robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderForConfirmation(orderNumber, t ?? '');
  if (!order) notFound();
  return (
    <Container className="py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-copper">Orders</p>
          <h1 className="text-4xl">Your order</h1>
        </div>
        <ButtonLink href="/orders" variant="outline">Look up another</ButtonLink>
      </div>
      <OrderDetails order={order} />
    </Container>
  );
}
```

- [ ] **Step 7: Verify in the browser**

Run: `pnpm dev`. Add Morning Frame to the cart, apply `WELCOME10`, go to checkout. Contact → shipping → payment with `4242 4242 4242 4242` → review → Place order lands on the success page with an order number, the header cart count is 0. Repeat with `4000 0000 0000 0002`: an error appears and the payment step is shown. Look up the order on `/orders` with the number and email. Stop.

- [ ] **Step 8: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add checkout flow, order confirmation and guest order lookup"
```

---

### Task 17: Content pages: about, FAQ, brew guides

**Files:**
- Create: `src/app/(marketing)/about/page.tsx`, `src/app/(marketing)/faq/page.tsx`, `src/app/(marketing)/brew-guides/page.tsx`, `src/app/(marketing)/brew-guides/[slug]/page.tsx`

**Interfaces:**
- Consumes: `brewGuides`, `getBrewGuide`, `faqItems`, `listProducts` (for recommended coffees), `ProductGrid`, `Container`, `SectionHeading`, `NewsletterForm`.

- [ ] **Step 1: About**

`src/app/(marketing)/about/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Image from 'next/image';
import { NewsletterForm } from '@/components/marketing/newsletter-form';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = { title: 'Our story', description: 'How an engineering team’s coffee obsession became Cofresso.' };

export default function AboutPage() {
  return (
    <Container className="py-16">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-copper">Our story</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Precision is a form of care.</h1>
          <div className="mt-6 flex flex-col gap-4 text-lg text-espresso/85">
            <p>
              Cofresso started in 2021 as a spreadsheet. A few engineers at a software company were tired of bad office coffee and decided to
              treat it like any other system: measure everything, change one variable at a time, keep what works.
            </p>
            <p>
              Two years and one very tired popcorn popper later we bought a real roaster, moved into a small unit on the edge of town and
              started shipping bags to friends. The spreadsheet is still around. It now has 4,000 rows.
            </p>
            <p>
              We buy coffee from producers we can name, roast in batches small enough to taste every one, and ship within 48 hours. If a bag is
              not right, we replace it. That is the whole business model.
            </p>
          </div>
          <div className="mt-8 flex gap-3">
            <ButtonLink href="/shop">Shop the coffee</ButtonLink>
            <ButtonLink href="/brew-guides" variant="outline">How we brew</ButtonLink>
          </div>
        </div>
        <div className="flex justify-center rounded-3xl bg-espresso p-12">
          <Image src="/logo.png" alt="Cofresso double-bean mark" width={320} height={320} className="drop-shadow-2xl" />
        </div>
      </div>

      <section className="mt-24 grid gap-6 sm:grid-cols-3">
        {[
          ['9', 'origin countries in the current lineup'],
          ['48h', 'from roaster to shipping label'],
          ['4,000+', 'logged brews in the spreadsheet'],
        ].map(([n, label]) => (
          <div key={label} className="rounded-2xl bg-foam p-8">
            <p className="font-display text-5xl">{n}</p>
            <p className="mt-2 text-sm text-latte">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 rounded-3xl bg-copper/10 p-8 sm:p-12">
        <h2 className="text-3xl">Get roast notes</h2>
        <p className="mt-2 text-latte">One email when a new lot lands.</p>
        <div className="mt-6 max-w-lg">
          <NewsletterForm source="about" />
        </div>
      </section>
    </Container>
  );
}
```

- [ ] **Step 2: FAQ**

`src/app/(marketing)/faq/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { faqItems } from '@/lib/content/faq';

export const metadata: Metadata = { title: 'FAQ', description: 'Shipping, subscriptions, grind and storage questions answered.' };

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-copper">Help</p>
        <h1 className="text-4xl sm:text-5xl">Frequently asked questions</h1>
        <div className="mt-10 divide-y divide-latte/30 rounded-2xl bg-foam px-6" data-testid="faq">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {item.question}
                <span className="text-latte transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-espresso/85">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </Container>
  );
}
```

- [ ] **Step 3: Brew guides index and detail**

`src/app/(marketing)/brew-guides/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { BrewGuidesTeaser } from '@/components/marketing/brew-guides-teaser';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = { title: 'Brew guides', description: 'Ratios, grind sizes and timings for pour over, French press, espresso and cold brew.' };

export default function BrewGuidesPage() {
  return (
    <Container className="py-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-copper">Brew guides</p>
        <h1 className="text-4xl sm:text-5xl">Brew it like we do</h1>
        <p className="mt-3 text-latte">Every recipe below is the one we use on our own bar. Weigh your coffee, weigh your water, and adjust one thing at a time.</p>
      </div>
      <BrewGuidesTeaser />
    </Container>
  );
}
```

`src/app/(marketing)/brew-guides/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product/product-grid';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { brewGuides, getBrewGuide } from '@/lib/content/brew-guides';
import { listProducts } from '@/lib/db/queries/catalog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getBrewGuide((await params).slug);
  return guide ? { title: guide.title, description: guide.summary } : { title: 'Brew guide' };
}

export default async function BrewGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getBrewGuide(slug);
  if (!guide) notFound();

  const all = await listProducts({ category: 'coffee', sort: 'featured' });
  const recommended = guide.recommendedSlugs.map((s) => all.find((p) => p.product.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <Container className="py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-latte">
        <Link href="/brew-guides" className="hover:text-espresso">Brew guides</Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">{guide.title}</span>
      </nav>
      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <article>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-copper">{guide.method}</p>
          <h1 className="text-4xl sm:text-5xl" data-testid="guide-title">{guide.title}</h1>
          <p className="mt-4 text-lg text-latte">{guide.summary}</p>
          <ol className="mt-10 flex flex-col gap-5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-espresso text-sm font-semibold text-foam">{i + 1}</span>
                <p className="pt-1 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 rounded-2xl bg-copper/10 p-6">
            <h2 className="font-body text-sm font-semibold uppercase tracking-wide text-copper-dark">Tips from the bar</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              {guide.tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </article>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <dl className="rounded-2xl bg-foam p-6 text-sm">
            {[
              ['Ratio', guide.ratio],
              ['Grind', guide.grind],
              ['Water', `${guide.waterTempC}°C`],
              ['Time', guide.totalTime],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-latte/20 py-3 last:border-0">
                <dt className="text-latte">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col gap-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-latte">Other guides</p>
            {brewGuides.filter((g) => g.slug !== guide.slug).map((g) => (
              <Link key={g.slug} href={`/brew-guides/${g.slug}`} className="py-1 hover:text-copper">{g.title}</Link>
            ))}
          </div>
        </aside>
      </div>
      {recommended.length ? (
        <section className="mt-20">
          <SectionHeading eyebrow="Recommended" title={`Coffees we brew as ${guide.method.toLowerCase()}`} />
          <ProductGrid items={recommended} listId={`guide_${guide.slug}`} />
        </section>
      ) : null}
    </Container>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm dev`; check `/about`, `/faq` (details expand), `/brew-guides`, `/brew-guides/pour-over` (steps, sidebar, three recommended coffees), `/brew-guides/nope` → 404. Stop.

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: add about, FAQ and brew guide pages"
```

---

### Task 18: Error boundaries, not-found, loading states and database-aware health check

**Files:**
- Create: `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/(shop)/shop/loading.tsx`, `src/app/(shop)/products/[slug]/loading.tsx`, `src/app/(marketing)/loading.tsx`
- Modify: `src/app/api/health/route.ts`
- Test: `tests/integration/health.test.ts`

- [ ] **Step 1: Boundaries**

`src/app/error.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="flex flex-col items-center gap-4 py-32 text-center">
      <p className="text-5xl">☕</p>
      <h1 className="text-4xl">Something spilled.</h1>
      <p className="max-w-md text-latte">We hit an unexpected error. Try again, or head back to the shop while we mop up.</p>
      {error.digest ? <p className="text-xs text-latte">Reference: {error.digest}</p> : null}
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/shop" variant="outline">Back to shop</ButtonLink>
      </div>
    </Container>
  );
}
```

`src/app/not-found.tsx`:
```tsx
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-32 text-center" data-testid="not-found">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-copper">404</p>
      <h1 className="text-4xl sm:text-5xl">That page has been decaffeinated.</h1>
      <p className="max-w-md text-latte">We could not find what you were looking for. It may have sold out, moved, or never existed.</p>
      <div className="mt-4 flex gap-3">
        <ButtonLink href="/shop">Shop coffee</ButtonLink>
        <ButtonLink href="/" variant="outline">Home</ButtonLink>
      </div>
    </Container>
  );
}
```

`src/app/(shop)/shop/loading.tsx`:
```tsx
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopLoading() {
  return (
    <Container className="py-12">
      <Skeleton className="mb-3 h-4 w-16" />
      <Skeleton className="mb-8 h-12 w-72" />
      <Skeleton className="mb-8 h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
```

`src/app/(shop)/products/[slug]/loading.tsx`:
```tsx
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductLoading() {
  return (
    <Container className="py-10">
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </Container>
  );
}
```

`src/app/(marketing)/loading.tsx`:
```tsx
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function MarketingLoading() {
  return (
    <Container className="py-16">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-6 h-14 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
    </Container>
  );
}
```

- [ ] **Step 2: Health check with DB probe**

Replace `src/app/api/health/route.ts`:
```ts
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';
import { getDb } from '@/lib/db/client';
import { logger, traceFields } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function checkDatabase(timeoutMs = 2000): Promise<'up' | 'down'> {
  const timer = new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), timeoutMs));
  const probe = getDb()
    .execute(sql`select 1`)
    .then(() => 'up' as const)
    .catch(() => 'down' as const);
  return Promise.race([probe, timer]);
}

export async function GET(request: Request) {
  const db = await checkDatabase();
  const body = {
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    version: pkg.version,
    commit: process.env.GIT_SHA ?? 'dev',
    timestamp: new Date().toISOString(),
  };
  if (db !== 'up') logger.warn('health check degraded', { ...body, ...traceFields(request.headers) });
  return NextResponse.json(body, { status: db === 'up' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
```

Confirm `tsconfig.json` has `"resolveJsonModule": true` (create-next-app sets it).

`tests/integration/health.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import './helpers';
import { GET } from '../../src/app/api/health/route';

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', db: 'up' });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

Run: `pnpm test:integration` → PASS.

- [ ] **Step 3: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat: add error, not-found and loading boundaries and a db-aware health check"
```

---

### Task 19: Playwright end-to-end suite

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/shop.spec.ts`, `tests/e2e/product-cart.spec.ts`, `tests/e2e/checkout.spec.ts`, `tests/e2e/misc.spec.ts`

- [ ] **Step 1: Install and configure**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: process.env.PLAYWRIGHT_BASE_URL ? undefined : './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { DATABASE_URL: TEST_DATABASE_URL, SITE_URL: baseURL, NODE_ENV: 'production' },
      },
});
```

`tests/e2e/global-setup.ts`:
```ts
import setupDatabase from '../integration/global-setup';

export default async function globalSetup() {
  await setupDatabase();
}
```

`tests/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test';

export async function addToCart(page: Page, slug: string, options: { size?: string; subscription?: boolean } = {}) {
  await page.goto(`/products/${slug}`);
  if (options.size) await page.getByRole('radio', { name: new RegExp(options.size) }).click();
  if (options.subscription) await page.getByRole('radio', { name: /subscribe/i }).click();
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  await expect(page.getByTestId('cart-drawer').getByTestId('cart-line').first()).toBeVisible();
}

export async function closeDrawer(page: Page) {
  await page.getByTestId('cart-drawer').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('cart-drawer')).toBeHidden();
}

export const TEST_CARD_OK = '4242 4242 4242 4242';
export const TEST_CARD_DECLINED = '4000 0000 0000 0002';
```

- [ ] **Step 2: Specs**

`tests/e2e/home.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.describe('home', () => {
  test('renders hero, featured products and navigates to the shop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('hero')).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(4);
    await expect(page.getByTestId('collection-grid').getByRole('link')).toHaveCount(4);
    await page.getByTestId('hero-cta').click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('footer carries the easter egg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('easter-egg-link')).toHaveAttribute('href', 'https://github.com/coframe/coffee');
  });

  test('newsletter signup succeeds', async ({ page }) => {
    await page.goto('/');
    const form = page.getByTestId('newsletter-form');
    await form.getByRole('textbox').fill(`e2e-${Date.now()}@example.com`);
    await form.getByRole('button').click();
    await expect(page.getByTestId('newsletter-success')).toBeVisible();
  });
});
```

`tests/e2e/shop.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.describe('shop', () => {
  test('filters by roast and sorts by price', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByTestId('product-card')).toHaveCount(18);
    await page.getByTestId('filter-roast').selectOption('light');
    await expect(page).toHaveURL(/roast=light/);
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('3 products');
    for (const card of await cards.all()) await expect(card).toContainText('Light roast');

    await page.getByTestId('filter-roast').selectOption('');
    await page.getByTestId('filter-sort').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByTestId('product-card').first()).toHaveAttribute('data-slug', 'paper-filters');
  });

  test('collection pages and search work', async ({ page }) => {
    await page.goto('/collections/equipment');
    await expect(page.getByTestId('collection-title')).toHaveText('Equipment');
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.goto('/search?q=ethiopia');
    await expect(page.getByTestId('search-count')).toContainText('1 result');
    await expect(page.getByTestId('product-card')).toHaveAttribute('data-slug', 'ethiopia-yirgacheffe');

    await page.goto('/search?q=zzzz');
    await expect(page.getByTestId('empty-grid')).toBeVisible();
  });
});
```

`tests/e2e/product-cart.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { addToCart, closeDrawer } from './helpers';

test.describe('product and cart', () => {
  test('variant and subscription change the price, add to cart opens the drawer', async ({ page }) => {
    await page.goto('/products/morning-frame');
    await expect(page.getByTestId('product-title')).toHaveText('Morning Frame');
    await expect(page.getByTestId('selected-price')).toHaveText('$18.00');
    await page.getByRole('radio', { name: /2 lb/ }).click();
    await expect(page.getByTestId('selected-price')).toHaveText('$44.10');
    await page.getByRole('radio', { name: /subscribe/i }).click();
    await expect(page.getByTestId('selected-price')).toHaveText('$37.49');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await expect(page.getByTestId('cart-drawer').getByTestId('cart-line')).toContainText('Subscription');
  });

  test('promo codes and the free shipping bar', async ({ page }) => {
    await addToCart(page, 'cofresso-mug');
    await closeDrawer(page);
    await page.goto('/cart');
    await expect(page.getByTestId('free-shipping-bar')).toHaveAttribute('data-unlocked', 'false');
    await expect(page.getByTestId('summary-shipping')).toHaveText('$6.00');

    await page.getByTestId('promo-form').getByRole('textbox').fill('welcome10');
    await page.getByTestId('promo-form').getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('promo-applied')).toContainText('WELCOME10');
    await expect(page.getByTestId('summary-discount')).toHaveText('−$2.40');

    await addToCart(page, 'gooseneck-kettle');
    await closeDrawer(page);
    await page.goto('/cart');
    await expect(page.getByTestId('free-shipping-bar')).toHaveAttribute('data-unlocked', 'true');
    await expect(page.getByTestId('summary-shipping')).toHaveText('Free');

    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(2);
    await lines.first().getByRole('button', { name: 'Remove' }).click();
    await expect(lines).toHaveCount(1);
    await lines.first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('empty-cart')).toBeVisible();
  });
});
```

`tests/e2e/checkout.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';
import { addToCart, closeDrawer, TEST_CARD_DECLINED, TEST_CARD_OK } from './helpers';

async function fillCheckout(page: Page, card: string, email: string) {
  await page.goto('/checkout');
  await page.getByLabel('Email').fill(email);
  await page.getByTestId('continue-contact').click();
  await page.getByLabel('Full name').fill('Ada Lovelace');
  await page.getByLabel('Address', { exact: true }).fill('1 Analytical Way');
  await page.getByLabel('City').fill('San Francisco');
  await page.getByLabel('State').fill('CA');
  await page.getByLabel('ZIP / Postal code').fill('94110');
  await page.getByTestId('continue-shipping').click();
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Name on card').fill('Ada Lovelace');
  await page.getByLabel('CVC').fill('123');
  await page.getByTestId('continue-payment').click();
  await page.getByTestId('place-order').click();
}

test.describe('checkout', () => {
  test('redirects an empty cart back to the cart page', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/cart$/);
  });

  test('places an order and can look it up', async ({ page }) => {
    const email = `buyer-${Date.now()}@example.com`;
    await addToCart(page, 'brew-scale');
    await closeDrawer(page);
    await fillCheckout(page, TEST_CARD_OK, email);

    await expect(page).toHaveURL(/\/checkout\/success\/CF-\d+\?t=/);
    await expect(page.getByTestId('success-title')).toContainText('Ada');
    const orderNumber = (await page.getByTestId('order-number').textContent())!.trim();
    expect(orderNumber).toMatch(/^CF-\d{5,}$/);
    await expect(page.getByTestId('order-total')).toHaveText('$48.60');
    await expect(page.getByTestId('cart-count')).toHaveCount(0);

    await page.goto('/orders');
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Find my order' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderNumber}\\?t=`));
    await expect(page.getByTestId('order-number')).toHaveText(orderNumber);

    await page.goto('/orders');
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByRole('button', { name: 'Find my order' }).click();
    await expect(page.getByTestId('lookup-error')).toBeVisible();
  });

  test('shows a decline and keeps the cart', async ({ page }) => {
    await addToCart(page, 'paper-filters');
    await closeDrawer(page);
    await fillCheckout(page, TEST_CARD_DECLINED, `decline-${Date.now()}@example.com`);
    await expect(page.getByTestId('checkout-error')).toContainText('declined');
    await expect(page.getByTestId('step-payment')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });
});
```

The `$48.60` total is Brew Scale $45.00 → free shipping (threshold met) → tax 8% = $3.60.

`tests/e2e/misc.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.describe('misc', () => {
  test('404 page', async ({ page }) => {
    const res = await page.goto('/products/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('/coffee redirects to the open-source beans', async ({ request }) => {
    const res = await request.get('/coffee', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('https://github.com/coframe/coffee');
  });

  test('health, robots, sitemap and humans.txt', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', db: 'up' });

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('sitemap.xml');

    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/products/morning-frame');

    const humans = await request.get('/humans.txt');
    expect(await humans.text()).toContain('github.com/coframe/coffee');
  });
});
```

- [ ] **Step 3: Run the suite**

```bash
pnpm build
pnpm test:e2e
```
Expected: all specs pass. Fix any selector mismatches in the components (prefer adding `data-testid`s over loosening assertions).

- [ ] **Step 4: Commit**

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "test: add Playwright end-to-end suite covering browse, cart, checkout and misc routes"
```

---

### Task 20: Docker image

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22
ARG PNPM_VERSION=10

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm build:db

FROM node:${NODE_VERSION}-alpine AS runner
ARG GIT_SHA=dev
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    GIT_SHA=${GIT_SHA}
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 8080
CMD ["node", "server.js"]
```

Replace `PNPM_VERSION=10` with the major.minor.patch from `package.json`'s `packageManager`.

`.dockerignore`:
```
.git
.github
.next
node_modules
coverage
playwright-report
test-results
dist
docs
infra
tests
.env
.env.*
*.md
.DS_Store
```

- [ ] **Step 2: Build and run locally**

```bash
docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t cofresso-web:local .
docker run --rm -e DATABASE_URL=postgres://cofresso:cofresso@host.docker.internal:5432/cofresso cofresso-web:local node dist/db.mjs migrate
docker run --rm -d --name cofresso-local -p 8080:8080 -e DATABASE_URL=postgres://cofresso:cofresso@host.docker.internal:5432/cofresso -e SITE_URL=http://localhost:8080 cofresso-web:local
sleep 3; curl -s localhost:8080/api/health; curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/products/morning-frame
docker stop cofresso-local
```
Expected: health `status: ok, db: up, commit: <sha>`; product page 200. Image size under 300 MB (`docker images cofresso-web:local`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "build: add multi-stage Dockerfile with bundled db CLI"
```

---

### Task 21: Repository documentation

**Files:**
- Create: `README.md` (replace), `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/architecture.md`

- [ ] **Step 1: README**

```markdown
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

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `lint:fix` / `format` | ESLint + Prettier |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test:unit` | Vitest unit + component tests (`src/**/*.test.ts(x)`) |
| `pnpm test:integration` | Vitest against Postgres (`tests/integration`, uses `TEST_DATABASE_URL`) |
| `pnpm test:e2e` | Playwright against a built app (`pnpm build` first) |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` / `db:seed` / `db:reset` | Apply migrations / upsert catalog / drop + migrate + seed (needs `ALLOW_DB_RESET=true`) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm art:generate` | Regenerate product SVGs from seed data |
| `pnpm build:db` | Bundle the db CLI for the Docker image |

## Project layout

See [docs/architecture.md](docs/architecture.md). Conventions for contributors and agents live in [AGENTS.md](AGENTS.md).

## Deployment

Every PR gets a preview URL (posted as a comment). Merging to `main` deploys production. Infra is Terraform in [`infra/`](infra/); pipelines are in [`.github/workflows`](.github/workflows). Runbooks: [docs/runbooks](docs/runbooks).

## Test cards

The payment provider is simulated. `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` declines; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0119` processing error.

---

The beans are open source: <https://github.com/coframe/coffee>
```

- [ ] **Step 2: AGENTS.md and CLAUDE.md**

`AGENTS.md`:
```markdown
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

| Path | Purpose |
| --- | --- |
| `src/app` | Routes. Route groups: `(marketing)`, `(shop)`, `(checkout)`, plus `api/` |
| `src/components/ui` | Presentational primitives (Button, Input, Sheet, …) |
| `src/components/{layout,product,cart,checkout,marketing,analytics}` | Domain components |
| `src/lib/db` | Drizzle client, schema, queries, seed |
| `src/lib/pricing` `payments` `cart` `checkout` | Domain logic |
| `src/lib/analytics` | Typed events + `track()`; SDK slot in `components/analytics/third-party-scripts.tsx` |
| `src/content` | Brew guides and FAQ as typed data |
| `scripts/` | `db.ts` CLI (bundled to `dist/db.mjs` for the image), product art generator |
| `drizzle/` | Migrations |
| `tests/` | Integration and e2e tests |
| `infra/` | Terraform for GCP |
| `.github/` | CI/CD |
| `docs/` | Architecture, runbooks, specs and plans |

## Common tasks

- **Add a product:** edit `src/lib/db/seed/data.ts`, run `pnpm art:generate` and `pnpm db:seed`.
- **Add a page:** create `page.tsx` under the right route group; add it to `src/app/sitemap.ts` if public.
- **Change pricing rules:** edit `src/lib/pricing`, update `src/lib/pricing/index.test.ts` first.
- **Add an analytics event:** extend the union in `src/lib/analytics/events.ts`; call `track()` from a client component.
- **Verify before you finish:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`, and `pnpm build && pnpm test:e2e` for UI changes.

## Deployment model

PRs deploy a zero-traffic revision to the `cofresso-web-preview` Cloud Run service (URL in the PR comment). Merges to `main` migrate and deploy `cofresso-web`. See `docs/runbooks`.
```

`CLAUDE.md`:
```markdown
@AGENTS.md
```

- [ ] **Step 3: CONTRIBUTING, SECURITY, architecture**

`CONTRIBUTING.md`:
```markdown
# Contributing

1. Branch from `main`: `git checkout -b feat/short-description`.
2. Make the change with tests. Run `pnpm lint && pnpm typecheck && pnpm test`.
3. Open a PR with a Conventional Commits title (`feat: …`, `fix: …`). CI must be green; a preview URL is posted to the PR.
4. Squash-merge. `main` deploys to production automatically.

Schema changes need a generated migration (`pnpm db:generate`) in the same PR. Infra changes under `infra/` get a Terraform plan comment on the PR and apply on merge.
```

`SECURITY.md`:
```markdown
# Security

Cofresso is a demo storefront. Payments are simulated and no real card data is processed. Still, please report anything that looks like a vulnerability to security@coframe.com rather than opening a public issue. We aim to respond within two business days.

Scope: this repository, cofresso.com and its preview deployments.
```

`docs/architecture.md`:
```markdown
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

| | Service | Database | Trigger |
| --- | --- | --- | --- |
| Preview | `cofresso-web-preview` (tagged, zero-traffic revisions) | `cofresso_preview` | Pull request |
| Production | `cofresso-web` | `cofresso` | Merge to `main` |

Migrations run as Cloud Run jobs (`cofresso-migrate`, `cofresso-migrate-preview`) using the same image before each deploy, followed by the idempotent seed.

## Observability

JSON logs with `severity` and Cloud Trace correlation (`src/lib/logger.ts`). `/api/health` probes the database and returns 503 when it is down; an uptime check alerts on it.
```

- [ ] **Step 4: Commit**

```bash
pnpm format
git add -A
git commit -m "docs: add README, AGENTS.md, contributing, security and architecture docs"
```

---

## Self-review notes

- Spec coverage: every route in the spec's route table has a task (home 13, shop/collections/search 14, product 15, cart 10, checkout/success/orders 16, about/faq/brew-guides 17, `/coffee`, robots, sitemap, humans 8 + 14, health 1 + 18). Pricing rules 4, payments 5, cart 6, placeOrder with idempotency 7, analytics events and SDK slot 8, seed data and art 3, Docker 20, docs 21, e2e list 19.
- Types used across tasks: `ProductCardData` (11 → 12/13/14/15), `CartView`/`CartLine` (6 → 10/16), `OrderView` (7 → 16), `ActionResult` (2 → 6/13/16), `PlaceOrderFailure` (7 → 16), `Totals` (4 → 6/10), `AnalyticsItem` (8 → 11/15/16).
- Known judgement calls: catalog sorting happens in memory because the catalog is small; `clearCart` is called with the transaction handle (see the note in Task 7).
