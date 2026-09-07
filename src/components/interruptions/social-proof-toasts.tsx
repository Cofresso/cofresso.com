'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconX } from '@/components/ui/icons';
import { track } from '@/lib/analytics/track';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { buildToastSequence, type SocialProofToast } from '@/lib/interruptions/toasts';
import { cn } from '@/lib/utils';
import { useInterruptionState } from './state';

export const TOASTS_STORAGE_KEY = 'cofresso:toasts';

/** Only ever called from event handlers and timers, never during render. */
function readShownCount(): number {
  try {
    const parsed = Number(window.sessionStorage.getItem(TOASTS_STORAGE_KEY));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeShownCount(count: number) {
  try {
    window.sessionStorage.setItem(TOASTS_STORAGE_KEY, String(count));
  } catch {
    /* storage unavailable — the sequence just restarts on the next navigation */
  }
}

/**
 * "Someone in Portland just bought …" toasts, bottom-left. The sequence is deterministic and
 * the position in it lives in sessionStorage, so a visitor gets `toasts.maxPerSession` of them
 * across their whole visit rather than three per page view.
 *
 * `intervalMs` is measured from the moment the previous toast left the screen. They pause
 * outright while the popup or the chat panel is open: stacking a third thing on top of a modal
 * is noise, not realism.
 */
export function SocialProofToasts() {
  const { overlayOpen, bannerOpen } = useInterruptionState();
  const sequence = useMemo(() => buildToastSequence(interruptionsConfig.toasts.maxPerSession), []);
  const [toast, setToast] = useState<SocialProofToast | null>(null);
  // Index of the next toast to show; `null` until the first effect has read sessionStorage.
  const nextIndexRef = useRef<number | null>(null);
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (toast || overlayOpen) return;
    nextIndexRef.current ??= readShownCount();
    const index = nextIndexRef.current;
    if (index >= sequence.length) return;
    const delay =
      index === 0 ? interruptionsConfig.toasts.firstAfterMs : interruptionsConfig.toasts.intervalMs;
    const timeout = setTimeout(() => {
      nextIndexRef.current = index + 1;
      writeShownCount(index + 1);
      setToast(sequence[index]);
    }, delay);
    return () => clearTimeout(timeout);
  }, [toast, overlayOpen, sequence]);

  useEffect(() => {
    if (!toast || overlayOpen) return;
    if (trackedRef.current !== toast.id) {
      trackedRef.current = toast.id;
      track({ name: 'toast_shown', toastId: toast.id });
    }
    const timeout = setTimeout(() => setToast(null), interruptionsConfig.toasts.visibleMs);
    return () => clearTimeout(timeout);
  }, [toast, overlayOpen]);

  const dismiss = useCallback(() => setToast(null), []);

  if (!toast || overlayOpen) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-4 z-30 sm:left-5',
        bannerOpen ? 'bottom-36' : 'bottom-5',
      )}
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="toast"
        className="border-latte/30 bg-foam pointer-events-auto flex w-[min(20rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border px-4 py-3 shadow-xl"
      >
        <span aria-hidden="true" className="bg-leaf mt-1.5 size-2 shrink-0 rounded-full" />
        <p className="flex-1 text-sm leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification"
          data-testid="toast-dismiss"
          className="text-latte hover:bg-espresso/5 hover:text-espresso focus-visible:ring-espresso -mt-1 -mr-1 rounded-full p-1.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconX width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
