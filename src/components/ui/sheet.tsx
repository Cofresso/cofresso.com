'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconX } from './icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}

/**
 * Render this at layout level. Ancestors with `backdrop-filter`, `transform` or
 * `filter` become the containing block for the fixed wrapper (this is why the
 * mobile nav's sheet lives outside the header).
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  testId,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keeps the sheet (and its children) mounted for the duration of the 300ms close
  // transition below, so the opacity/translate transitions actually get to play instead
  // of the sheet disappearing (via `invisible` + unmounted children) the instant `open`
  // flips to false.
  const [rendered, setRendered] = useState(open);
  // Invariant: an open sheet is always rendered. Adjusting state during render (React's
  // documented pattern) means opening starts the transition in the same commit as `open`
  // flips true, so the slide-in transition has something to animate from. Doing this from
  // an effect instead would let the browser paint one frame with `open` true (transform
  // already at its target) while the wrapper is still `invisible`, so the panel would pop
  // in rather than slide. This can never fire on mount: `useState(open)` already starts
  // `rendered` equal to `open`, so `open && !rendered` is false on the first render.
  if (open && !rendered) setRendered(true);

  useEffect(() => {
    // Only while actually closing. Scheduling this whenever `open` is false would leave a
    // stray timer behind on mount (this was the original bug: `open` starts false, so a
    // bare `if (open) return;` scheduled a same-value `setRendered(false)` 300ms after
    // hydration; React bails out of that no-op update but leaves it enqueued, and replaying
    // it later clobbered the render-phase `setRendered(true)` above). Guarding on `rendered`
    // too means this only runs while we're actually mid-close, so nothing is ever scheduled
    // on mount or while open.
    if (open || !rendered) return;
    const timeout = setTimeout(() => setRendered(false), 300);
    return () => clearTimeout(timeout);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        open ? 'pointer-events-auto' : 'pointer-events-none',
        rendered ? '' : 'invisible',
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          'bg-espresso/40 absolute inset-0 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={cn(
          'bg-foam absolute inset-y-0 flex w-full max-w-md flex-col shadow-2xl transition-transform duration-300 focus:outline-none',
          side === 'right' ? 'right-0' : 'left-0',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <header className="border-latte/30 flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-espresso/5 rounded-full p-2"
          >
            <IconX />
          </button>
        </header>
        {/* Mounted for as long as `rendered` (i.e. through the close transition) rather than
            `open`: the drawer variant of this sheet renders the same data-testids as the full
            cart/page content it mirrors (cart lines, summary, free-shipping bar, ...), so
            keeping it mounted indefinitely once opened would leave two matches for every such
            testid on any page where the cart has items. Unmounting it once the close
            transition finishes avoids that without cutting the transition short. */}
        <div className="flex-1 overflow-y-auto">{rendered ? children : null}</div>
        {footer ? (
          <div className="border-latte/30 bg-cream border-t px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
