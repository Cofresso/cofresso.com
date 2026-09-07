import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Options } from 'postgres';
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

export type DbTarget = string | Options<Record<string, never>>;

/** Build an isolated client (used by scripts and tests that need to close it). */
export function createIsolatedDb(target: DbTarget) {
  const sql =
    typeof target === 'string' ? postgres(target, { max: 3 }) : postgres({ ...target, max: 3 });
  return {
    db: drizzle(sql, { schema, casing: 'snake_case' }),
    close: () => sql.end({ timeout: 5 }),
  };
}
