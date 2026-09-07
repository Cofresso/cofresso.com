'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface InterruptionState {
  /** The email-capture modal is on screen. */
  popupOpen: boolean;
  setPopupOpen: (open: boolean) => void;
  /** The chat panel (not just the bubble) is on screen. */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** The cookie banner is on screen, so the bottom corners are occupied. */
  bannerOpen: boolean;
  setBannerOpen: (open: boolean) => void;
  /**
   * Something already owns the visitor's attention. Social-proof toasts hold off rather
   * than stacking a third thing on top of a modal.
   */
  overlayOpen: boolean;
}

const InterruptionStateContext = createContext<InterruptionState | null>(null);

export function InterruptionStateProvider({ children }: { children: ReactNode }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const value = useMemo<InterruptionState>(
    () => ({
      popupOpen,
      setPopupOpen,
      chatOpen,
      setChatOpen,
      bannerOpen,
      setBannerOpen,
      overlayOpen: popupOpen || chatOpen,
    }),
    [popupOpen, chatOpen, bannerOpen],
  );
  return (
    <InterruptionStateContext.Provider value={value}>{children}</InterruptionStateContext.Provider>
  );
}

export function useInterruptionState(): InterruptionState {
  const ctx = useContext(InterruptionStateContext);
  if (!ctx) throw new Error('useInterruptionState must be used inside InterruptionStateProvider');
  return ctx;
}
