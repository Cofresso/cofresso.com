'use client';

import { useActionState, useEffect } from 'react';
import { subscribeNewsletterAction } from '@/app/(marketing)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics/track';

export function NewsletterForm({ source = 'home' }: { source?: string }) {
  const [state, formAction, pending] = useActionState(subscribeNewsletterAction, null);

  useEffect(() => {
    if (state?.ok) track({ name: 'newsletter_signup', source });
  }, [state, source]);

  if (state?.ok) {
    return (
      <p
        className="bg-leaf/10 text-leaf rounded-xl px-4 py-3 text-sm"
        role="status"
        data-testid="newsletter-success"
      >
        {state.data.created
          ? 'You are on the list. First roast notes land next week.'
          : 'You were already on the list. We like your enthusiasm.'}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 sm:flex-row"
      data-testid="newsletter-form"
    >
      <input type="hidden" name="source" value={source} />
      <Input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        className="sm:max-w-xs"
      />
      <Button type="submit" variant="copper" loading={pending}>
        Get roast notes
      </Button>
      {state && !state.ok ? (
        <p className="text-sm text-red-700 sm:self-center" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
