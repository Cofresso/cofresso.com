'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function CartPageTracker({
  valueCents,
  itemCount,
}: {
  valueCents: number;
  itemCount: number;
}) {
  useEffect(() => {
    track({ name: 'view_cart', valueCents, itemCount });
  }, [valueCents, itemCount]);
  return null;
}
