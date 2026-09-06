'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { isOrderNumber, normalizeOrderNumber } from '@/lib/checkout/order-number';
import { findLookupToken } from '@/lib/checkout/queries';

const schema = z.object({
  orderNumber: z.string().trim().refine(isOrderNumber, 'Order numbers look like CF-10001.'),
  email: z.string().trim().toLowerCase().email('Enter the email used at checkout.'),
});

export async function lookupOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    orderNumber: formData.get('orderNumber'),
    email: formData.get('email'),
  });
  if (!parsed.success)
    return fail('Check the order number and email.', parsed.error.flatten().fieldErrors);
  const token = await findLookupToken(parsed.data.orderNumber, parsed.data.email);
  if (!token) return fail('We could not find an order with that number and email.');
  redirect(`/orders/${normalizeOrderNumber(parsed.data.orderNumber)}?t=${token}`);
}
