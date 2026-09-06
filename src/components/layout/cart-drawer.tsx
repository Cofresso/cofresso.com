import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';
import { CartDrawerShell } from './cart-drawer-shell';

export async function CartDrawer() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  return <CartDrawerShell cart={cart} />;
}
