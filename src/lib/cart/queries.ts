import { asc, eq, sql } from 'drizzle-orm';
import { thumbnailImage } from '@/lib/catalog/types';
import { getDb, type Db } from '@/lib/db/client';
import { cartItems, carts, discountCodes, productImages } from '@/lib/db/schema';
import {
  computeTotals,
  effectiveUnitPriceCents,
  evaluateDiscountCode,
  lineTotalCents,
  type DiscountRule,
} from '@/lib/pricing';
import type { CartLine, CartView } from './types';

export async function getCartView(cartId: string, db: Db = getDb()): Promise<CartView | null> {
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.createdAt)],
        with: {
          variant: {
            with: { product: { with: { images: { orderBy: [asc(productImages.position)] } } } },
          },
        },
      },
    },
  });
  if (!cart) return null;

  const lines: CartLine[] = cart.items.map((item) => {
    const pricingLine = {
      unitPriceCents: item.variant.priceCents,
      quantity: item.quantity,
      purchaseType: item.purchaseType,
    };
    return {
      id: item.id,
      quantity: item.quantity,
      grind: item.grind,
      purchaseType: item.purchaseType,
      subscriptionIntervalWeeks: item.subscriptionIntervalWeeks,
      unitPriceCents: item.variant.priceCents,
      effectiveUnitPriceCents: effectiveUnitPriceCents(pricingLine),
      lineTotalCents: lineTotalCents(pricingLine),
      variant: {
        id: item.variant.id,
        name: item.variant.name,
        sku: item.variant.sku,
        stockQuantity: item.variant.stockQuantity,
      },
      product: {
        id: item.variant.product.id,
        slug: item.variant.product.slug,
        name: item.variant.product.name,
        image: thumbnailImage(item.variant.product, item.variant.product.images),
        category: item.variant.product.category,
      },
    };
  });

  const pricingLines = lines.map((l) => ({
    unitPriceCents: l.unitPriceCents,
    quantity: l.quantity,
    purchaseType: l.purchaseType,
  }));
  const preDiscount = computeTotals(pricingLines, null);

  let discount: DiscountRule | null = null;
  let discountMessage: string | null = null;
  if (cart.discountCode) {
    const row = await db.query.discountCodes.findFirst({
      where: eq(discountCodes.code, cart.discountCode),
    });
    if (!row) {
      discountMessage = 'That code is no longer available.';
    } else {
      const evaluation = evaluateDiscountCode(row, preDiscount.subtotalCents);
      if (evaluation.ok) discount = evaluation.rule;
      else discountMessage = evaluation.message;
    }
  }

  return {
    id: cart.id,
    discountCode: cart.discountCode,
    discount,
    discountMessage,
    lines,
    totals: computeTotals(pricingLines, discount),
  };
}

export async function getCartItemCount(cartId: string, db: Db = getDb()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row?.n ?? 0;
}
