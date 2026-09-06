'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    track({ name: 'page_view', path: pathname, title: document.title });
  }, [pathname]);
  return null;
}
