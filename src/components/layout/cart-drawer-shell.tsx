'use client';

import { Sheet } from '@/components/ui/sheet';
import { CartPanel } from '@/components/cart/cart-panel';
import type { CartView } from '@/lib/cart/types';
import { useCartDrawer } from './cart-drawer-context';

export function CartDrawerShell({ cart }: { cart: CartView | null }) {
  const { open, closeDrawer } = useCartDrawer();
  const count = cart?.totals.itemCount ?? 0;
  return (
    <Sheet
      open={open}
      onClose={closeDrawer}
      title={count ? `Your cart (${count})` : 'Your cart'}
      testId="cart-drawer"
    >
      <CartPanel cart={cart} mode="drawer" onNavigate={closeDrawer} />
    </Sheet>
  );
}
