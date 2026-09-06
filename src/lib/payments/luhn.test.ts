import { describe, expect, it } from 'vitest';
import { luhnCheck, normalizeCardNumber } from './luhn';

describe('luhn', () => {
  it('accepts valid numbers with or without spaces', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
    expect(luhnCheck('4000000000000002')).toBe(true);
    expect(luhnCheck('5555 5555 5555 4444')).toBe(true);
  });
  it('rejects invalid numbers and garbage', () => {
    expect(luhnCheck('4242 4242 4242 4241')).toBe(false);
    expect(luhnCheck('1234')).toBe(false);
    expect(luhnCheck('abcd')).toBe(false);
    expect(luhnCheck('')).toBe(false);
  });
  it('normalizes by stripping non-digits', () => {
    expect(normalizeCardNumber('4242-4242 4242.4242')).toBe('4242424242424242');
  });
});
