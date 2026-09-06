'use client';

import { useId, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ProductVariant } from '@/lib/db/schema';
import { formatPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  value: string;
  onChange: (variantId: string) => void;
}

export function VariantSelector({ variants, value, onChange }: VariantSelectorProps) {
  const legendId = useId();
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sorted = useMemo(() => [...variants].sort((a, b) => a.position - b.position), [variants]);
  const enabledIds = sorted.filter((v) => v.stockQuantity > 0).map((v) => v.id);
  const rovingId = enabledIds.includes(value) ? value : enabledIds[0];

  function selectAndFocus(variantId: string) {
    onChange(variantId);
    buttonRefs.current.get(variantId)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let direction = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') direction = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') direction = -1;
    else return;
    event.preventDefault();
    let next = index;
    for (let step = 0; step < sorted.length; step += 1) {
      next = (next + direction + sorted.length) % sorted.length;
      const candidate = sorted[next];
      if (candidate.stockQuantity > 0) {
        selectAndFocus(candidate.id);
        return;
      }
    }
  }

  return (
    <fieldset>
      <legend id={legendId} className="mb-2 text-sm font-medium">
        Size
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={legendId}>
        {sorted.map((v, index) => {
          const soldOut = v.stockQuantity <= 0;
          const selected = v.id === value;
          return (
            <button
              key={v.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(v.id, el);
                else buttonRefs.current.delete(v.id);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={v.id === rovingId ? 0 : -1}
              disabled={soldOut}
              onClick={() => onChange(v.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
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
