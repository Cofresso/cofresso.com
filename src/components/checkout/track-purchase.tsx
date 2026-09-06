'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import type { OrderView } from '@/lib/checkout/queries';

export function TrackPurchase({ order }: { order: OrderView }) {
  useEffect(() => {
    const key = `cofresso:purchase:${order.orderNumber}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    track({
      name: 'purchase',
      orderNumber: order.orderNumber,
      valueCents: order.totals.totalCents,
      discountCode: order.discountCode,
      items: order.items.map((i) => ({
        productId: i.productId ?? i.productSlug,
        slug: i.productSlug,
        name: i.productName,
        variantId: i.variantId ?? undefined,
        variantName: i.variantName,
        priceCents: i.unitPriceCents,
        quantity: i.quantity,
        purchaseType: i.purchaseType,
      })),
    });
  }, [order]);
  return null;
}
