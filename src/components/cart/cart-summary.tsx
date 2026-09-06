import { formatPrice, type Totals } from '@/lib/pricing';

interface CartSummaryProps {
  totals: Totals;
  discountCode?: string | null;
  compact?: boolean;
}

export function CartSummary({ totals, discountCode, compact = false }: CartSummaryProps) {
  const row = 'flex items-center justify-between text-sm';
  return (
    <dl className="flex flex-col gap-2" data-testid="cart-summary">
      <div className={row}>
        <dt>Subtotal</dt>
        <dd className="tabular-nums" data-testid="summary-subtotal">
          {formatPrice(totals.subtotalCents)}
        </dd>
      </div>
      {totals.subscriptionSavingsCents > 0 ? (
        <div className={`${row} text-leaf`}>
          <dt>Subscription savings</dt>
          <dd className="tabular-nums">−{formatPrice(totals.subscriptionSavingsCents)}</dd>
        </div>
      ) : null}
      {totals.discountCents > 0 ? (
        <div className={`${row} text-leaf`}>
          <dt>Discount{discountCode ? ` (${discountCode})` : ''}</dt>
          <dd className="tabular-nums" data-testid="summary-discount">
            −{formatPrice(totals.discountCents)}
          </dd>
        </div>
      ) : null}
      {!compact ? (
        <>
          <div className={row}>
            <dt>Shipping</dt>
            <dd className="tabular-nums" data-testid="summary-shipping">
              {totals.shippingCents === 0 ? 'Free' : formatPrice(totals.shippingCents)}
            </dd>
          </div>
          <div className={row}>
            <dt>Estimated tax</dt>
            <dd className="tabular-nums">{formatPrice(totals.taxCents)}</dd>
          </div>
        </>
      ) : null}
      <div className="border-latte/30 mt-1 flex items-center justify-between border-t pt-3 text-base font-semibold">
        <dt>{compact ? 'Estimated total' : 'Total'}</dt>
        <dd className="tabular-nums" data-testid="summary-total">
          {formatPrice(totals.totalCents)}
        </dd>
      </div>
    </dl>
  );
}
