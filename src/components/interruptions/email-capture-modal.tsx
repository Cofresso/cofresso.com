'use client';

import { usePathname } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { subscribeNewsletterAction } from '@/app/(marketing)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { track } from '@/lib/analytics/track';
import { interruptionsConfig } from '@/lib/interruptions/config';
import {
  isPopupExcludedPath,
  parseSuppression,
  POPUP_STORAGE_KEY,
  serializeSuppression,
  shouldShowPopup,
  suppressionFor,
  type PopupSuppression,
} from '@/lib/interruptions/suppression';
import { useInterruptionState } from './state';

type Trigger = 'timer' | 'exit_intent';

/** Reads the suppression record. Only ever called from effects, never during render. */
function suppressedFor(pathname: string): boolean {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(POPUP_STORAGE_KEY);
  } catch {
    // Private-mode Safari and friends throw on storage access. Showing the popup once per
    // page view beats crashing the layout.
  }
  return !shouldShowPopup(parseSuppression(raw), new Date(), pathname);
}

function remember(state: PopupSuppression['state']) {
  try {
    window.localStorage.setItem(
      POPUP_STORAGE_KEY,
      serializeSuppression(suppressionFor(state, new Date())),
    );
  } catch {
    /* storage unavailable — nothing to remember, nothing to do */
  }
}

/**
 * The 10%-off email capture popup. Opens `popup.delayMs` after landing on an eligible route,
 * or immediately on exit intent (pointer leaving through the top of the window, desktop only).
 *
 * Hydration: the first frame is always closed. Whether the popup is due depends on
 * localStorage, which the server cannot see, so the check happens inside the trigger effects
 * and the only thing render looks at is `trigger`/`closed`/`pathname`. Nothing here reads the
 * clock or storage during render.
 *
 * Checkout is off limits. `popup.excludedPrefixes` is consulted both when arming the timer and
 * when deriving `open`, so the popup can neither appear on `/checkout*` and `/orders*` nor
 * survive a navigation onto one.
 */
export function EmailCaptureModal() {
  const pathname = usePathname();
  const { setPopupOpen } = useInterruptionState();
  const [state, formAction, pending] = useActionState(subscribeNewsletterAction, null);

  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const subscribedRef = useRef(false);
  const shownRef = useRef(false);

  const open = trigger !== null && !closed && !isPopupExcludedPath(pathname);

  // Timer trigger, re-armed per eligible route: nothing is counting down while the visitor is
  // on checkout or order lookup.
  useEffect(() => {
    if (trigger || closed) return;
    if (suppressedFor(pathname)) return;
    const timeout = setTimeout(() => setTrigger('timer'), interruptionsConfig.popup.delayMs);
    return () => clearTimeout(timeout);
  }, [pathname, trigger, closed]);

  // Exit-intent trigger, desktop pointers only: a touch device has no "leaving through the top
  // of the window" gesture, it just has scrolling.
  useEffect(() => {
    if (trigger || closed) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (suppressedFor(pathname)) return;
    const root = document.documentElement;
    const onLeave = (event: MouseEvent) => {
      if (event.clientY <= 0) setTrigger('exit_intent');
    };
    root.addEventListener('mouseleave', onLeave);
    return () => root.removeEventListener('mouseleave', onLeave);
  }, [pathname, trigger, closed]);

  // Lets the social-proof toasts hold off while this owns the screen.
  useEffect(() => {
    setPopupOpen(open);
  }, [open, setPopupOpen]);

  useEffect(() => {
    if (!open || !trigger || shownRef.current) return;
    shownRef.current = true;
    track({ name: 'popup_shown', trigger });
  }, [open, trigger]);

  useEffect(() => {
    if (!state?.ok || subscribedRef.current) return;
    subscribedRef.current = true;
    remember('subscribed');
    track({ name: 'newsletter_signup', source: 'popup' });
  }, [state]);

  const close = useCallback(() => {
    setClosed(true);
    if (!subscribedRef.current) remember('dismissed');
    track({ name: 'popup_dismissed' });
  }, []);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(interruptionsConfig.popup.code);
      setCopied(true);
    } catch {
      // Clipboard blocked (no permission, insecure origin). The code is on screen anyway.
      setCopied(false);
    }
  }, []);

  return (
    <Modal
      open={open}
      onClose={close}
      title={state?.ok ? 'Welcome to the list' : 'Take 10% off your first bag'}
      description={
        state?.ok
          ? undefined
          : 'Roast notes, new lots and the occasional brewing opinion. One email at a time.'
      }
      testId="popup"
      closeTestId="popup-dismiss"
    >
      {state?.ok ? (
        <div className="flex flex-col gap-3" role="status" data-testid="popup-success">
          <p className="text-sm">
            {state.data.created
              ? 'You are in. Use this code at checkout:'
              : 'You were already on the list — here is the code anyway:'}
          </p>
          <div className="border-copper/40 bg-copper/10 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3">
            <code
              className="text-espresso text-lg font-semibold tracking-[0.2em]"
              data-testid="popup-code"
            >
              {interruptionsConfig.popup.code}
            </code>
            <Button variant="ghost" size="sm" onClick={copyCode} data-testid="popup-copy">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-latte text-xs">
            10% off one order. Not stackable with subscriptions, because the maths gets sad.
          </p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3" data-testid="popup-form">
          <input type="hidden" name="source" value="popup" />
          <Input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            aria-label="Email address"
            autoComplete="email"
          />
          <Button type="submit" variant="copper" loading={pending}>
            Send me the code
          </Button>
          {state && !state.ok ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="text-latte hover:text-espresso self-center text-xs underline-offset-2 hover:underline"
          >
            No thanks, I pay full price
          </button>
        </form>
      )}
    </Modal>
  );
}
