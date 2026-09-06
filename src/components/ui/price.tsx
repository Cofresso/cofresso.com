import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface PriceProps {
  cents: number;
  compareAtCents?: number | null;
  className?: string;
  suffix?: string;
}

export function Price({ cents, compareAtCents, className, suffix }: PriceProps) {
  const showCompare = typeof compareAtCents === 'number' && compareAtCents > cents;
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-medium tabular-nums">{formatPrice(cents)}</span>
      {showCompare ? (
        <span className="text-latte text-sm tabular-nums line-through">
          {formatPrice(compareAtCents)}
        </span>
      ) : null}
      {suffix ? <span className="text-latte text-sm">{suffix}</span> : null}
    </span>
  );
}
