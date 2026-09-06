import { describe, expect, it } from 'vitest';
import { SimulatedPaymentProvider, TEST_CARDS } from './simulated';
import type { CardInput } from './types';

const now = () => new Date('2026-09-06T00:00:00Z');
const provider = new SimulatedPaymentProvider({ now });
const card = (number: string, overrides: Partial<CardInput> = {}): CardInput => ({
  number,
  expMonth: 12,
  expYear: 2030,
  cvc: '123',
  name: 'Ada Lovelace',
  ...overrides,
});
const authorize = (c: CardInput) =>
  provider.authorize({ amountCents: 4488, currency: 'USD', card: c, idempotencyKey: 'key-1' });

describe('SimulatedPaymentProvider', () => {
  it('approves the standard test card and returns last4', async () => {
    const r = await authorize(card(TEST_CARDS.approved));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reference).toMatch(/^sim_[a-z0-9]+$/);
      expect(r.last4).toBe('4242');
    }
  });
  it('maps the decline test cards', async () => {
    await expect(authorize(card(TEST_CARDS.declined))).resolves.toMatchObject({
      ok: false,
      code: 'declined',
    });
    await expect(authorize(card(TEST_CARDS.insufficientFunds))).resolves.toMatchObject({
      ok: false,
      code: 'insufficient_funds',
    });
    await expect(authorize(card(TEST_CARDS.processingError))).resolves.toMatchObject({
      ok: false,
      code: 'processing_error',
    });
  });
  it('rejects invalid card data', async () => {
    await expect(authorize(card('4242 4242 4242 4241'))).resolves.toMatchObject({
      ok: false,
      code: 'invalid_card',
    });
    await expect(authorize(card(TEST_CARDS.approved, { expYear: 2020 }))).resolves.toMatchObject({
      ok: false,
      code: 'invalid_card',
    });
    await expect(authorize(card(TEST_CARDS.approved, { cvc: '1' }))).resolves.toMatchObject({
      ok: false,
      code: 'invalid_card',
    });
    await expect(authorize(card(TEST_CARDS.approved, { expMonth: 13 }))).resolves.toMatchObject({
      ok: false,
      code: 'invalid_card',
    });
  });
  it('approves any other Luhn-valid card', async () => {
    const r = await authorize(card('5555 5555 5555 4444'));
    expect(r.ok).toBe(true);
  });
  it('rejects a card expiring this month last month', async () => {
    const r = await authorize(card(TEST_CARDS.approved, { expMonth: 8, expYear: 2026 }));
    expect(r).toMatchObject({ ok: false, code: 'invalid_card' });
    const ok = await authorize(card(TEST_CARDS.approved, { expMonth: 9, expYear: 2026 }));
    expect(ok.ok).toBe(true);
  });
});
