'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { placeOrderAction, type CheckoutActionState } from '@/app/(checkout)/checkout/actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { track } from '@/lib/analytics/track';
import type { CartView } from '@/lib/cart/types';
import { contactSchema, paymentSchema, shippingSchema } from '@/lib/checkout/schemas';
import { TEST_CARDS } from '@/lib/payments/test-cards';
import { cn } from '@/lib/utils';
import { CardNumberInput } from './card-number-input';

type Step = 'contact' | 'shipping' | 'payment' | 'review';
const steps: Step[] = ['contact', 'shipping', 'payment', 'review'];
const titles: Record<Step, string> = {
  contact: 'Contact',
  shipping: 'Shipping address',
  payment: 'Payment',
  review: 'Review & place order',
};

type Errors = Record<string, string[] | undefined>;

export function CheckoutForm({ cart, idempotencyKey }: { cart: CartView; idempotencyKey: string }) {
  const [step, setStep] = useState<Step>('contact');
  const [errors, setErrors] = useState<Errors>({});
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    placeOrderAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.fieldErrors) {
      setErrors(state.fieldErrors);
      const keys = Object.keys(state.fieldErrors);
      if (keys.some((k) => k in contactSchema.shape)) setStep('contact');
      else if (keys.some((k) => k in shippingSchema.shape)) setStep('shipping');
      else setStep('payment');
    } else if (state?.code === 'payment_declined') {
      setStep('payment');
    }
  }, [state]);

  const values = () => Object.fromEntries(new FormData(formRef.current ?? undefined));
  const fieldError = (name: string) => errors[name]?.[0];

  const validate = (current: Step): boolean => {
    const schema =
      current === 'contact'
        ? contactSchema
        : current === 'shipping'
          ? shippingSchema
          : current === 'payment'
            ? paymentSchema
            : null;
    if (!schema) return true;
    const result = schema.safeParse(values());
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors as Errors);
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validate(step)) return;
    const idx = steps.indexOf(step);
    if (step === 'shipping')
      track({ name: 'add_shipping_info', valueCents: cart.totals.totalCents });
    if (step === 'payment') track({ name: 'add_payment_info', valueCents: cart.totals.totalCents });
    setStep(steps[Math.min(idx + 1, steps.length - 1)]);
  };

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => y + i);
  }, []);

  const section = (name: Step, children: React.ReactNode) => {
    const idx = steps.indexOf(name);
    const currentIdx = steps.indexOf(step);
    const done = idx < currentIdx;
    return (
      <section
        className={cn(
          'bg-foam rounded-2xl border p-6',
          step === name ? 'border-espresso/40' : 'border-latte/30',
        )}
        data-testid={`step-${name}`}
        aria-current={step === name ? 'step' : undefined}
      >
        <header className="flex items-center justify-between">
          <h2 className="flex items-center gap-3 text-xl">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                done
                  ? 'bg-leaf text-foam'
                  : step === name
                    ? 'bg-espresso text-foam'
                    : 'bg-latte/30 text-espresso',
              )}
            >
              {done ? '✓' : idx + 1}
            </span>
            {titles[name]}
          </h2>
          {done ? (
            <button
              type="button"
              className="text-latte text-sm underline-offset-2 hover:underline"
              onClick={() => setStep(name)}
            >
              Edit
            </button>
          ) : null}
        </header>
        {/* Inputs stay mounted (hidden) so one form submission carries every field. */}
        <div className={cn('mt-5 flex flex-col gap-4', step !== name && 'hidden')}>{children}</div>
      </section>
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      data-testid="checkout-form"
      noValidate
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {section(
        'contact',
        <>
          <Field
            label="Email"
            htmlFor="email"
            error={fieldError('email')}
            hint="Order confirmation goes here."
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(fieldError('email'))}
            />
          </Field>
          <Button
            type="button"
            onClick={next}
            className="self-start"
            data-testid="continue-contact"
          >
            Continue to shipping
          </Button>
        </>,
      )}

      {section(
        'shipping',
        <>
          <Field label="Full name" htmlFor="shippingName" error={fieldError('shippingName')}>
            <Input
              id="shippingName"
              name="shippingName"
              autoComplete="name"
              invalid={Boolean(fieldError('shippingName'))}
            />
          </Field>
          <Field label="Address" htmlFor="address1" error={fieldError('address1')}>
            <Input
              id="address1"
              name="address1"
              autoComplete="address-line1"
              invalid={Boolean(fieldError('address1'))}
            />
          </Field>
          <Field
            label="Apartment, suite, etc. (optional)"
            htmlFor="address2"
            error={fieldError('address2')}
          >
            <Input id="address2" name="address2" autoComplete="address-line2" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" htmlFor="city" error={fieldError('city')}>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                invalid={Boolean(fieldError('city'))}
              />
            </Field>
            <Field label="State" htmlFor="state" error={fieldError('state')}>
              <Input
                id="state"
                name="state"
                autoComplete="address-level1"
                invalid={Boolean(fieldError('state'))}
              />
            </Field>
            <Field label="ZIP / Postal code" htmlFor="postalCode" error={fieldError('postalCode')}>
              <Input
                id="postalCode"
                name="postalCode"
                autoComplete="postal-code"
                invalid={Boolean(fieldError('postalCode'))}
              />
            </Field>
          </div>
          <Field label="Country" htmlFor="country" error={fieldError('country')}>
            <Select id="country" name="country" defaultValue="US" autoComplete="country">
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </Select>
          </Field>
          <Button
            type="button"
            onClick={next}
            className="self-start"
            data-testid="continue-shipping"
          >
            Continue to payment
          </Button>
        </>,
      )}

      {section(
        'payment',
        <>
          <div
            className="bg-cream text-espresso/80 rounded-xl px-4 py-3 text-xs"
            data-testid="demo-notice"
          >
            <strong>Demo store.</strong> No real charges. Use{' '}
            <code className="bg-foam rounded px-1">4242 4242 4242 4242</code> to succeed or{' '}
            <code className="bg-foam rounded px-1">
              {TEST_CARDS.declined.replace(/(\d{4})(?=\d)/g, '$1 ')}
            </code>{' '}
            to see a decline.
          </div>
          <Field label="Card number" htmlFor="cardNumber" error={fieldError('cardNumber')}>
            <CardNumberInput
              id="cardNumber"
              name="cardNumber"
              invalid={Boolean(fieldError('cardNumber'))}
            />
          </Field>
          <Field label="Name on card" htmlFor="cardName" error={fieldError('cardName')}>
            <Input
              id="cardName"
              name="cardName"
              autoComplete="cc-name"
              invalid={Boolean(fieldError('cardName'))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Expiry month" htmlFor="expMonth" error={fieldError('expMonth')}>
              <Select id="expMonth" name="expMonth" defaultValue="12" autoComplete="cc-exp-month">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expiry year" htmlFor="expYear" error={fieldError('expYear')}>
              <Select
                id="expYear"
                name="expYear"
                defaultValue={String(years[3])}
                autoComplete="cc-exp-year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="CVC" htmlFor="cvc" error={fieldError('cvc')}>
              <Input
                id="cvc"
                name="cvc"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
                invalid={Boolean(fieldError('cvc'))}
              />
            </Field>
          </div>
          <Button
            type="button"
            onClick={next}
            className="self-start"
            data-testid="continue-payment"
          >
            Review order
          </Button>
        </>,
      )}

      {section(
        'review',
        <>
          <p className="text-latte text-sm">
            Double-check the summary on the right. Placing the order authorizes the simulated
            payment.
          </p>
          <Button
            type="submit"
            size="lg"
            variant="copper"
            loading={pending}
            className="self-start"
            data-testid="place-order"
          >
            Place order
          </Button>
        </>,
      )}

      {state?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="checkout-error"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
