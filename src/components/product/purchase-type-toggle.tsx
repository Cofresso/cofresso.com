'use client';

import { Select } from '@/components/ui/select';
import { intervalLabel } from '@/lib/catalog/labels';
import { siteConfig, type SubscriptionInterval } from '@/lib/config';
import type { PurchaseType } from '@/lib/db/schema';
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface PurchaseTypeToggleProps {
  value: PurchaseType;
  interval: SubscriptionInterval;
  oneTimeCents: number;
  subscriptionCents: number;
  onChange: (next: { purchaseType: PurchaseType; interval: SubscriptionInterval }) => void;
}

export function PurchaseTypeToggle({
  value,
  interval,
  oneTimeCents,
  subscriptionCents,
  onChange,
}: PurchaseTypeToggleProps) {
  const option = (type: PurchaseType, title: string, price: number, hint: string) => {
    const selected = value === type;
    return (
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
          selected
            ? 'border-copper bg-copper/5'
            : 'border-latte/50 bg-foam hover:border-espresso/50',
        )}
      >
        <input
          type="radio"
          name="purchaseTypeChoice"
          className="accent-copper mt-1"
          checked={selected}
          onChange={() => onChange({ purchaseType: type, interval })}
          aria-label={title}
        />
        <span className="flex flex-1 flex-col">
          <span className="flex items-center justify-between text-sm font-medium">
            <span>{title}</span>
            <span className="tabular-nums">{formatPrice(price)}</span>
          </span>
          <span className="text-latte text-xs">{hint}</span>
        </span>
      </label>
    );
  };

  return (
    <fieldset className="flex flex-col gap-2" data-testid="purchase-type">
      <legend className="mb-2 text-sm font-medium">Purchase</legend>
      {option('one_time', 'One-time purchase', oneTimeCents, 'Ships within 48 hours of roasting.')}
      {option(
        'subscription',
        `Subscribe & save ${siteConfig.pricing.subscriptionDiscountPercent}%`,
        subscriptionCents,
        'Pause, skip or cancel anytime. Free shipping on every subscription order over $45.',
      )}
      {value === 'subscription' ? (
        <Select
          aria-label="Delivery interval"
          value={interval}
          onChange={(e) =>
            onChange({
              purchaseType: 'subscription',
              interval: Number(e.target.value) as SubscriptionInterval,
            })
          }
          data-testid="interval-select"
        >
          {siteConfig.subscriptionIntervals.map((weeks) => (
            <option key={weeks} value={weeks}>
              {intervalLabel(weeks)}
            </option>
          ))}
        </Select>
      ) : null}
    </fieldset>
  );
}
