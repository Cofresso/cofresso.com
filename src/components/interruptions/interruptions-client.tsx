'use client';

import type { Consent } from '@/lib/interruptions/consent';
import { CookieBanner } from './cookie-banner';
import { EmailCaptureModal } from './email-capture-modal';
import { InterruptionStateProvider } from './state';

/**
 * Composes the client-side interruptions under one shared state provider so they can stay out
 * of each other's way (toasts hold off while the popup or chat is open, the bottom-corner
 * pieces lift out from under the cookie banner).
 */
export function InterruptionsClient({ consent }: { consent: Consent | null }) {
  return (
    <InterruptionStateProvider>
      <CookieBanner consent={consent} />
      <EmailCaptureModal />
    </InterruptionStateProvider>
  );
}
