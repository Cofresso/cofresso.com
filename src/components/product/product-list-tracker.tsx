'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import { lowestPriceCents, type ProductCardData } from '@/lib/catalog/types';

export function ProductListTracker({
  listId,
  items,
}: {
  listId: string;
  items: ProductCardData[];
}) {
  useEffect(() => {
    track({
      name: 'view_item_list',
      listId,
      items: items.map((i) => ({
        productId: i.product.id,
        slug: i.product.slug,
        name: i.product.name,
        priceCents: lowestPriceCents(i.variants),
      })),
    });
  }, [listId, items]);
  return null;
}
