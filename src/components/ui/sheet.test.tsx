import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

// Mirrors how real consumers (MobileNav, CartButton) use Sheet: `open` is local
// state flipped from a click handler, not a prop swapped in directly.
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <div data-testid="inner">content</div>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules nothing while it has never been open', () => {
    render(<Harness />);
    // A pending close timer here is exactly the mount-time no-op update that caused the
    // original bug: its deadline can land between the commit that opens the sheet and the
    // effect flush that would have cleared it, which unmounts the panel that just opened and
    // leaves body scroll locked.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens correctly even after sitting idle on the page since hydration', () => {
    render(<Harness />);

    // The close-timer effect also fires on initial mount (open=false), scheduling
    // a same-value `setRendered(false)` 300ms later. Advancing past that here is
    // what reproduces the bug: it must not leave a pending update that clobbers
    // the next open.
    act(() => {
      vi.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    const dialog = screen.getByRole('dialog');
    const wrapper = dialog.parentElement as HTMLElement;
    expect(wrapper.classList.contains('invisible')).toBe(false);
    expect(screen.getByTestId('inner')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    // Still mounted immediately after close so the close transition can play.
    expect(screen.getByTestId('inner')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
  });
});
