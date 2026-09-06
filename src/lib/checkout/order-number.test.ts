import { describe, expect, it } from 'vitest';
import { formatOrderNumber, isOrderNumber, normalizeOrderNumber } from './order-number';

describe('order numbers', () => {
  it('formats with the CF prefix and 5+ digits', () => {
    expect(formatOrderNumber(10001)).toBe('CF-10001');
    expect(formatOrderNumber(123456)).toBe('CF-123456');
  });
  it('validates and normalises user input', () => {
    expect(isOrderNumber('CF-10001')).toBe(true);
    expect(isOrderNumber('cf-10001')).toBe(true);
    expect(isOrderNumber('10001')).toBe(false);
    expect(normalizeOrderNumber(' cf-10001 ')).toBe('CF-10001');
  });
});
