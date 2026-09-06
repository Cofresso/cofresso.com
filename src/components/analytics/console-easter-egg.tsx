'use client';

import { useEffect } from 'react';
import { siteConfig } from '@/lib/config';

export function ConsoleEasterEgg() {
  useEffect(() => {
    if (window.sessionStorage.getItem('cofresso:egg')) return;
    window.sessionStorage.setItem('cofresso:egg', '1');
    console.log(
      '%c☕ Cofresso %cPsst. The beans are open source: ' + siteConfig.easterEggUrl,
      'background:#4A2C24;color:#F6F1EB;padding:2px 8px;border-radius:4px;font-weight:600',
      'color:#A08977;padding-left:8px',
    );
  }, []);
  return null;
}
