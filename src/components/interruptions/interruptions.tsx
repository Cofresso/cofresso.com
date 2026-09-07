import { cookies } from 'next/headers';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { parseConsent } from '@/lib/interruptions/consent';
import { interruptionsEnabled } from '@/lib/interruptions/enabled';
import { InterruptionsClient } from './interruptions-client';

/**
 * Mount point for every overlay interruption. Server component so the kill switch and the
 * consent cookie are resolved before anything reaches the browser: with `UX_INTERRUPTIONS=off`
 * not a byte of this ships, and a visitor who already answered the banner never sees it flash.
 */
export async function Interruptions() {
  if (!interruptionsEnabled()) return null;
  const store = await cookies();
  const consent = parseConsent(store.get(interruptionsConfig.consent.cookieName)?.value);
  return <InterruptionsClient consent={consent} />;
}
