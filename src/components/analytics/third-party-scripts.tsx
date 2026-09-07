import { cookies } from 'next/headers';
import Script from 'next/script';
import { getServerEnv } from '@/lib/env';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { parseConsent } from '@/lib/interruptions/consent';

/**
 * Integration point for the Coframe SDK. Renders nothing unless COFRAME_SITE_KEY is set in the
 * server environment. Read at request time so it can be toggled per environment without
 * rebuilding the image.
 *
 * When `consent.gateSdkOnAnalytics` is on, the tag also waits for analytics consent — read
 * server-side from the same cookie the banner writes, so the SDK never loads before the visitor
 * has said yes.
 *
 * That gate is deliberately independent of `UX_INTERRUPTIONS`. The kill switch controls whether
 * the storefront interrupts people; it is not a consent decision, and letting it double as one
 * would mean turning the interruptions off also loaded a tracking script nobody agreed to. The
 * consequence is that with interruptions off there is no banner, so a gated SDK never loads —
 * set `gateSdkOnAnalytics: false` if you need it during a no-interruptions demo.
 */
export async function ThirdPartyScripts() {
  const env = getServerEnv();
  if (!env.COFRAME_SITE_KEY) return null;

  if (interruptionsConfig.consent.gateSdkOnAnalytics) {
    const store = await cookies();
    const consent = parseConsent(store.get(interruptionsConfig.consent.cookieName)?.value);
    if (!consent?.analytics) return null;
  }

  const src = env.COFRAME_SCRIPT_URL ?? 'https://cdn.coframe.com/sdk.js';
  return (
    <Script
      id="coframe-sdk"
      src={src}
      data-site-key={env.COFRAME_SITE_KEY}
      strategy="afterInteractive"
    />
  );
}
