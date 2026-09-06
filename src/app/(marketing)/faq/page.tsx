import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { faqItems } from '@/lib/content/faq';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Shipping, subscriptions, grind and storage questions answered.',
};

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">Help</p>
        <h1 className="text-4xl sm:text-5xl">Frequently asked questions</h1>
        <div className="divide-latte/30 bg-foam mt-10 divide-y rounded-2xl px-6" data-testid="faq">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {item.question}
                <span
                  className="text-latte transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-espresso/85 mt-3 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Container>
  );
}
