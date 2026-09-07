'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getDb } from '@/lib/db/client';
import { describeDbError } from '@/lib/db/errors';
import { logger } from '@/lib/logger';
import { readCartId, writeCartId } from './cookie';
import {
  addLine,
  applyDiscountCode,
  CartMutationError,
  clearDiscountCode,
  ensureCart,
  removeLine,
  setLineQuantity,
} from './mutations';
import { getCartItemCount } from './queries';
import { addToCartSchema, promoCodeSchema, updateQuantitySchema } from './schemas';

function revalidateCart() {
  revalidatePath('/', 'layout');
}

function handleError<T>(err: unknown, fallback: string, cartId?: string): ActionResult<T> {
  if (err instanceof CartMutationError) return fail(err.message);
  // Never log the raw error: drizzle embeds the statement and every bound param (cart ids,
  // line ids, discount codes) in `error.message`.
  logger.error('cart action failed', { ...describeDbError(err), cartId });
  return fail(fallback);
}

export async function addToCartAction(
  _prev: ActionResult<{ itemCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = addToCartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail('Check your selection.', parsed.error.flatten().fieldErrors);
  }
  try {
    const db = getDb();
    const cartId = await ensureCart(db, await readCartId());
    await writeCartId(cartId);
    await addLine(db, cartId, parsed.data);
    revalidateCart();
    return ok({ itemCount: await getCartItemCount(cartId, db) });
  } catch (err) {
    return handleError(err, 'Could not add that to your cart.');
  }
}

export async function updateCartLineAction(
  lineId: string,
  quantity: number,
): Promise<ActionResult> {
  const parsed = updateQuantitySchema.safeParse({ lineId, quantity });
  if (!parsed.success) return fail('Invalid quantity.');
  const cartId = await readCartId();
  if (!cartId) return fail('Your cart has expired.');
  try {
    await setLineQuantity(getDb(), cartId, parsed.data.lineId, parsed.data.quantity);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not update your cart.', cartId);
  }
}

export async function removeCartLineAction(lineId: string): Promise<ActionResult> {
  const cartId = await readCartId();
  if (!cartId) return fail('Your cart has expired.');
  try {
    await removeLine(getDb(), cartId, lineId);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not update your cart.', cartId);
  }
}

export async function applyPromoAction(
  _prev: ActionResult<{ code: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ code: string }>> {
  const parsed = promoCodeSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Enter a code.');
  const cartId = await readCartId();
  if (!cartId) return fail('Add something to your cart first.');
  try {
    const code = await applyDiscountCode(getDb(), cartId, parsed.data.code);
    revalidateCart();
    return ok({ code });
  } catch (err) {
    return handleError(err, 'Could not apply that code.', cartId);
  }
}

export async function removePromoAction(): Promise<ActionResult> {
  const cartId = await readCartId();
  if (!cartId) return ok(undefined);
  try {
    await clearDiscountCode(getDb(), cartId);
    revalidateCart();
    return ok(undefined);
  } catch (err) {
    return handleError(err, 'Could not remove that code.', cartId);
  }
}
