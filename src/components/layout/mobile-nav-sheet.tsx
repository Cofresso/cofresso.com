'use client';

import Link from 'next/link';
import { Sheet } from '@/components/ui/sheet';
import { siteConfig } from '@/lib/config';
import { useMobileNav } from './mobile-nav-context';
import { SearchForm } from './search-form';

export function MobileNavSheet() {
  const { open, closeNav } = useMobileNav();
  return (
    <Sheet open={open} onClose={closeNav} title="Menu" side="left" testId="mobile-nav">
      <div className="flex flex-col gap-6 p-5">
        <SearchForm ariaLabel="Search products in menu" />
        <nav className="flex flex-col gap-1">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeNav}
              className="hover:bg-espresso/5 rounded-lg px-3 py-3 text-lg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-latte/30 text-latte flex flex-col gap-1 border-t pt-4 text-sm">
          {siteConfig.footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeNav}
              className="hover:text-espresso px-3 py-2"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
