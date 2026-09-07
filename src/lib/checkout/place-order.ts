import { eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { clearCart } from '@/lib/cart/mutations';
import { getDb, type Db } from '@/lib/db/client';
import { describeDbError, pgErrorField } from '@/lib/db/errors';
import {
  cartItems,
  carts,
  discountCodes,
  orderItems,
  orders,
  productVariants,
} from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { getPaymentProvider, type PaymentProvider } from '@/lib/payments';
import {
  computeTotals,
  effectiveUnitPriceCents,
  evaluateDiscountCode,
  type DiscountRule,
} from '@/lib/pricing';
import { formatOrderNumber } from './order-number';
import type { CheckoutInput } from './schemas';

export type PlaceOrderFailure =
  'empty_cart' | 'out_of_stock' | 'payment_declined' | 'invalid_discount' | 'unknown';

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; lookupToken: string }
  | { ok: false; code: PlaceOrderFailure; message: string; lineId?: string };

class PlaceOrderError extends Error {
  constructor(
    public readonly code: PlaceOrderFailure,
    message: string,
    public readonly lineId?: string,
  ) {
    super(message);
  }
}

/** Postgres unique_violation on `orders.idempotency_key` — see drizzle/0000_init.sql. */
const IDEMPOTENCY_KEY_CONSTRAINT = 'orders_idempotency_key_unique';

function isIdempotencyKeyViolation(err: unknown): boolean {
  return (
    pgErrorField(err, 'code') === '23505' &&
    pgErrorField(err, 'constraint_name') === IDEMPOTENCY_KEY_CONSTRAINT
  );
}

