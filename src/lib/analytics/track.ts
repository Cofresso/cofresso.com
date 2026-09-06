import type { AnalyticsEvent, TrackedEvent } from './events';

export const MAX_BUFFERED_EVENTS = 200;
export const EVENT_NAME = 'cofresso:event';

/**
 * Client-side event sink. Buffers on `window.cofresso.events` and dispatches a
 * `cofresso:event` CustomEvent so any SDK (Coframe, GTM, etc.) can subscribe
 * without this codebase depending on it. Safe to call on the server (no-op).
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const tracked: TrackedEvent = { event, timestamp: new Date().toISOString() };
  window.cofresso ??= { events: [] };
  window.cofresso.events.push(tracked);
  if (window.cofresso.events.length > MAX_BUFFERED_EVENTS) {
    window.cofresso.events.splice(0, window.cofresso.events.length - MAX_BUFFERED_EVENTS);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: tracked }));
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event.name, event);
  }
}
