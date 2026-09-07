import { Deferred } from '@/components/interruptions/deferred';
import { BrewGuidesTeaser } from '@/components/marketing/brew-guides-teaser';
import { CollectionGrid } from '@/components/marketing/collection-grid';
import { Hero } from '@/components/marketing/hero';
import { NewsletterForm } from '@/components/marketing/newsletter-form';
import { ReviewsStrip } from '@/components/marketing/reviews-strip';
import { Story } from '@/components/marketing/story';
import { ValueProps } from '@/components/marketing/value-props';
import { ProductGrid } from '@/components/product/product-grid';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { listCollections, listFeaturedProducts, listRecentReviews } from '@/lib/db/queries/catalog';
import { interruptionsEnabled } from '@/lib/interruptions/enabled';

export default async function HomePage() {
  const [featured, collections, reviews] = await Promise.all([
    listFeaturedProducts(4),
    listCollections(),
    listRecentReviews(3),
  ]);

  return (
    <>
      <Hero featured={featured} />
      <ValueProps />

      <Container className="py-20">
        <SectionHeading
          eyebrow="Featured"
          title="This week on the bar"
          description="The coffees our roasters keep reaching for."
          action={
            <ButtonLink href="/shop" variant="outline">
              Shop all
            </ButtonLink>
          }
        />
        <ProductGrid items={featured} listId="home_featured" />
      </Container>

      <Container className="pb-20">
        <SectionHeading eyebrow="Collections" title="Find your lane" />
        <CollectionGrid collections={collections} />
      </Container>

      <Container className="pb-20">
        <Story />
      </Container>

      <Container className="pb-20">
        <SectionHeading
          eyebrow="Brew guides"
          title="Brew it like we do"
          description="Ratios, grind sizes and timings for every brewer in the cupboard."
        />
        <BrewGuidesTeaser />
      </Container>

      <Container className="pb-20">
        <SectionHeading eyebrow="Reviews" title="From the inbox" />
        <Deferred
          enabled={interruptionsEnabled()}
          placeholder={<Skeleton className="h-44 w-full" />}
        >
          <ReviewsStrip reviews={reviews} />
        </Deferred>
      </Container>

      <section id="newsletter" className="bg-copper/10">
        <Container className="grid items-center gap-8 py-16 lg:grid-cols-2">
          <div>
            <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
              Roast notes
            </p>
            <h2 className="text-3xl sm:text-4xl">New coffees, first.</h2>
            <p className="text-latte mt-3">
              One email when a new lot lands. No drip campaigns, pun intended.
            </p>
          </div>
          <NewsletterForm source="home" />
        </Container>
      </section>
    </>
  );
}
