import type { DiscountRule } from './types';

export interface DiscountCodeLike {
  code: string;
  kind: DiscountRule['kind'];
  value: number;
  minSubtotalCents: number;
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
}

export type DiscountFailure = 'inactive' | 'not_started' | 'expired' | 'min_subtotal';

export type DiscountEvaluation =
  { ok: true; rule: DiscountRule } | { ok: false; reason: DiscountFailure; message: string };

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function evaluateDiscountCode(
  code: DiscountCodeLike,
  subtotalCents: number,
  now = new Date(),
): DiscountEvaluation {
  if (!code.active)
    return { ok: false, reason: 'inactive', message: 'That code is no longer active.' };
  if (code.startsAt && code.startsAt > now)
    return { ok: false, reason: 'not_started', message: 'That code is not active yet.' };
  if (code.expiresAt && code.expiresAt < now)
    return { ok: false, reason: 'expired', message: 'That code has expired.' };
  if (subtotalCents < code.minSubtotalCents) {
    return {
      ok: false,
      reason: 'min_subtotal',
      message: `Spend at least ${usd.format(code.minSubtotalCents / 100)} to use ${code.code}.`,
    };
  }
  return {
    ok: true,
    rule: { kind: code.kind, value: code.value, minSubtotalCents: code.minSubtotalCents },
  };
}
