import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '@/lib/action-result';
import type { Consent } from '@/lib/interruptions/consent';
import { CookieBanner } from './cookie-banner';
import { InterruptionStateProvider } from './state';

const setConsentAction = vi.hoisted(() => vi.fn());

vi.mock('@/app/(marketing)/consent-actions', () => ({ setConsentAction }));

const decided: Consent = {
  analytics: true,
  marketing: true,
  decidedAt: '2026-09-06T12:00:00.000Z',
};

function renderBanner(consent: Consent | null = null) {
  return render(
    <InterruptionStateProvider>
      <CookieBanner consent={consent} />
    </InterruptionStateProvider>,
  );
}

describe('CookieBanner', () => {
  beforeEach(() => {
    setConsentAction.mockReset();
    setConsentAction.mockResolvedValue(ok(decided));
    delete window.cofresso;
  });

  it('shows only when there is no decision yet', () => {
    renderBanner(decided);
    expect(screen.queryByTestId('cookie-banner')).toBeNull();
    renderBanner(null);
    expect(screen.getByTestId('cookie-banner')).toBeVisible();
  });

  it('accepts everything', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByTestId('consent-accept'));
    expect(setConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: true });
  });

  it('rejects everything non-essential', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByTestId('consent-reject'));
    expect(setConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
  });

  it('saves the toggles chosen under Manage', async () => {
    const user = userEvent.setup();
    renderBanner();
    expect(screen.queryByTestId('consent-save')).toBeNull();
    await user.click(screen.getByTestId('consent-manage'));
    await user.click(screen.getByLabelText(/marketing/i));
    await user.click(screen.getByTestId('consent-save'));
    expect(setConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: true });
  });

  it('saves a rejection made under Manage', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByTestId('consent-manage'));
    await user.click(screen.getByLabelText(/analytics/i));
    await user.click(screen.getByTestId('consent-save'));
    expect(setConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
  });

  it('dismisses itself as soon as a choice is made', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByTestId('consent-accept'));
    await waitFor(() => expect(screen.queryByTestId('cookie-banner')).toBeNull());
  });

  it('reports the decision to analytics', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByTestId('consent-reject'));
    expect(window.cofresso?.events.map((e) => e.event)).toEqual([
      { name: 'consent_updated', analytics: false, marketing: false },
    ]);
  });
});
