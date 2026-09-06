'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { track } from '@/lib/analytics/track';
import { removeCartLineAction, updateCartLineAction } from '@/lib/cart/actions';
import type { CartLine as CartLineData } from '@/lib/cart/types';
import { grindLabel, purchaseTypeLabel } from '@/lib/catalog/labels';
import { formatPrice } from '@/lib/pricing';

export function CartLine({ line, compact = false }: { line: CartLineData; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const update = (quantity: number) =>
    start(async () => {
      setError(null);
      const result = await updateCartLineAction(line.id, quantity);
      if (!result.ok) setError(result.error);
    });

  const remove = () =>
    start(async () => {
      track({
        name: 'remove_from_cart',
        item: {
          productId: line.product.id,
          slug: line.product.slug,
          name: line.product.name,
          variantId: line.variant.id,
          variantName: line.variant.name,
          priceCents: line.effectiveUnitPriceCents,
          quantity: line.quantity,
        },
      });
      const result = await removeCartLineAction(line.id);
      if (!result.ok) setError(result.error);
    });

  const details = [
    line.variant.name,
    grindLabel(line.grind),
    purchaseTypeLabel(line.purchaseType, line.subscriptionIntervalWeeks),
  ].filter(Boolean);

  return (
    <li className="flex gap-4 py-4" data-testid="cart-line" data-line-id={line.id}>
      <Link
        href={`/products/${line.product.slug}`}
        className="bg-cream shrink-0 overflow-hidden rounded-lg"
      >
        <Image
          src={line.product.imagePath}
          alt={line.product.name}
          width={compact ? 72 : 96}
          height={compact ? 90 : 120}
          unoptimized
          className="h-auto w-[72px] sm:w-24"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/products/${line.product.slug}`} className="hover:text-copper font-medium">
              {line.product.name}
            </Link>
            <p className="text-latte text-xs">{details.join(' · ')}</p>
          </div>
          <p className="text-sm font-medium tabular-nums" data-testid="line-total">
            {formatPrice(line.lineTotalCents)}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            onChange={update}
            disabled={pending}
            max={Math.min(10, line.variant.stockQuantity)}
          />
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-latte hover:text-espresso text-xs underline-offset-2 hover:underline"
          >
            Remove
          </button>
        </div>
        {error ? (
          <p className="text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
