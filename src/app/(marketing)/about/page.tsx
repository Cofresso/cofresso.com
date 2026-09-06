import type { Metadata } from 'next';
import Image from 'next/image';
import { NewsletterForm } from '@/components/marketing/newsletter-form';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = {
  title: 'Our story',
  description: 'How an engineering team&apos;s coffee obsession became Cofresso.',
};

export default function AboutPage() {
  return (
    <Container className="py-16">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
            Our story
          </p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Precision is a form of care.</h1>
          <div className="text-espresso/85 mt-6 flex flex-col gap-4 text-lg">
            <p>
              Cofresso started in 2021 as a spreadsheet. A few engineers at a software company were
              tired of bad office coffee and decided to treat it like any other system: measure
              everything, change one variable at a time, keep what works.
            </p>
            <p>
              Two years and one very tired popcorn popper later we bought a real roaster, moved into
              a small unit on the edge of town and started shipping bags to friends. The spreadsheet
              is still around. It now has 4,000 rows.
            </p>
            <p>
              We buy coffee from producers we can name, roast in batches small enough to taste every
              one, and ship within 48 hours. If a bag is not right, we replace it. That is the whole
              business model.
            </p>
          </div>
          <div className="mt-8 flex gap-3">
            <ButtonLink href="/shop">Shop the coffee</ButtonLink>
            <ButtonLink href="/brew-guides" variant="outline">
              How we brew
            </ButtonLink>
          </div>
        </div>
        <div className="bg-espresso flex justify-center rounded-3xl p-12">
          <Image
            src="/logo.png"
            alt="Cofresso double-bean mark"
            width={320}
            height={320}
            className="drop-shadow-2xl"
          />
        </div>
      </div>

      <section className="mt-24 grid gap-6 sm:grid-cols-3">
        {[
          ['9', 'origin countries in the current lineup'],
          ['48h', 'from roaster to shipping label'],
          ['4,000+', 'logged brews in the spreadsheet'],
        ].map(([n, label]) => (
          <div key={label} className="bg-foam rounded-2xl p-8">
            <p className="font-display text-5xl">{n}</p>
            <p className="text-latte mt-2 text-sm">{label}</p>
          </div>
        ))}
      </section>

      <section className="bg-copper/10 mt-24 rounded-3xl p-8 sm:p-12">
        <h2 className="text-3xl">Get roast notes</h2>
        <p className="text-latte mt-2">One email when a new lot lands.</p>
        <div className="mt-6 max-w-lg">
          <NewsletterForm source="about" />
        </div>
      </section>
    </Container>
  );
}
