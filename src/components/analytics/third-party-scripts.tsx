import { cookies } from 'next/headers';
import Script from 'next/script';
import { getServerEnv } from '@/lib/env';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { parseConsent } from '@/lib/interruptions/consent';
import { interruptionsEnabled } from '@/lib/interruptions/enabled';

/**
 * Integration point for the Coframe SDK. Renders nothing unless COFRAME_SITE_KEY is set in the
 * server environment. Read at request time so it can be toggled per environment without
 * rebuilding the image.
 *
 * When `consent.gateSdkOnAnalytics` is on, the tag also waits for analytics consent — read
 * server-side from the same cookie the banner writes, so the SDK never loads before the
 * visitor has said yes. The gate is skipped when `UX_INTERRUPTIONS=off`, because then there is
 * no banner to say yes with and gating would block the SDK for good.
 */
export async function ThirdPartyScripts() {
  const env = getServerEnv();
  if (!env.COFRAME_SITE_KEY) return null;

  if (interruptionsConfig.consent.gateSdkOnAnalytics && interruptionsEnabled()) {
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
