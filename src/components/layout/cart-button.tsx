'use client';

import { IconBag } from '@/components/ui/icons';
import { useCartDrawer } from './cart-drawer-context';

export function CartButton({ count }: { count: number }) {
  const { openDrawer } = useCartDrawer();
  return (
    <button
      type="button"
      onClick={openDrawer}
      className="text-espresso hover:bg-espresso/5 relative rounded-full p-2"
      aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
      data-testid="cart-button"
    >
      <IconBag width={22} height={22} />
      {count > 0 ? (
        <span
          className="bg-copper text-foam absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold"
          data-testid="cart-count"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
