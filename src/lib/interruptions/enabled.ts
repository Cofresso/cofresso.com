import { getServerEnv } from '@/lib/env';

/**
 * Server-only kill switch for every interruption. Read at request time (the root layout is
 * `force-dynamic`) so `UX_INTERRUPTIONS` can be flipped per environment without a rebuild.
 */
export function interruptionsEnabled(): boolean {
  return getServerEnv().UX_INTERRUPTIONS === 'on';
}
