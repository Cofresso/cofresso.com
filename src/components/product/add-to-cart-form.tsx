'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useCartDrawer } from '@/components/layout/cart-drawer-context';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { track } from '@/lib/analytics/track';
import { addToCartAction } from '@/lib/cart/actions';
import { defaultVariant } from '@/lib/catalog/types';
import type { SubscriptionInterval } from '@/lib/config';
import type { Grind, Product, ProductVariant, PurchaseType } from '@/lib/db/schema';
import { effectiveUnitPriceCents, formatPrice } from '@/lib/pricing';
import { GrindSelector } from './grind-selector';
import { PurchaseTypeToggle } from './purchase-type-toggle';
import { VariantSelector } from './variant-selector';

interface AddToCartFormProps {
  product: Pick<Product, 'id' | 'slug' | 'name' | 'category'>;
  variants: ProductVariant[];
}

export function AddToCartForm({ product, variants }: AddToCartFormProps) {
  const initial = defaultVariant(variants);
  const [variantId, setVariantId] = useState(initial?.id ?? '');
  const [grind, setGrind] = useState<Grind>('whole_bean');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('one_time');
  const [interval, setInterval] = useState<SubscriptionInterval>(4);
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState(addToCartAction, null);
  const { openDrawer } = useCartDrawer();

  const variant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? initial,
    [variants, variantId, initial],
  );
  const unitCents = variant
    ? effectiveUnitPriceCents({ unitPriceCents: variant.priceCents, quantity, purchaseType })
    : 0;
  const subscriptionCents = variant
    ? effectiveUnitPriceCents({
        unitPriceCents: variant.priceCents,
        quantity: 1,
        purchaseType: 'subscription',
      })
    : 0;
  const isCoffee = product.category === 'coffee';
  const soldOut = !variant || variant.stockQuantity <= 0;

  useEffect(() => {
    if (variant) {
      track({
        name: 'select_variant',
        item: {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          variantId: variant.id,
          variantName: variant.name,
          priceCents: unitCents,
          purchaseType,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, purchaseType]);

  useEffect(() => {
    if (state?.ok && variant) {
      track({
        name: 'add_to_cart',
        cartItemCount: state.data.itemCount,
        item: {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          variantId: variant.id,
          variantName: variant.name,
          priceCents: unitCents,
          quantity,
          purchaseType,
        },
      });
      openDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6" data-testid="add-to-cart-form">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="purchaseType" value={purchaseType} />
      <input
        type="hidden"
        name="subscriptionIntervalWeeks"
        value={purchaseType === 'subscription' ? interval : ''}
      />
      {isCoffee ? <input type="hidden" name="grind" value={grind} /> : null}

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-medium tabular-nums" data-testid="selected-price">
          {formatPrice(unitCents)}
        </span>
        {purchaseType === 'subscription' && variant ? (
          <span className="text-latte text-sm tabular-nums line-through">
            {formatPrice(variant.priceCents)}
          </span>
        ) : null}
        {variant?.weightGrams ? (
          <span className="text-latte text-sm">{variant.weightGrams} g</span>
        ) : null}
      </div>

      {variants.length > 1 || variants[0]?.name ? (
        <VariantSelector variants={variants} value={variantId} onChange={setVariantId} />
      ) : null}
      {isCoffee ? <GrindSelector value={grind} onChange={setGrind} /> : null}
      {isCoffee && variant ? (
        <PurchaseTypeToggle
          value={purchaseType}
          interval={interval}
          oneTimeCents={variant.priceCents}
          subscriptionCents={subscriptionCents}
          onChange={({ purchaseType: pt, interval: iv }) => {
            setPurchaseType(pt);
            setInterval(iv);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          max={Math.min(10, variant?.stockQuantity ?? 1)}
          disabled={soldOut}
        />
        <Button
          type="submit"
          size="lg"
          variant="copper"
          className="flex-1"
          loading={pending}
          disabled={soldOut}
          data-testid="add-to-cart"
        >
          {soldOut ? 'Sold out' : `Add to cart · ${formatPrice(unitCents * quantity)}`}
        </Button>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {variant && variant.stockQuantity > 0 && variant.stockQuantity <= 10 ? (
        <p className="text-copper-dark text-xs">Only {variant.stockQuantity} left at this size.</p>
      ) : null}
    </form>
  );
}
