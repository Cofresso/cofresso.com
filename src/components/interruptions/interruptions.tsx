import { interruptionsEnabled } from '@/lib/interruptions/enabled';
import { InterruptionsClient } from './interruptions-client';

/**
 * Mount point for every overlay interruption. Server component so the kill switch is resolved
 * before anything reaches the browser: with `UX_INTERRUPTIONS=off` not a byte of this ships.
 */
export function Interruptions() {
  if (!interruptionsEnabled()) return null;
  return <InterruptionsClient />;
}
