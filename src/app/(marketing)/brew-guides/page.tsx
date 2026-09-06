import type { Metadata } from 'next';
import { BrewGuidesTeaser } from '@/components/marketing/brew-guides-teaser';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = {
  title: 'Brew guides',
  description:
    'Ratios, grind sizes and timings for pour over, French press, espresso and cold brew.',
};

export default function BrewGuidesPage() {
  return (
    <Container className="py-16">
      <div className="mb-10 max-w-2xl">
        <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
          Brew guides
        </p>
        <h1 className="text-4xl sm:text-5xl">Brew it like we do</h1>
        <p className="text-latte mt-3">
          Every recipe below is the one we use on our own bar. Weigh your coffee, weigh your water,
          and adjust one thing at a time.
        </p>
      </div>
      <BrewGuidesTeaser />
    </Container>
  );
}
