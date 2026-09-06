'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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
        open ? 'pointer-events-auto' : 'pointer-events-none invisible',
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
        {/* Unmounted while closed: the drawer variant of this sheet renders the same
            data-testids as the full cart/page content it mirrors (cart lines, summary,
            free-shipping bar, ...), so keeping it mounted off-screen would leave two
            matches for every such testid on any page where the cart has items. */}
        <div className="flex-1 overflow-y-auto">{open ? children : null}</div>
        {footer ? (
          <div className="border-latte/30 bg-cream border-t px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
