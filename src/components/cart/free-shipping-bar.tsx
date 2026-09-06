import { IconTruck } from '@/components/ui/icons';
import { formatPrice } from '@/lib/pricing';

export function FreeShippingBar({
  remainingCents,
  unlocked,
  thresholdCents,
}: {
  remainingCents: number;
  unlocked: boolean;
  thresholdCents: number;
}) {
  const progress = unlocked
    ? 100
    : Math.min(100, Math.round(((thresholdCents - remainingCents) / thresholdCents) * 100));
  return (
    <div
      className="bg-cream rounded-xl p-4"
      data-testid="free-shipping-bar"
      data-unlocked={unlocked}
    >
      <p className="flex items-center gap-2 text-sm">
        <IconTruck className="text-copper" />
        {unlocked ? (
          <span className="text-leaf font-medium">You unlocked free shipping.</span>
        ) : (
          <span>
            Add <strong>{formatPrice(remainingCents)}</strong> more for free shipping.
          </span>
        )}
      </p>
      <div
        className="bg-latte/30 mt-3 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-copper h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
