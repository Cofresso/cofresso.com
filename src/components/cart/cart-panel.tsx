'use client';

import { ButtonLink } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';
import type { CartView } from '@/lib/cart/types';
import { siteConfig } from '@/lib/config';
import { CartLine } from './cart-line';
import { CartSummary } from './cart-summary';
import { EmptyCart } from './empty-cart';
import { FreeShippingBar } from './free-shipping-bar';
import { PromoCodeForm } from './promo-code-form';

interface CartPanelProps {
  cart: CartView | null;
  mode: 'drawer' | 'page';
  onNavigate?: () => void;
}

export function CartPanel({ cart, mode, onNavigate }: CartPanelProps) {
  if (!cart || cart.lines.length === 0) return <EmptyCart onNavigate={onNavigate} />;

  const beginCheckout = () => {
    track({
      name: 'begin_checkout',
      valueCents: cart.totals.totalCents,
      itemCount: cart.totals.itemCount,
    });
    onNavigate?.();
  };

  const lines = (
    <ul className="divide-latte/20 divide-y" data-testid="cart-lines">
      {cart.lines.map((line) => (
        <CartLine key={line.id} line={line} compact={mode === 'drawer'} />
      ))}
    </ul>
  );

  const aside = (
    <div className="flex flex-col gap-4">
      <FreeShippingBar
        remainingCents={cart.totals.freeShippingRemainingCents}
        unlocked={cart.totals.freeShippingUnlocked}
        thresholdCents={siteConfig.pricing.freeShippingThresholdCents}
      />
      <PromoCodeForm appliedCode={cart.discountCode} message={cart.discountMessage} />
      <CartSummary
        totals={cart.totals}
        discountCode={cart.discountCode}
        compact={mode === 'drawer'}
      />
      <ButtonLink
        href="/checkout"
        size="lg"
        variant="copper"
        className="w-full"
        onClick={beginCheckout}
        data-testid="checkout-link"
      >
        Checkout
      </ButtonLink>
      {mode === 'drawer' ? (
        <ButtonLink href="/cart" variant="ghost" size="sm" onClick={onNavigate}>
          View full cart
        </ButtonLink>
      ) : null}
    </div>
  );

  if (mode === 'drawer') {
    return (
      <div className="flex flex-col gap-6 px-5 py-2">
        {lines}
        {aside}
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>{lines}</div>
      <aside className="bg-foam rounded-2xl p-6 shadow-sm lg:sticky lg:top-28">{aside}</aside>
    </div>
  );
}
