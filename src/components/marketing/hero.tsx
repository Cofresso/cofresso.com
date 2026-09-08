import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { IconStar } from '@/components/ui/icons';
import type { ProductCardData } from '@/lib/catalog/types';
import type { ManifestImage } from '@/lib/images/manifest';

/**
 * Editorial social-proof figures from the winning hero experiment.
 */
const SOCIAL_PROOF = {
  rating: 4.8,
  ratingOutOf: 5,
  verifiedBuyers: '12,000+',
} as const;

const OVERLAY_GRADIENT =
  'linear-gradient(180deg, rgba(20,12,10,0.32) 0%, rgba(20,12,10,0.42) 45%, rgba(20,12,10,0.88) 100%), ' +
  'linear-gradient(100deg, rgba(20,12,10,0.6) 0%, rgba(20,12,10,0.22) 45%, rgba(20,12,10,0.05) 70%)';

export function Hero({
  featured,
  image,
}: {
  featured: ProductCardData[];
  image?: ManifestImage | null;
}) {
  const [a, b, c] = featured;
  return (
    <section
      className="bg-espresso text-foam relative isolate min-h-[560px] overflow-hidden sm:min-h-[680px] lg:min-h-[820px]"
      data-testid="hero"
    >
      {image ? (
        <div className="absolute inset-0" data-testid="hero-image">
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="100vw"
            priority
            className="object-cover object-center"
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(200,118,58,0.35),_transparent_55%)]"
          aria-hidden="true"
        >
          <div className="relative mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3 opacity-30">
            {[b, a, c].filter(Boolean).map((item, i) => (
              <Image
                key={item.product.id}
                src={item.product.imagePath}
                alt={item.product.name}
                width={300}
                height={375}
                unoptimized
                priority
                className={i === 1 ? 'scale-110 drop-shadow-2xl' : 'opacity-90 drop-shadow-xl'}
              />
            ))}
          </div>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: OVERLAY_GRADIENT }}
        aria-hidden="true"
      />
      <Container
        className="relative z-10 flex min-h-[560px] flex-col justify-end px-6 pt-24 pb-14 sm:min-h-[680px] sm:px-8 sm:pb-20 lg:min-h-[820px] lg:pb-24"
        style={{ textShadow: '0 1px 16px rgba(10,6,4,0.45)' }}
      >
        <p className="text-copper mb-6 text-xs font-semibold tracking-[0.3em] uppercase">
          Small-batch specialty coffee
        </p>
        <h1 className="text-foam max-w-3xl text-6xl leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl">
          Coffee, <em className="text-latte-light font-light italic">framed</em> right.
        </h1>
        <p className="text-foam/85 mt-6 max-w-xl text-lg sm:text-xl">
          Roasted to order, shipped within 48 hours, and dialed in for the way you actually brew.
          Subscribe and save 15% on every bag.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/shop"
            data-testid="hero-cta"
            className="bg-copper text-foam focus-visible:ring-copper inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-xl transition-colors hover:bg-[#b5652c] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Shop coffee
          </Link>
          <div
            className="flex items-center gap-2 rounded-full bg-[#1a0f0c]/40 px-4 py-2 backdrop-blur-sm"
            role="img"
            aria-label={`Rated ${SOCIAL_PROOF.rating} out of ${SOCIAL_PROOF.ratingOutOf} stars by ${SOCIAL_PROOF.verifiedBuyers} verified buyers`}
            data-testid="hero-social-proof"
          >
            <IconStar className="h-4 w-4 text-[#f2c14e]" />
            <span className="text-foam text-sm font-semibold">{SOCIAL_PROOF.rating}</span>
            <span className="text-foam/75 text-sm">
              · {SOCIAL_PROOF.verifiedBuyers} verified buyers
            </span>
          </div>
        </div>
        <Link
          href="/brew-guides"
          data-testid="hero-secondary-cta"
          className="text-foam/80 hover:text-foam mt-5 inline-block w-fit text-sm font-medium underline underline-offset-4"
        >
          Find your brew
        </Link>
        <dl className="border-foam/20 mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6 text-sm">
          <div>
            <dt className="text-foam/60">Roast to ship</dt>
            <dd className="text-foam text-base font-semibold">48 hours</dd>
          </div>
          <div>
            <dt className="text-foam/60">Origins</dt>
            <dd className="text-foam text-base font-semibold">9 countries</dd>
          </div>
          <div>
            <dt className="text-foam/60">Free shipping</dt>
            <dd className="text-foam text-base font-semibold">over $45</dd>
          </div>
        </dl>
      </Container>
    </section>
  );
}
