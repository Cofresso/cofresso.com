import type { DbTarget } from './client';

function isSet(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/**
 * Resolve the postgres.js connection target from environment variables.
 *
 * Precedence:
 * 1. `DATABASE_URL` — returned as-is (a connection string).
 * 2. `DB_USER` + `DB_PASSWORD` + `DB_NAME` + `DB_SOCKET_DIR` — Cloud SQL Unix
 *    socket, returned as an options object (never a URL, since postgres.js
 *    rejects a URL with an empty host). The socket directory goes in `host`,
 *    NOT `path`: postgres.js appends `/.s.PGSQL.<port>` to a `host` containing
 *    a `/`, whereas `path` must already be the full socket file path (see
 *    `parseOptions` in postgres/src/index.js). Passing the directory as `path`
 *    makes it connect() to a directory, which fails with EACCES on Cloud Run.
 * 3. `DB_HOST` (+ user/password/database) — TCP, returned as an options
 *    object with `DB_PORT` defaulting to 5432.
 *
 * Throws if none of the above are configured. Empty strings are treated as
 * unset.
 */
export function resolveDbTarget(env: NodeJS.ProcessEnv): DbTarget {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, DB_SOCKET_DIR } = env;

  if (isSet(DATABASE_URL)) return DATABASE_URL;

  if (isSet(DB_USER) && isSet(DB_PASSWORD) && isSet(DB_NAME) && isSet(DB_SOCKET_DIR)) {
    return { host: DB_SOCKET_DIR, user: DB_USER, password: DB_PASSWORD, database: DB_NAME };
  }

  if (isSet(DB_HOST)) {
    return {
      host: DB_HOST,
      port: Number(isSet(DB_PORT) ? DB_PORT : 5432),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    };
  }

  throw new Error('No database configuration found (DATABASE_URL or DB_* variables).');
}
