'use client';

import type { ProductVariant } from '@/lib/db/schema';
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  value: string;
  onChange: (variantId: string) => void;
}

export function VariantSelector({ variants, value, onChange }: VariantSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Size</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {[...variants]
          .sort((a, b) => a.position - b.position)
          .map((v) => {
            const soldOut = v.stockQuantity <= 0;
            const selected = v.id === value;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={soldOut}
                onClick={() => onChange(v.id)}
                data-testid={`variant-${v.sku}`}
                className={cn(
                  'flex min-w-24 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-espresso bg-espresso text-foam'
                    : 'border-latte/50 bg-foam hover:border-espresso',
                  soldOut && 'cursor-not-allowed line-through opacity-50',
                )}
              >
                <span className="text-sm font-medium">{v.name}</span>
                <span className={cn('text-xs', selected ? 'text-foam/80' : 'text-latte')}>
                  {soldOut ? 'Sold out' : formatPrice(v.priceCents)}
                </span>
              </button>
            );
          })}
      </div>
    </fieldset>
  );
}
