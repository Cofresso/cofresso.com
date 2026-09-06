'use server';

import { z } from 'zod';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { subscribeToNewsletter } from '@/lib/db/queries/newsletter';
import { logger } from '@/lib/logger';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  source: z.string().trim().max(40).default('site'),
});

export async function subscribeNewsletterAction(
  _prev: ActionResult<{ created: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ created: boolean }>> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    source: formData.get('source') ?? 'site',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
  try {
    return ok(await subscribeToNewsletter(parsed.data.email, parsed.data.source));
  } catch (err) {
    logger.error('newsletter subscribe failed', { err });
    return fail('Something went wrong. Please try again.');
  }
}
