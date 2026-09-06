import Script from 'next/script';
import { getServerEnv } from '@/lib/env';

/**
 * Integration point for the Coframe SDK. Renders nothing unless COFRAME_SITE_KEY
 * is set in the server environment. Read at request time so it can be toggled per
 * environment without rebuilding the image.
 */
export function ThirdPartyScripts() {
  const env = getServerEnv();
  if (!env.COFRAME_SITE_KEY) return null;
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
