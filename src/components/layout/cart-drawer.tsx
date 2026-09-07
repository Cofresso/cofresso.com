import { getCurrentCart } from '@/lib/cart/request-cache';
import { CartDrawerShell } from './cart-drawer-shell';

export async function CartDrawer() {
  const cart = await getCurrentCart();
  return <CartDrawerShell cart={cart} />;
}
