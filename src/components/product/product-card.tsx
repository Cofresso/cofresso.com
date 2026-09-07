import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { roastLabel } from '@/lib/catalog/labels';
import {
  hoverImage,
  lowestPriceCents,
  primaryImage,
  type ProductCardData,
} from '@/lib/catalog/types';

export function ProductCard({
  data,
  priority = false,
}: {
  data: ProductCardData;
  priority?: boolean;
}) {
  const { product, variants, rating, images } = data;
  const soldOut = variants.every((v) => v.stockQuantity <= 0);
  const cheapest = [...variants].sort(
    (a, b) => a.priceCents - b.priceCents || a.position - b.position,
  )[0];
  const onSale = variants.some(
    (v) => v.compareAtPriceCents != null && v.compareAtPriceCents > v.priceCents,
  );
  const compareAt =
    cheapest?.compareAtPriceCents && cheapest.compareAtPriceCents > cheapest.priceCents
      ? cheapest.compareAtPriceCents
      : null;
  const lead = primaryImage(images);
  const hover = hoverImage(images);
  return (
    <article className="group flex flex-col" data-testid="product-card" data-slug={product.slug}>
      <Link
        href={`/products/${product.slug}`}
        className="bg-foam relative block overflow-hidden rounded-2xl"
      >
        {lead ? (
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={lead.url}
              alt={lead.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              data-testid="card-image"
            />
            {hover ? (
              <Image
                src={hover.url}
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                data-testid="card-image-hover"
              />
            ) : null}
          </div>
        ) : (
          <Image
            src={product.imagePath}
            alt={product.name}
            width={600}
            height={750}
            unoptimized
            priority={priority}
            className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
            data-testid="card-image"
          />
        )}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          {product.roastLevel ? <Badge>{roastLabel(product.roastLevel)} roast</Badge> : null}
          {onSale ? <Badge tone="copper">Sale</Badge> : null}
          {soldOut ? <Badge tone="espresso">Sold out</Badge> : null}
        </div>
      </Link>
      <div className="mt-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug">
            <Link href={`/products/${product.slug}`} className="hover:text-copper">
              {product.name}
            </Link>
          </h3>
          <Price
            cents={lowestPriceCents(variants)}
            compareAtCents={compareAt}
            className="shrink-0 text-sm"
            suffix={variants.length > 1 ? '+' : undefined}
          />
        </div>
        <p className="text-latte text-sm">{product.origin ?? product.tagline}</p>
        {product.tastingNotes.length ? (
          <p className="text-espresso/70 text-xs">{product.tastingNotes.join(' · ')}</p>
        ) : null}
        {rating.count > 0 ? (
          <Rating value={rating.average} count={rating.count} className="mt-1" />
        ) : null}
      </div>
    </article>
  );
}
