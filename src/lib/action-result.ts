export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}
