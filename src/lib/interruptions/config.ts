/**
 * Timings and toggles for the deliberate UI interruptions (email capture popup, cookie
 * banner, chat bubble, social-proof toasts, announcement rotator, deferred sections).
 *
 * These exist on purpose: Cofresso is the fixture Coframe uses to exercise computer-use QA
 * agents, and a storefront without an overlay in the way is not a realistic fixture. Keep
 * every value here rather than inline in components so tests can reason about the timeline,
 * and set `UX_INTERRUPTIONS=off` to turn the whole lot off.
 */
export const interruptionsConfig = {
  popup: {
    delayMs: 8000,
    suppressDays: 7,
    code: 'WELCOME10',
    excludedPrefixes: ['/checkout', '/orders'],
  },
  consent: { cookieName: 'cofresso_consent', maxAgeDays: 180, gateSdkOnAnalytics: true },
  chat: { unreadAfterMs: 30000, typingMs: 600 },
  toasts: { firstAfterMs: 12000, intervalMs: 25000, visibleMs: 6000, maxPerSession: 3 },
  announcement: { rotateMs: 6000 },
  deferred: { rootMargin: '200px' },
} as const;
