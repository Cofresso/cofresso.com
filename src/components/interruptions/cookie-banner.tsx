'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { setConsentAction } from '@/app/(marketing)/consent-actions';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { track } from '@/lib/analytics/track';
import type { Consent, ConsentChoices } from '@/lib/interruptions/consent';
import { useInterruptionState } from './state';

/**
 * Cookie consent banner. Shows until a decision exists, then never again for
 * `consent.maxAgeDays`. Not a modal: it must not trap focus or block the page, because
 * refusing to answer it is a valid answer and checkout has to stay reachable.
 *
 * `consent` comes from the server component, so a returning visitor never sees a flash of
 * banner while the client works out that they already decided.
 */
export function CookieBanner({ consent }: { consent: Consent | null }) {
  const { setBannerOpen } = useInterruptionState();
  const [decided, setDecided] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = consent === null && !decided;

  useEffect(() => {
    setBannerOpen(open);
  }, [open, setBannerOpen]);

  const save = useCallback((choices: ConsentChoices) => {
    // Closed optimistically: the visitor answered, they should not have to watch a round
    // trip before the page is theirs again.
    setDecided(true);
    track({ name: 'consent_updated', ...choices });
    startTransition(async () => {
      await setConsentAction(choices);
    });
  }, []);

  if (!open) return null;

  return (
    <section
      aria-label="Cookie preferences"
      data-testid="cookie-banner"
      className="border-latte/30 bg-foam/98 fixed inset-x-0 bottom-0 z-45 border-t shadow-[0_-8px_24px_rgba(74,44,36,0.08)] backdrop-blur"
    >
      <Container className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm">
          <p className="font-medium">We use cookies. Some of them are load-bearing.</p>
          <p className="text-latte mt-1">
            Essential cookies keep your cart and order lookup working. Analytics and marketing
            cookies are yours to decline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManaging((v) => !v)}
            aria-expanded={managing}
            data-testid="consent-manage"
          >
            Manage
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => save({ analytics: false, marketing: false })}
            loading={pending}
            data-testid="consent-reject"
          >
            Reject non-essential
          </Button>
          <Button
            size="sm"
            onClick={() => save({ analytics: true, marketing: true })}
            loading={pending}
            data-testid="consent-accept"
          >
            Accept all
          </Button>
        </div>
      </Container>

      {managing ? (
        <Container className="border-latte/30 flex flex-col gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Toggle
              id="consent-toggle-analytics"
              label="Analytics"
              hint="How the shop is used, in aggregate."
              checked={analytics}
              onChange={setAnalytics}
            />
            <Toggle
              id="consent-toggle-marketing"
              label="Marketing"
              hint="Roast notes and offers that follow you around."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
          <Button
            size="sm"
            onClick={() => save({ analytics, marketing })}
            loading={pending}
            data-testid="consent-save"
          >
            Save preferences
          </Button>
        </Container>
      ) : null}
    </section>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-espresso mt-0.5 size-4"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-latte block text-xs">{hint}</span>
      </label>
    </div>
  );
}
