'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconX } from './icons';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Matches the `duration-200` on the overlay and panel below. */
const CLOSE_TRANSITION_MS = 200;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, rendered as the dialog heading. */
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
  /** `data-testid` for the built-in close button, e.g. `popup-dismiss`. */
  closeTestId?: string;
  className?: string;
}

/**
 * Centred modal dialog. Sibling of `Sheet`: same `rendered` bookkeeping so the 200 ms close
 * transition gets to play before the children unmount, plus the extras a centred overlay
 * needs — a Tab focus trap, focus restored to whatever opened it, Escape and overlay click.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  testId,
  closeTestId,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // What to hand focus back to once we close. Captured on open rather than on mount because
  // the modal is mounted (closed) for the whole session.
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Keeps the panel mounted through the close transition.
  const [rendered, setRendered] = useState(open);
  // Invariant: an open modal is always rendered. Adjusting state during render (React's
  // documented pattern) means opening starts the transition in the same commit rather than a
  // tick late, and it repairs the state if a close timer ever lands after a re-open.
  if (open && !rendered) setRendered(true);

  useEffect(() => {
    // Only while actually closing. Scheduling this whenever `open` is false would leave a
    // stray timer behind on mount, and its deadline can land in the window between the commit
    // that opens the modal and the effect flush that would have cleared it — unmounting the
    // panel that just opened and leaving body scroll locked.
    if (open || !rendered) return;
    const timeout = setTimeout(() => setRendered(false), CLOSE_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [open, rendered]);

  const focusable = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    [],
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the panel itself rather than the first control: the first control is the close
    // button, and landing on it reads like "you probably want to leave".
    panel?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restoreRef.current?.focus();
    };
  }, [open, onClose, focusable]);

  if (!rendered) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        data-testid="modal-overlay"
        className={cn(
          'bg-espresso/50 absolute inset-0 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid={testId}
        className={cn(
          'bg-foam relative flex w-full max-w-md flex-col rounded-2xl shadow-2xl transition-all duration-200 focus:outline-none',
          open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid={closeTestId}
          className="text-espresso/60 hover:bg-espresso/5 hover:text-espresso focus-visible:ring-espresso absolute top-3 right-3 rounded-full p-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconX />
        </button>
        <div className="flex flex-col gap-3 px-6 pt-8 pb-6">
          <h2 id={titleId} className="pr-8 text-2xl leading-tight">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-latte text-sm">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {footer ? <div className="border-latte/30 border-t px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
