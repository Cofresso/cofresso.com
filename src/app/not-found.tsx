import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function NotFound() {
  return (
    <Container
      className="flex flex-col items-center gap-4 py-32 text-center"
      data-testid="not-found"
    >
      <p className="text-copper text-xs font-semibold tracking-[0.25em] uppercase">404</p>
      <h1 className="text-4xl sm:text-5xl">That page has been decaffeinated.</h1>
      <p className="text-latte max-w-md">
        We could not find what you were looking for. It may have sold out, moved, or never existed.
      </p>
      <div className="mt-4 flex gap-3">
        <ButtonLink href="/shop">Shop coffee</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </Container>
  );
}
