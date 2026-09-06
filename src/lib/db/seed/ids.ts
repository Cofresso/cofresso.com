import { v5 as uuidv5 } from 'uuid';

const NAMESPACE = 'c0f7e550-0000-4000-8000-000000000c0f';

/** Deterministic UUID so re-running the seed upserts instead of duplicating. */
export function stableId(key: string): string {
  return uuidv5(key, NAMESPACE);
}
