import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderDetails } from '@/components/checkout/order-details';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getOrderForConfirmation } from '@/lib/checkout/queries';

export const metadata: Metadata = { title: 'Order details', robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderForConfirmation(orderNumber, t ?? '');
  if (!order) notFound();
  return (
    <Container className="py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
            Orders
          </p>
          <h1 className="text-4xl">Your order</h1>
        </div>
        <ButtonLink href="/orders" variant="outline">
          Look up another
        </ButtonLink>
      </div>
      <OrderDetails order={order} />
    </Container>
  );
}
