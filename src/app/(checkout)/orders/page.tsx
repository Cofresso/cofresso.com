import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { LookupForm } from './lookup-form';

export const metadata: Metadata = { title: 'Track an order' };

export default function OrdersPage() {
  return (
    <Container className="py-12">
      <div className="max-w-md">
        <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">Orders</p>
        <h1 className="text-4xl">Track an order</h1>
        <p className="text-latte mt-3">
          Enter your order number and the email you used at checkout.
        </p>
        <LookupForm />
      </div>
    </Container>
  );
}
