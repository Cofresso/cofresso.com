import { interruptionsConfig } from './config';

/**
 * The email-capture popup remembers a decision in localStorage so it does not reappear on
 * every page view. Pure helpers only — the component owns the storage access.
 */
export interface PopupSuppression {
  state: 'dismissed' | 'subscribed';
  until: string;
}

/**
 * Where the record lives. Kept here beside the serializer rather than in the component so the
 * e2e helpers can seed it without importing a `'use client'` module.
 */
export const POPUP_STORAGE_KEY = 'cofresso:popup';

const STATES: readonly PopupSuppression['state'][] = ['dismissed', 'subscribed'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the popup must never appear: nothing may get between a visitor and checkout. */
export function isPopupExcludedPath(pathname: string): boolean {
  return interruptionsConfig.popup.excludedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function suppressionFor(state: PopupSuppression['state'], now: Date): PopupSuppression {
  return {
    state,
    until: new Date(now.getTime() + interruptionsConfig.popup.suppressDays * DAY_MS).toISOString(),
  };
}

export function shouldShowPopup(
  record: PopupSuppression | null,
  now: Date,
  pathname: string,
): boolean {
  if (isPopupExcludedPath(pathname)) return false;
  if (!record) return true;
  const until = Date.parse(record.until);
  // An expiry we cannot read is treated as expired rather than as "suppressed forever".
  if (Number.isNaN(until)) return true;
  return until <= now.getTime();
}

export function serializeSuppression(record: PopupSuppression): string {
  return JSON.stringify({ state: record.state, until: record.until });
}

export function parseSuppression(raw: string | undefined | null): PopupSuppression | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { state, until } = parsed as Record<string, unknown>;
  if (typeof state !== 'string' || !STATES.includes(state as PopupSuppression['state']))
    return null;
  if (typeof until !== 'string' || until === '') return null;
  return { state: state as PopupSuppression['state'], until };
}
