import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Deferred } from '@/components/interruptions/deferred';
import { AddToCartForm } from '@/components/product/add-to-cart-form';
import { ProductDetails } from '@/components/product/product-details';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductGrid } from '@/components/product/product-grid';
import { ReviewList } from '@/components/product/review-list';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { Rating } from '@/components/ui/rating';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { categoryLabel, roastLabel } from '@/lib/catalog/labels';
import { lowestPriceCents, primaryImage } from '@/lib/catalog/types';
import { getProductBySlug, listRelatedProducts } from '@/lib/db/queries/catalog';
import { getServerEnv } from '@/lib/env';
import { interruptionsEnabled } from '@/lib/interruptions/enabled';
import { ViewItemTracker } from './view-item-tracker';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProductBySlug((await params).slug);
  if (!data) return { title: 'Product not found' };
  const lead = primaryImage(data.images);
  return {
    title: data.product.name,
    description: data.product.tagline,
    openGraph: {
      title: data.product.name,
      description: data.product.tagline,
      images: [lead?.url ?? data.product.imagePath],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product, variants, rating, images, collections, reviews } = data;
  const related = await listRelatedProducts(product, 4);
  const base = getServerEnv().SITE_URL;
  const deferSections = interruptionsEnabled();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline,
    image: images.length ? images.map((i) => i.url) : [`${base}${product.imagePath}`],
    sku: variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'Cofresso' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: (lowestPriceCents(variants) / 100).toFixed(2),
      highPrice: (Math.max(...variants.map((v) => v.priceCents)) / 100).toFixed(2),
      offerCount: variants.length,
      availability: variants.some((v) => v.stockQuantity > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(rating.count
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.average,
            reviewCount: rating.count,
          },
        }
      : {}),
  };

  return (
    <Container className="py-10">
      <nav aria-label="Breadcrumb" className="text-latte mb-6 text-sm">
        <Link href="/shop" className="hover:text-espresso">
          Shop
        </Link>
        {collections[0] ? (
          <>
            <span className="mx-2">/</span>
            <Link href={`/collections/${collections[0].slug}`} className="hover:text-espresso">
              {collections[0].name}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-espresso">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative">
          <ProductGallery
            images={images}
            fallback={{ src: product.imagePath, alt: product.name }}
          />
          <div className="pointer-events-none absolute top-4 left-4 z-20 flex gap-2">
            {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
            {product.featured ? <Badge tone="copper">Staff pick</Badge> : null}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div>
            <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
              {product.origin ?? categoryLabel(product.category)}
            </p>
            <h1 className="text-4xl leading-tight sm:text-5xl" data-testid="product-title">
              {product.name}
            </h1>
            <p className="text-latte mt-3 text-lg">{product.tagline}</p>
            {rating.count > 0 ? (
              <a href="#reviews" className="mt-3 inline-flex">
                <Rating value={rating.average} count={rating.count} size="md" />
              </a>
            ) : null}
            {product.tastingNotes.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tasting notes">
                {product.tastingNotes.map((n) => (
                  <li key={n}>
                    <Badge tone="neutral" className="capitalize">
                      {n}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <AddToCartForm product={product} variants={variants} />

          <ProductDetails product={product} />

          <div className="prose prose-sm text-espresso/90 max-w-none">
            <p>{product.description}</p>
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-20 scroll-mt-28">
        <SectionHeading eyebrow="Reviews" title="What people are brewing" />
        <Deferred enabled={deferSections} placeholder={<Skeleton className="h-72 w-full" />}>
          <ReviewList reviews={reviews} average={rating.average} />
        </Deferred>
      </section>

      {related.length ? (
        <section className="mt-20">
          <SectionHeading eyebrow="You might also like" title="Pairs well with" />
          <Deferred enabled={deferSections} placeholder={<Skeleton className="h-80 w-full" />}>
            <ProductGrid items={related} listId={`related_${product.slug}`} />
          </Deferred>
        </section>
      ) : null}

      <ViewItemTracker
        item={{
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCents: lowestPriceCents(variants),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Container>
  );
}
