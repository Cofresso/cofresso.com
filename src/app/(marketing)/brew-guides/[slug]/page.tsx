import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product/product-grid';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { brewGuides, getBrewGuide } from '@/lib/content/brew-guides';
import { listProducts } from '@/lib/db/queries/catalog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getBrewGuide((await params).slug);
  return guide ? { title: guide.title, description: guide.summary } : { title: 'Brew guide' };
}

export default async function BrewGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getBrewGuide(slug);
  if (!guide) notFound();

  const all = await listProducts({ category: 'coffee', sort: 'featured' });
  const recommended = guide.recommendedSlugs
    .map((s) => all.find((p) => p.product.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <Container className="py-16">
      <nav aria-label="Breadcrumb" className="text-latte mb-6 text-sm">
        <Link href="/brew-guides" className="hover:text-espresso">
          Brew guides
        </Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">{guide.title}</span>
      </nav>
      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <article>
          <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
            {guide.method}
          </p>
          <h1 className="text-4xl sm:text-5xl" data-testid="guide-title">
            {guide.title}
          </h1>
          <p className="text-latte mt-4 text-lg">{guide.summary}</p>
          <ol className="mt-10 flex flex-col gap-5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="bg-espresso text-foam flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <div className="bg-copper/10 mt-10 rounded-2xl p-6">
            <h2 className="font-body text-copper-dark text-sm font-semibold tracking-wide uppercase">
              Tips from the bar
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              {guide.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </article>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <dl className="bg-foam rounded-2xl p-6 text-sm">
            {[
              ['Ratio', guide.ratio],
              ['Grind', guide.grind],
              ['Water', `${guide.waterTempC}°C`],
              ['Time', guide.totalTime],
            ].map(([k, v]) => (
              <div
                key={k}
                className="border-latte/20 flex justify-between gap-4 border-b py-3 last:border-0"
              >
                <dt className="text-latte">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col gap-1 text-sm">
            <p className="text-latte text-xs font-semibold tracking-wide uppercase">Other guides</p>
            {brewGuides
              .filter((g) => g.slug !== guide.slug)
              .map((g) => (
                <Link
                  key={g.slug}
                  href={`/brew-guides/${g.slug}`}
                  className="hover:text-copper py-1"
                >
                  {g.title}
                </Link>
              ))}
          </div>
        </aside>
      </div>
      {recommended.length ? (
        <section className="mt-20">
          <SectionHeading
            eyebrow="Recommended"
            title={`Coffees we brew as ${guide.method.toLowerCase()}`}
          />
          <ProductGrid items={recommended} listId={`guide_${guide.slug}`} />
        </section>
      ) : null}
    </Container>
  );
}
