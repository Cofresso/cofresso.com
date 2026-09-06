import { describe, expect, it } from 'vitest';
import { grindLabel, intervalLabel, purchaseTypeLabel, roastLabel } from './labels';

describe('labels', () => {
  it('humanises enums', () => {
    expect(grindLabel('whole_bean')).toBe('Whole bean');
    expect(grindLabel('french_press')).toBe('French press');
    expect(grindLabel(null)).toBe('');
    expect(roastLabel('medium_dark')).toBe('Medium-dark');
    expect(intervalLabel(4)).toBe('Every 4 weeks');
    expect(purchaseTypeLabel('subscription', 2)).toBe('Subscription · Every 2 weeks');
    expect(purchaseTypeLabel('one_time', null)).toBe('One-time');
  });
});
