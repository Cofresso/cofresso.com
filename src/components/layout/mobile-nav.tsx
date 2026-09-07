'use client';

import { IconMenu } from '@/components/ui/icons';
import { useMobileNav } from './mobile-nav-context';

export function MobileNav() {
  const { openNav } = useMobileNav();
  return (
    <button
      type="button"
      className="rounded-full p-2 md:hidden"
      aria-label="Open menu"
      onClick={openNav}
    >
      <IconMenu width={22} height={22} />
    </button>
  );
}
