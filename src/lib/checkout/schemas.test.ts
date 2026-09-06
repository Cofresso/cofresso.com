import { describe, expect, it } from 'vitest';
import { checkoutSchema, shippingSchema } from './schemas';

const valid = {
  email: 'ada@example.com',
  shippingName: 'Ada Lovelace',
  address1: '1 Analytical Way',
  address2: '',
  city: 'London',
  state: 'CA',
  postalCode: '94110',
  country: 'US',
  cardNumber: '4242 4242 4242 4242',
  cardName: 'Ada Lovelace',
  expMonth: '12',
  expYear: '2030',
  cvc: '123',
  idempotencyKey: '3f2d0d3e-2f4a-4a7e-9d5b-4c6c1d2f3a4b',
};

describe('checkoutSchema', () => {
  it('coerces and normalises a valid payload', () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expMonth).toBe(12);
      expect(r.data.expYear).toBe(2030);
      expect(r.data.address2).toBeUndefined();
      expect(r.data.email).toBe('ada@example.com');
    }
  });
  it('rejects a bad email and a short postal code', () => {
    expect(checkoutSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(shippingSchema.safeParse({ ...valid, postalCode: '12' }).success).toBe(false);
  });
  it('rejects a Luhn-invalid card at the schema level', () => {
    expect(checkoutSchema.safeParse({ ...valid, cardNumber: '4242 4242 4242 4241' }).success).toBe(
      false,
    );
  });
});
