import type { Metadata } from 'next';
import { CartPanel } from '@/components/cart/cart-panel';
import { Container } from '@/components/ui/container';
import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';
import { CartPageTracker } from './tracker';

export const metadata: Metadata = { title: 'Your cart' };

export default async function CartPage() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  return (
    <Container className="py-12">
      <h1 className="mb-8 text-4xl">Your cart</h1>
      <CartPanel cart={cart} mode="page" />
      <CartPageTracker
        valueCents={cart?.totals.totalCents ?? 0}
        itemCount={cart?.totals.itemCount ?? 0}
      />
    </Container>
  );
}
