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
    COFRAME_PROJECT_ID: z
      .preprocess(emptyToUndefined, z.string().optional())
      .default('6a9e31bb82444fc48fd16faf'),
    COFRAME_API_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    COFRAME_INGEST_URL: z
      .preprocess(emptyToUndefined, z.string().url().optional())
      .default('https://ingest.app.coframe.com'),
    GIT_SHA: z.string().default('dev'),
    ALLOW_DB_RESET: z.preprocess(emptyToUndefined, z.string().optional()),
    // Kill switch for the deliberate UI interruptions (popup, cookie banner, chat bubble,
    // social-proof toasts, announcement rotator, deferred sections). See
    // src/lib/interruptions/config.ts.
    UX_INTERRUPTIONS: z.enum(['on', 'off']).default('on'),
  })
  .superRefine((env, ctx) => {
    const hasParts = Boolean(
      env.DB_USER && env.DB_PASSWORD && env.DB_NAME && (env.DB_HOST || env.DB_SOCKET_DIR),
    );
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
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'env'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper. */
export function resetEnvCache(): void {
  cached = undefined;
}
