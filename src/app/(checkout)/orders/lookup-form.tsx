'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { lookupOrderAction } from './actions';

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookupOrderAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4" data-testid="lookup-form">
      <Field label="Order number" htmlFor="orderNumber" error={errors.orderNumber}>
        <Input id="orderNumber" name="orderNumber" placeholder="CF-10001" autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Button type="submit" loading={pending} className="self-start">
        Find my order
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-red-700" data-testid="lookup-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
