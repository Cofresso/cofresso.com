import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { OrderSummary } from '@/components/checkout/order-summary';
import { Container } from '@/components/ui/container';
import { readCartId } from '@/lib/cart/cookie';
import { getCartView } from '@/lib/cart/queries';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const cartId = await readCartId();
  const cart = cartId ? await getCartView(cartId) : null;
  if (!cart || cart.lines.length === 0) redirect('/cart');

  return (
    <Container className="py-12">
      <h1 className="mb-8 text-4xl">Checkout</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <CheckoutForm cart={cart} idempotencyKey={randomUUID()} />
        <OrderSummary cart={cart} />
      </div>
    </Container>
  );
}
