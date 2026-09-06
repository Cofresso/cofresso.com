import { eq } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db/client';
import { orders, type Order, type OrderItem } from '@/lib/db/schema';
import { normalizeOrderNumber } from './order-number';

export interface OrderItemView {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productSlug: string;
  variantName: string;
  imagePath: string;
  grind: OrderItem['grind'];
  purchaseType: OrderItem['purchaseType'];
  subscriptionIntervalWeeks: number | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  email: string;
  status: Order['status'];
  createdAt: Date;
  shipping: {
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  totals: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
  discountCode: string | null;
  cardLast4: string | null;
  items: OrderItemView[];
}

function toView(order: Order & { items: OrderItem[] }): OrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    status: order.status,
    createdAt: order.createdAt,
    shipping: {
      name: order.shippingName,
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    totals: {
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
    },
    discountCode: order.discountCode,
    cardLast4: order.cardLast4,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      variantName: i.variantName,
      imagePath: i.imagePath,
      grind: i.grind,
      purchaseType: i.purchaseType,
      subscriptionIntervalWeeks: i.subscriptionIntervalWeeks,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.unitPriceCents * i.quantity,
    })),
  };
}

async function findOrder(orderNumber: string, db: Db) {
  return db.query.orders.findFirst({
    where: eq(orders.orderNumber, normalizeOrderNumber(orderNumber)),
    with: { items: true },
  });
}

export async function getOrderForConfirmation(
  orderNumber: string,
  token: string,
  db: Db = getDb(),
): Promise<OrderView | null> {
  const order = await findOrder(orderNumber, db);
  if (!order || !token || order.lookupToken !== token) return null;
  return toView(order);
}

export async function getOrderForLookup(
  orderNumber: string,
  email: string,
  db: Db = getDb(),
): Promise<OrderView | null> {
  const order = await findOrder(orderNumber, db);
  if (!order || order.email !== email.trim().toLowerCase()) return null;
  return toView(order);
}
