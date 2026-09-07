import { describe, expect, it } from 'vitest';
import { interruptionsConfig } from './config';
import { buildToastSequence, TOAST_CITIES, TOAST_PRODUCTS } from './toasts';

describe('buildToastSequence', () => {
  it('is deterministic', () => {
    expect(buildToastSequence(3)).toEqual(buildToastSequence(3));
  });

  it('builds the social-proof copy from a city and a product', () => {
    const [first] = buildToastSequence(1);
    expect(first.message).toBe(`Someone in ${first.city} just bought ${first.product}`);
    expect(TOAST_CITIES).toContain(first.city);
    expect(TOAST_PRODUCTS).toContain(first.product);
  });

  it('gives every toast a stable unique id', () => {
    const toasts = buildToastSequence(3);
    expect(toasts.map((t) => t.id)).toEqual(['social-proof-0', 'social-proof-1', 'social-proof-2']);
  });

  it('varies the city and the product between consecutive toasts', () => {
    const toasts = buildToastSequence(3);
    expect(new Set(toasts.map((t) => t.city)).size).toBe(3);
    expect(new Set(toasts.map((t) => t.product)).size).toBe(3);
  });

  it('caps the sequence at maxPerSession', () => {
    expect(interruptionsConfig.toasts.maxPerSession).toBe(3);
    expect(buildToastSequence(99)).toHaveLength(3);
    expect(buildToastSequence(99)).toEqual(buildToastSequence(3));
  });

  it('handles zero and negative counts', () => {
    expect(buildToastSequence(0)).toEqual([]);
    expect(buildToastSequence(-1)).toEqual([]);
  });

  it('only names products from the seeded catalog', () => {
    expect(TOAST_PRODUCTS).toContain('Morning Frame');
    expect(TOAST_PRODUCTS.length).toBeGreaterThan(interruptionsConfig.toasts.maxPerSession);
  });
});
