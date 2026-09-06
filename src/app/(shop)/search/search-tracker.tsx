'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function SearchTracker({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    if (query) track({ name: 'search', query, resultCount });
  }, [query, resultCount]);
  return null;
}
