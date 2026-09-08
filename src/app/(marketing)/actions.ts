'use server';

import { z } from 'zod';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { trackNewsletterConversion } from '@/lib/coframe';
import { describeDbError } from '@/lib/db/errors';
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
    const result = await subscribeToNewsletter(parsed.data.email, parsed.data.source);
    if (result.created) {
      await trackNewsletterConversion({
        email: parsed.data.email,
        source: parsed.data.source,
      });
    }
    return ok(result);
  } catch (err) {
    // Never log the raw error: drizzle embeds the statement and its bound params — here the
    // subscriber's email address — in `error.message`.
    logger.error('newsletter subscribe failed', {
      ...describeDbError(err),
      source: parsed.data.source,
    });
    return fail('Something went wrong. Please try again.');
  }
}
