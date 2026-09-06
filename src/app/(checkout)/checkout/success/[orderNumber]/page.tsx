import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderDetails } from '@/components/checkout/order-details';
import { TrackPurchase } from '@/components/checkout/track-purchase';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getOrderForConfirmation } from '@/lib/checkout/queries';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

export default async function SuccessPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderForConfirmation(orderNumber, t ?? '');
  if (!order) notFound();

  return (
    <Container className="py-12">
      <div className="mb-10 max-w-2xl">
        <p className="text-leaf mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
          Order confirmed
        </p>
        <h1 className="text-4xl sm:text-5xl" data-testid="success-title">
          Thank you, {order.shipping.name.split(' ')[0]}.
        </h1>
        <p className="text-latte mt-3">
          We roast your coffee next and ship within 48 hours. Keep this link to check on your order
          any time, or look it up with your order number and email.
        </p>
        <div className="mt-6 flex gap-3">
          <ButtonLink href="/shop">Continue shopping</ButtonLink>
          <ButtonLink href="/brew-guides" variant="outline">
            Brew guides
          </ButtonLink>
        </div>
      </div>
      <OrderDetails order={order} />
      <TrackPurchase order={order} />
    </Container>
  );
}
