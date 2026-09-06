import { describe, expect, it } from 'vitest';
import { evaluateDiscountCode, type DiscountCodeLike } from './discounts';

const base: DiscountCodeLike = {
  code: 'WELCOME10',
  kind: 'percent',
  value: 10,
  minSubtotalCents: 0,
  active: true,
  startsAt: null,
  expiresAt: null,
};
const now = new Date('2026-09-06T12:00:00Z');

describe('evaluateDiscountCode', () => {
  it('returns a rule for a valid code', () => {
    expect(evaluateDiscountCode(base, 5000, now)).toEqual({
      ok: true,
      rule: { kind: 'percent', value: 10, minSubtotalCents: 0 },
    });
  });
  it('rejects inactive codes', () => {
    expect(evaluateDiscountCode({ ...base, active: false }, 5000, now)).toMatchObject({
      ok: false,
      reason: 'inactive',
    });
  });
  it('rejects codes that have not started or have expired', () => {
    expect(
      evaluateDiscountCode({ ...base, startsAt: new Date('2027-01-01') }, 5000, now),
    ).toMatchObject({ ok: false, reason: 'not_started' });
    expect(
      evaluateDiscountCode({ ...base, expiresAt: new Date('2026-01-01') }, 5000, now),
    ).toMatchObject({ ok: false, reason: 'expired' });
  });
  it('enforces the minimum subtotal with a helpful message', () => {
    const r = evaluateDiscountCode({ ...base, minSubtotalCents: 3000 }, 2500, now);
    expect(r).toMatchObject({ ok: false, reason: 'min_subtotal' });
    if (!r.ok) expect(r.message).toContain('$30.00');
  });
});
