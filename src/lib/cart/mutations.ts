import { and, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { cartItems, carts, discountCodes, productVariants } from '@/lib/db/schema';
import { computeTotals, evaluateDiscountCode } from '@/lib/pricing';
import type { AddLineInput } from './schemas';

export type CartMutationCode =
  'variant_not_found' | 'out_of_stock' | 'line_not_found' | 'invalid_code';

export class CartMutationError extends Error {
  constructor(
    public readonly code: CartMutationCode,
    message: string,
  ) {
    super(message);
    this.name = 'CartMutationError';
  }
}

export async function ensureCart(db: Db, cartId: string | null): Promise<string> {
  if (cartId) {
    const existing = await db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      columns: { id: true },
    });
    if (existing) return existing.id;
  }
  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  return created.id;
}

async function touch(db: Db, cartId: string) {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function addLine(db: Db, cartId: string, input: AddLineInput) {
  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, input.variantId),
    with: { product: { columns: { active: true, category: true } } },
  });
  if (!variant || !variant.product.active)
    throw new CartMutationError('variant_not_found', 'That product is not available.');

  const grind = variant.product.category === 'coffee' ? (input.grind ?? 'whole_bean') : null;

  // Stock is enforced against ALL lines of this variant in the cart (every grind and
  // purchase-type combination shares the same underlying stockQuantity), not just the line
  // this add would merge into.
  const variantLines = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      grind: cartItems.grind,
      purchaseType: cartItems.purchaseType,
      subscriptionIntervalWeeks: cartItems.subscriptionIntervalWeeks,
    })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, input.variantId)));

  const existing = variantLines.find(
    (line) =>
      (grind ? line.grind === grind : line.grind === null) &&
      line.purchaseType === input.purchaseType &&
      (input.subscriptionIntervalWeeks
        ? line.subscriptionIntervalWeeks === input.subscriptionIntervalWeeks
        : line.subscriptionIntervalWeeks === null),
  );

  const currentVariantTotal = variantLines.reduce((n, l) => n + l.quantity, 0);
  const nextVariantTotal = currentVariantTotal + input.quantity;
  if (nextVariantTotal > variant.stockQuantity) {
    throw new CartMutationError(
      'out_of_stock',
      variant.stockQuantity === 0
        ? 'That item is sold out.'
        : `Only ${variant.stockQuantity} left in stock.`,
    );
  }

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: existing.quantity + input.quantity })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      variantId: input.variantId,
      quantity: input.quantity,
      grind,
      purchaseType: input.purchaseType,
      subscriptionIntervalWeeks: input.subscriptionIntervalWeeks,
    });
  }
  await touch(db, cartId);
}

export async function setLineQuantity(db: Db, cartId: string, lineId: string, quantity: number) {
  if (quantity <= 0) return removeLine(db, cartId, lineId);
  const line = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.id, lineId), eq(cartItems.cartId, cartId)),
    with: { variant: { columns: { stockQuantity: true } } },
  });
  if (!line) throw new CartMutationError('line_not_found', 'That item is no longer in your cart.');

  // Sum every OTHER line of this variant in the cart (other grinds / purchase types) so the
  // new target quantity is checked against the variant's total allocation, not just this line.
  const [{ total: otherLinesTotal }] = await db
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.variantId, line.variantId),
        ne(cartItems.id, lineId),
      ),
    );

  const nextVariantTotal = otherLinesTotal + quantity;
  if (nextVariantTotal > line.variant.stockQuantity) {
    throw new CartMutationError(
      'out_of_stock',
      `Only ${line.variant.stockQuantity} left in stock.`,
    );
  }
  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, lineId));
  await touch(db, cartId);
}

export async function removeLine(db: Db, cartId: string, lineId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.id, lineId), eq(cartItems.cartId, cartId)));
  await touch(db, cartId);
}

export async function applyDiscountCode(db: Db, cartId: string, code: string) {
  const row = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.code, code.toUpperCase()),
  });
  if (!row) throw new CartMutationError('invalid_code', 'We do not recognize that code.');

  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, cartId),
    with: { variant: { columns: { priceCents: true } } },
  });
  const subtotal = computeTotals(
    items.map((i) => ({
      unitPriceCents: i.variant.priceCents,
      quantity: i.quantity,
      purchaseType: i.purchaseType,
    })),
    null,
  ).subtotalCents;

  const evaluation = evaluateDiscountCode(row, subtotal);
  if (!evaluation.ok) throw new CartMutationError('invalid_code', evaluation.message);

  await db
    .update(carts)
    .set({ discountCode: row.code, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
  return row.code;
}

export async function clearDiscountCode(db: Db, cartId: string) {
  await db
    .update(carts)
    .set({ discountCode: null, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}

export async function clearCart(db: Pick<Db, 'delete' | 'update'>, cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await db
    .update(carts)
    .set({ discountCode: null, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}
