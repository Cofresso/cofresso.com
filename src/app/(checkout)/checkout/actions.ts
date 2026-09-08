'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FieldErrors } from '@/lib/action-result';
import { readCartId } from '@/lib/cart/cookie';
import { placeOrder, type PlaceOrderFailure } from '@/lib/checkout/place-order';
import { checkoutSchema } from '@/lib/checkout/schemas';
import { trackPurchaseConversion } from '@/lib/coframe';

export type CheckoutActionState = {
  error: string;
  code?: PlaceOrderFailure;
  fieldErrors?: FieldErrors;
} | null;

export async function placeOrderAction(
  _prev: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const cartId = await readCartId();
  if (!cartId) return { error: 'Your cart has expired. Add your items again.', code: 'empty_cart' };

  const result = await placeOrder({ cartId, input: parsed.data });
  if (!result.ok) return { error: result.message, code: result.code };

  await trackPurchaseConversion({
    orderNumber: result.orderNumber,
    orderId: result.orderId,
    totalCents: result.totalCents,
    email: parsed.data.email,
    lookupToken: result.lookupToken,
  });

  // placeOrder empties the cart in the database; refresh the shared layout (header cart badge)
  // so it reflects that on the next render instead of showing the pre-order item count.
  revalidatePath('/', 'layout');

  redirect(`/checkout/success/${result.orderNumber}?t=${result.lookupToken}`);
}
