import { describe, expect, it } from 'vitest';
import { consentFor, parseConsent, serializeConsent, type Consent } from './consent';

const consent: Consent = {
  analytics: true,
  marketing: false,
  decidedAt: '2026-09-06T12:34:56.000Z',
};

describe('serializeConsent / parseConsent', () => {
  it('round trips a consent record', () => {
    expect(parseConsent(serializeConsent(consent))).toEqual(consent);
  });

  it('round trips a percent-encoded value (how the browser stores it)', () => {
    expect(parseConsent(encodeURIComponent(serializeConsent(consent)))).toEqual(consent);
  });

  it('returns null for a missing cookie', () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent('')).toBeNull();
  });

  it('returns null for malformed values', () => {
    expect(parseConsent('not json')).toBeNull();
    expect(parseConsent('[]')).toBeNull();
    expect(parseConsent('null')).toBeNull();
    expect(parseConsent('"yes"')).toBeNull();
    expect(parseConsent('%')).toBeNull();
  });

  it('returns null when fields are missing or the wrong type', () => {
    expect(parseConsent(JSON.stringify({ analytics: true, marketing: false }))).toBeNull();
    expect(
      parseConsent(JSON.stringify({ analytics: 'yes', marketing: false, decidedAt: 'x' })),
    ).toBeNull();
    expect(
      parseConsent(JSON.stringify({ analytics: true, marketing: false, decidedAt: 1 })),
    ).toBeNull();
  });

  it('ignores unknown fields', () => {
    expect(parseConsent(JSON.stringify({ ...consent, extra: 'nope' }))).toEqual(consent);
  });
});

describe('consentFor', () => {
  it('stamps the decision time', () => {
    expect(
      consentFor({ analytics: false, marketing: true }, new Date('2026-09-06T12:34:56.000Z')),
    ).toEqual({ analytics: false, marketing: true, decidedAt: '2026-09-06T12:34:56.000Z' });
  });
});
