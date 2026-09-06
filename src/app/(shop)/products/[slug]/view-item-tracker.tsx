'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';
import type { AnalyticsItem } from '@/lib/analytics/events';

export function ViewItemTracker({ item }: { item: AnalyticsItem }) {
  useEffect(() => {
    track({ name: 'view_item', item });
  }, [item]);
  return null;
}
