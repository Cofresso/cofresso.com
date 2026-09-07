/**
 * Helpers for logging database failures without leaking their payload.
 *
 * drizzle wraps driver failures in a `DrizzleQueryError` whose `message` embeds the SQL
 * statement AND every bound parameter — emails, addresses, cart ids, discount codes,
 * payment references. Never pass such an error (or anything derived from its message) to
 * the logger; log `describeDbError(err)` plus the context ids you actually need instead.
 */

/**
 * postgres.js reports the underlying `PostgresError` (with `.code` / `.constraint_name`) as
 * `.cause` on the `DrizzleQueryError` it throws, not as own properties of the thrown error —
 * so both layers need to be checked.
 */
export function pgErrorField(err: unknown, field: 'code' | 'constraint_name'): unknown {
  if (typeof err !== 'object' || err === null) return undefined;
  const own = err as Record<string, unknown>;
  if (field in own) return own[field];
  const cause = 'cause' in own ? own.cause : undefined;
  if (typeof cause === 'object' && cause !== null && field in cause) {
    return (cause as Record<string, unknown>)[field];
  }
  return undefined;
}

/** A safe-to-log summary of a database error: no statement text, no bound parameters. */
export function describeDbError(err: unknown): { errName: string; pgCode?: string } {
  const pgCode = pgErrorField(err, 'code');
  return {
    errName: err instanceof Error ? err.name : 'unknown',
    pgCode: pgCode === undefined ? undefined : String(pgCode),
  };
}
