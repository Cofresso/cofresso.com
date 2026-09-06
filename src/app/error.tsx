'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="flex flex-col items-center gap-4 py-32 text-center">
      <p className="text-5xl">☕</p>
      <h1 className="text-4xl">Something spilled.</h1>
      <p className="text-latte max-w-md">
        We hit an unexpected error. Try again, or head back to the shop while we mop up.
      </p>
      {error.digest ? <p className="text-latte text-xs">Reference: {error.digest}</p> : null}
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/shop" variant="outline">
          Back to shop
        </ButtonLink>
      </div>
    </Container>
  );
}
