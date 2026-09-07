'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { interruptionsConfig } from '@/lib/interruptions/config';

interface DeferredProps {
  children: ReactNode;
  /** Shown in the children's place until the section scrolls near the viewport. */
  placeholder: ReactNode;
  /**
   * The `UX_INTERRUPTIONS` kill switch, passed down by the server component that renders this
   * — a client component cannot read the server env itself. `false` renders the children
   * straight away.
   */
  enabled?: boolean;
}

/**
 * Holds a section back until it scrolls within `deferred.rootMargin` of the viewport, so
 * reviews and related products pop in the way they do on a real storefront.
 *
 * This defers *rendering*, not fetching: the children are server-rendered into the RSC payload
 * either way, so there is no request in flight to wait on and no spinner that can hang.
 */
export function Deferred({ children, placeholder, enabled = true }: DeferredProps) {
  const [revealed, setRevealed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || revealed) return;
    // No IntersectionObserver (ancient browsers, jsdom): reveal rather than hide the content
    // for good. Deferred in a timer so this is not a setState during the effect body.
    if (typeof IntersectionObserver === 'undefined') {
      const timeout = setTimeout(() => setRevealed(true), 0);
      return () => clearTimeout(timeout);
    }
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setRevealed(true);
      },
      { rootMargin: interruptionsConfig.deferred.rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, revealed]);

  if (!enabled || revealed) return <>{children}</>;

  return (
    <div ref={sentinelRef} data-testid="deferred-pending">
      {placeholder}
    </div>
  );
}
