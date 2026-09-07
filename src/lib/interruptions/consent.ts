/**
 * Cookie-consent record. Pure: the cookie is read and written by callers (the server
 * component via `cookies()`, the client via `document.cookie`), this module only knows the
 * wire format.
 */
export interface Consent {
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

/** The consent choices a visitor makes, before the decision is stamped. */
export type ConsentChoices = Pick<Consent, 'analytics' | 'marketing'>;

export function consentFor(choices: ConsentChoices, now: Date): Consent {
  return {
    analytics: choices.analytics,
    marketing: choices.marketing,
    decidedAt: now.toISOString(),
  };
}

export function serializeConsent(consent: Consent): string {
  return JSON.stringify({
    analytics: consent.analytics,
    marketing: consent.marketing,
    decidedAt: consent.decidedAt,
  });
}

/**
 * Parse a cookie value into a consent record, or null when there is no usable decision yet
 * (which is what makes the banner show). Accepts the percent-encoded form too: `cookies().set`
 * URL-encodes the value, so a client reading `document.cookie` sees the encoded string while
 * `cookies().get` on the server hands back the decoded one.
 */
export function parseConsent(cookieValue: string | undefined | null): Consent | null {
  if (!cookieValue) return null;
  let raw = cookieValue;
  if (raw.includes('%')) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { analytics, marketing, decidedAt } = parsed as Record<string, unknown>;
  if (typeof analytics !== 'boolean') return null;
  if (typeof marketing !== 'boolean') return null;
  if (typeof decidedAt !== 'string' || decidedAt === '') return null;
  return { analytics, marketing, decidedAt };
}
