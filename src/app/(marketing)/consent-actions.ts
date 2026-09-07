'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getServerEnv } from '@/lib/env';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { consentFor, serializeConsent, type Consent } from '@/lib/interruptions/consent';

const schema = z.object({ analytics: z.boolean(), marketing: z.boolean() });

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Record a visitor's cookie decision. The cookie is deliberately not httpOnly: client
 * components read the same value, and there is nothing sensitive in "yes to analytics".
 */
export async function setConsentAction(
  input: z.infer<typeof schema>,
): Promise<ActionResult<Consent>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail('Could not save your cookie preferences.');

  const consent = consentFor(parsed.data, new Date());
  const store = await cookies();
  store.set({
    name: interruptionsConfig.consent.cookieName,
    value: serializeConsent(consent),
    maxAge: interruptionsConfig.consent.maxAgeDays * DAY_SECONDS,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    // Keyed off the public origin rather than NODE_ENV: the e2e suite runs a production
    // build over plain http, and a Secure cookie there would silently never be stored.
    secure: getServerEnv().SITE_URL.startsWith('https://'),
  });

  // The root layout reads this cookie to decide whether to show the banner and whether the
  // SDK slot may render, so the whole layout has to be re-rendered.
  revalidatePath('/', 'layout');
  return ok(consent);
}
