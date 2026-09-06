'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics/track';
import { applyPromoAction, removePromoAction } from '@/lib/cart/actions';

interface PromoCodeFormProps {
  appliedCode: string | null;
  message?: string | null;
}

export function PromoCodeForm({ appliedCode, message }: PromoCodeFormProps) {
  const [state, formAction, pending] = useActionState(applyPromoAction, null);
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state)
      track({
        name: 'apply_promo',
        code: state.ok ? state.data.code : 'unknown',
        success: state.ok,
      });
  }, [state]);

  if (appliedCode) {
    return (
      <div
        className="border-leaf/60 bg-leaf/5 flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm"
        data-testid="promo-applied"
      >
        <span>
          Code <strong>{appliedCode}</strong> applied
          {message ? <span className="text-copper-dark block text-xs">{message}</span> : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          loading={removing}
          onClick={() => startRemove(async () => void (await removePromoAction()))}
        >
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1" data-testid="promo-form">
      <div className="flex gap-2">
        <Input
          name="code"
          placeholder="Promo code"
          aria-label="Promo code"
          autoComplete="off"
          className="h-10 uppercase"
        />
        <Button type="submit" variant="outline" size="sm" className="h-10" loading={pending}>
          Apply
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-xs text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
