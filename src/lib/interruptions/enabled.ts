import { getServerEnv } from '@/lib/env';

/**
 * Server-only kill switch for every interruption.
 *
 * `getServerEnv()` caches its parse for the life of the process, so this is a revision-level
 * toggle, not a per-request one: flipping `UX_INTERRUPTIONS` takes effect on the next deploy
 * (or the next `terraform apply`, which rolls a new Cloud Run revision), not on the next
 * request. That is what you want for a kill switch — no request-to-request flapping.
 */
export function interruptionsEnabled(): boolean {
  return getServerEnv().UX_INTERRUPTIONS === 'on';
}