export async function placeOrder(params: {
  cartId: string;
  input: CheckoutInput;
  db?: Db;
  provider?: PaymentProvider;
  now?: Date;
}): Promise<PlaceOrderResult> {
  const db = params.db ?? getDb();
  const provider = params.provider ?? getPaymentProvider();
  const now = params.now ?? new Date();
  const { cartId, input } = params;

  const existing = await db.query.orders.findFirst({
    where: eq(orders.idempotencyKey, input.idempotencyKey),
    columns: { id: true, orderNumber: true, lookupToken: true },
  });
  if (existing)
    return {
      ok: true,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      lookupToken: existing.lookupToken,
    };

  try {
    return await db.transaction(async (tx) => {
      const cart = await tx.query.carts.findFirst({
        where: eq(carts.id, cartId),
        columns: { id: true, discountCode: true },
      });
      const items = cart
        ? await tx.query.cartItems.findMany({
            where: eq(cartItems.cartId, cartId),
            orderBy: (t, { asc }) => [asc(t.createdAt)],
          })
        : [];
      if (!cart || items.length === 0) {
        // A concurrent call with the SAME idempotency key can win the race, fully commit
        // (including clearCart), before this call's own items lookup runs — this call would
        // then see a genuinely empty cart even though the order was placed. Check for that
        // before declaring failure, the same way the unique-violation branch below does for
        // the case where both calls reach the insert.
        const concurrentOrder = await tx.query.orders.findFirst({
          where: eq(orders.idempotencyKey, input.idempotencyKey),
          columns: { id: true, orderNumber: true, lookupToken: true },
        });
        if (concurrentOrder) {
          return {
            ok: true,
            orderId: concurrentOrder.id,
            orderNumber: concurrentOrder.orderNumber,
            lookupToken: concurrentOrder.lookupToken,
          } satisfies PlaceOrderResult;
        }
        throw new PlaceOrderError('empty_cart', 'Your cart is empty.');
      }

      const variantIds = items.map((i) => i.variantId);
      const lockedVariants = await tx
        .select()
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
        .for('update');
      const variantById = new Map(lockedVariants.map((v) => [v.id, v]));
      const products = await tx.query.products.findMany({
        where: (p, { inArray: inArr }) =>
          inArr(p.id, [...new Set(lockedVariants.map((v) => v.productId))]),
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      // A single variant can appear on more than one cart line (different grinds, or a
      // one-time line alongside a subscription line of the same variant). Stock must be
      // checked and decremented once per variant against the SUM of its lines, otherwise
      // each line passes an independent check against the full stock and the decrements
      // accumulate past zero.
      const quantityByVariant = new Map<string, number>();
      for (const item of items) {
        quantityByVariant.set(
          item.variantId,
          (quantityByVariant.get(item.variantId) ?? 0) + item.quantity,
        );
      }

      for (const [variantId, quantity] of quantityByVariant) {
        const variant = variantById.get(variantId);
        const lineId = items.find((i) => i.variantId === variantId)?.id;
        if (!variant) {
          throw new PlaceOrderError(
            'out_of_stock',
            'An item in your cart is no longer available.',
            lineId,
          );
        }
        if (variant.stockQuantity < quantity) {
          const product = productById.get(variant.productId);
          throw new PlaceOrderError(
            'out_of_stock',
            `Only ${variant.stockQuantity} of ${product?.name ?? 'that item'} (${variant.name}) left — you requested ${quantity} total. Please adjust your cart.`,
            lineId,
          );
        }
      }

      const pricingLines = items.map((item) => ({
        unitPriceCents: variantById.get(item.variantId)!.priceCents,
        quantity: item.quantity,
        purchaseType: item.purchaseType,
      }));

      let discount: DiscountRule | null = null;
      let discountRow: typeof discountCodes.$inferSelect | undefined;
      if (cart.discountCode) {
        discountRow = await tx.query.discountCodes.findFirst({
          where: eq(discountCodes.code, cart.discountCode),
        });
        const subtotal = computeTotals(pricingLines, null).subtotalCents;
        const evaluation = discountRow ? evaluateDiscountCode(discountRow, subtotal, now) : null;
        if (!evaluation || !evaluation.ok) {
          throw new PlaceOrderError(
            'invalid_discount',
            evaluation?.message ?? 'Your promo code is no longer valid. Remove it to continue.',
          );
        }
        discount = evaluation.rule;
      }

      const totals = computeTotals(pricingLines, discount);

      const authorization = await provider.authorize({
        amountCents: totals.totalCents,
        currency: 'USD',
        idempotencyKey: input.idempotencyKey,
        card: {
          number: input.cardNumber,
          expMonth: input.expMonth,
          expYear: input.expYear,
          cvc: input.cvc,
          name: input.cardName,
        },
      });
      if (!authorization.ok) throw new PlaceOrderError('payment_declined', authorization.message);

      const [{ nextval }] = await tx.execute<{ nextval: string }>(
        sql`select nextval('order_number_seq') as nextval`,
      );
      const orderNumber = formatOrderNumber(Number(nextval));
      const lookupToken = randomBytes(16).toString('hex');

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          email: input.email,
          status: 'paid',
          shippingName: input.shippingName,
          shippingAddress1: input.address1,
          shippingAddress2: input.address2 ?? null,
          shippingCity: input.city,
          shippingState: input.state,
          shippingPostalCode: input.postalCode,
          shippingCountry: input.country,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          shippingCents: totals.shippingCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          discountCode: discount ? cart.discountCode : null,
          paymentProvider: provider.name,
          paymentReference: authorization.reference,
          cardLast4: authorization.last4,
          lookupToken,
          idempotencyKey: input.idempotencyKey,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        items.map((item) => {
          const variant = variantById.get(item.variantId)!;
          const product = productById.get(variant.productId)!;
          return {
            orderId: order.id,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            productSlug: product.slug,
            variantName: variant.name,
            imagePath: product.imagePath,
            grind: item.grind,
            purchaseType: item.purchaseType,
            subscriptionIntervalWeeks: item.subscriptionIntervalWeeks,
            unitPriceCents: effectiveUnitPriceCents({
              unitPriceCents: variant.priceCents,
              quantity: item.quantity,
              purchaseType: item.purchaseType,
            }),
            quantity: item.quantity,
          };
        }),
      );

      for (const [variantId, quantity] of quantityByVariant) {
        await tx
          .update(productVariants)
          .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${quantity}` })
          .where(eq(productVariants.id, variantId));
      }

      if (discountRow) {
        await tx
          .update(discountCodes)
          .set({ usageCount: sql`${discountCodes.usageCount} + 1` })
          .where(eq(discountCodes.id, discountRow.id));
      }

      await clearCart(tx, cartId);

      logger.info('order placed', {
        orderNumber,
        totalCents: totals.totalCents,
        items: items.length,
      });
      return { ok: true, orderId: order.id, orderNumber, lookupToken } satisfies PlaceOrderResult;
    });
  } catch (err) {
    if (err instanceof PlaceOrderError) {
      return { ok: false, code: err.code, message: err.message, lineId: err.lineId };
    }
    if (isIdempotencyKeyViolation(err)) {
      // A concurrent call for the same idempotency key committed first. This call may have
      // already authorized a (tolerated, simulated) second payment before hitting the unique
      // constraint on insert, but we must not create a second order or tell the customer their
      // card was declined — hand back the order the winning call created.
      const replay = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, input.idempotencyKey),
        columns: { id: true, orderNumber: true, lookupToken: true },
      });
      if (replay) {
        return {
          ok: true,
          orderId: replay.id,
          orderNumber: replay.orderNumber,
          lookupToken: replay.lookupToken,
        };
      }
    }
    // Never log the raw error: drizzle/postgres embed the statement and bound params
    // (email, address, card_last4, payment_reference, idempotency_key, lookup_token) in
    // `error.message`, and the logger serialises whatever it is given.
    logger.error('placeOrder failed', { ...describeDbError(err), cartId });
    return {
      ok: false,
      code: 'unknown',
      message: 'Something went wrong placing your order. You have not been charged.',
    };
  }
}
