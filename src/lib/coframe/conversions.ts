import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getCoframeClient, hashEmail, readCoframeUserToken, type CoframeClient } from './client';
import type { CoframeConversionItem, CoframeSendResult } from './types';

export interface TrackPurchaseParams {
  orderNumber: string;
  orderId: string;
  totalCents: number;
  email: string;
  lookupToken: string;
  userToken?: string;
  client?: CoframeClient;
  siteUrl?: string;
}

export interface TrackNewsletterParams {
  email: string;
  source: string;
  userToken?: string;
  client?: CoframeClient;
}

function resolveSiteUrl(override?: string): string {
  if (override) return override;
  try {
    return getServerEnv().SITE_URL;
  } catch {
    return process.env.SITE_URL || 'http://localhost:3000';
  }
}

/**
 * Report a purchase conversion and map visitor identity to customer ID (email_sha256).
 * Safe to call: catches internal errors so caller flows (e.g. order redirects) are never disrupted.
 */
export async function trackPurchaseConversion(
  params: TrackPurchaseParams,
): Promise<CoframeSendResult> {
  try {
    const client = params.client ?? getCoframeClient();
    const userToken = params.userToken ?? (await readCoframeUserToken());
    const emailHash = hashEmail(params.email);
    const siteUrl = resolveSiteUrl(params.siteUrl);

    // If we have both visitor token and customer identity, link them
    if (userToken) {
      await client.identify([
        {
          user_token: userToken,
          external_id: emailHash,
          external_id_type: 'email_sha256',
        },
      ]);
    }

    const conversion: CoframeConversionItem = {
      event_name: 'purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `order_${params.orderNumber}`,
      action_source: 'server',
      value: params.totalCents / 100,
      user_token: userToken,
      external_id: emailHash,
      external_id_type: 'email_sha256',
      url: `${siteUrl.replace(/\/$/, '')}/checkout/success/${params.orderNumber}?t=${params.lookupToken}`,
      custom_data: {
        currency: 'USD',
        order_id: params.orderNumber,
        total_cents: params.totalCents,
      },
      user_data: {
        email_sha256: emailHash,
      },
    };

    return await client.conversions([conversion]);
  } catch (err) {
    logger.warn('Failed to track purchase conversion to Coframe', {
      error: err instanceof Error ? err.message : String(err),
      orderNumber: params.orderNumber,
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Report a newsletter sign-up conversion and link visitor token if present.
 * Safe to call: catches internal errors so customer flows are never disrupted.
 */
export async function trackNewsletterConversion(
  params: TrackNewsletterParams,
): Promise<CoframeSendResult> {
  try {
    const client = params.client ?? getCoframeClient();
    const userToken = params.userToken ?? (await readCoframeUserToken());
    const emailHash = hashEmail(params.email);

    if (userToken) {
      await client.identify([
        {
          user_token: userToken,
          external_id: emailHash,
          external_id_type: 'email_sha256',
        },
      ]);
    }

    const conversion: CoframeConversionItem = {
      event_name: 'newsletter_signup',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `newsletter_${emailHash}`,
      action_source: 'server',
      user_token: userToken,
      external_id: emailHash,
      external_id_type: 'email_sha256',
      custom_data: {
        source: params.source,
      },
      user_data: {
        email_sha256: emailHash,
      },
    };

    return await client.conversions([conversion]);
  } catch (err) {
    logger.warn('Failed to track newsletter conversion to Coframe', {
      error: err instanceof Error ? err.message : String(err),
      source: params.source,
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
