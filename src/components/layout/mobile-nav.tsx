'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconMenu } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { siteConfig } from '@/lib/config';
import { SearchForm } from './search-form';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="rounded-full p-2 md:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <IconMenu width={22} height={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <div className="flex flex-col gap-6 p-5">
          <SearchForm />
          <nav className="flex flex-col gap-1">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
                className="hover:text-espresso px-3 py-2"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
