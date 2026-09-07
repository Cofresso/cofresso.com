import { describe, expect, it } from 'vitest';
import { interruptionsConfig } from './config';
import {
  isPopupExcludedPath,
  parseSuppression,
  serializeSuppression,
  shouldShowPopup,
  suppressionFor,
  type PopupSuppression,
} from './suppression';

const now = new Date('2026-09-06T12:00:00.000Z');
const record = (state: PopupSuppression['state'], until: string): PopupSuppression => ({
  state,
  until,
});

describe('isPopupExcludedPath', () => {
  it('excludes checkout and orders, including nested routes', () => {
    expect(isPopupExcludedPath('/checkout')).toBe(true);
    expect(isPopupExcludedPath('/checkout/success/CF-10001')).toBe(true);
    expect(isPopupExcludedPath('/orders')).toBe(true);
    expect(isPopupExcludedPath('/orders/CF-10001')).toBe(true);
  });

  it('allows every other route', () => {
    for (const path of ['/', '/shop', '/cart', '/products/morning-frame', '/about'])
      expect(isPopupExcludedPath(path)).toBe(false);
  });
});

describe('shouldShowPopup', () => {
  it('shows the popup with no stored record', () => {
    expect(shouldShowPopup(null, now, '/')).toBe(true);
  });

  it('never shows the popup on an excluded route', () => {
    expect(shouldShowPopup(null, now, '/checkout')).toBe(false);
    expect(shouldShowPopup(null, now, '/orders/CF-10001')).toBe(false);
  });

  it('hides the popup while a dismissal is still current', () => {
    expect(shouldShowPopup(record('dismissed', '2026-09-13T12:00:00.000Z'), now, '/')).toBe(false);
    expect(shouldShowPopup(record('subscribed', '2026-09-13T12:00:00.000Z'), now, '/')).toBe(false);
  });

  it('shows the popup again once the suppression has expired', () => {
    expect(shouldShowPopup(record('dismissed', '2026-09-06T11:59:59.999Z'), now, '/')).toBe(true);
  });

  it('treats an unparseable expiry as expired', () => {
    expect(shouldShowPopup(record('dismissed', 'whenever'), now, '/')).toBe(true);
  });
});

describe('suppressionFor', () => {
  it('expires suppressDays after the decision', () => {
    expect(suppressionFor('subscribed', now)).toEqual({
      state: 'subscribed',
      until: '2026-09-13T12:00:00.000Z',
    });
    expect(interruptionsConfig.popup.suppressDays).toBe(7);
  });
});

describe('serializeSuppression / parseSuppression', () => {
  it('round trips', () => {
    const value = suppressionFor('dismissed', now);
    expect(parseSuppression(serializeSuppression(value))).toEqual(value);
  });

  it('returns null for missing or malformed storage', () => {
    expect(parseSuppression(null)).toBeNull();
    expect(parseSuppression(undefined)).toBeNull();
    expect(parseSuppression('{')).toBeNull();
    expect(parseSuppression('[]')).toBeNull();
    expect(
      parseSuppression(JSON.stringify({ state: 'nope', until: now.toISOString() })),
    ).toBeNull();
    expect(parseSuppression(JSON.stringify({ state: 'dismissed' }))).toBeNull();
  });
});
