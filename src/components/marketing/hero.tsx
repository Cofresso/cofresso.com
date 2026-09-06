import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import type { ProductCardData } from '@/lib/catalog/types';

export function Hero({ featured }: { featured: ProductCardData[] }) {
  const [a, b, c] = featured;
  return (
    <section className="bg-espresso text-foam relative overflow-hidden" data-testid="hero">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(200,118,58,0.35),_transparent_55%)]"
        aria-hidden="true"
      />
      <Container className="relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <p className="text-copper mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
            Small-batch specialty coffee
          </p>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Coffee, <em className="text-latte-light font-light italic">framed</em> right.
          </h1>
          <p className="text-foam/80 mt-6 max-w-lg text-lg">
            Roasted to order, shipped within 48 hours, and dialed in for the way you actually brew.
            Subscribe and save 15% on every bag.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/shop" size="lg" variant="copper" data-testid="hero-cta">
              Shop coffee
            </ButtonLink>
            <ButtonLink
              href="/brew-guides"
              size="lg"
              variant="outline"
              className="border-foam/40 text-foam hover:bg-foam/10 hover:border-foam"
            >
              Find your brew
            </ButtonLink>
          </div>
          <dl className="border-foam/15 mt-10 grid grid-cols-3 gap-6 border-t pt-6 text-sm">
            <div>
              <dt className="text-foam/60">Roast to ship</dt>
              <dd className="text-lg font-medium">48 hours</dd>
            </div>
            <div>
              <dt className="text-foam/60">Origins</dt>
              <dd className="text-lg font-medium">9 countries</dd>
            </div>
            <div>
              <dt className="text-foam/60">Free shipping</dt>
              <dd className="text-lg font-medium">over $45</dd>
            </div>
          </dl>
        </div>
        <div className="relative mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3">
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
      </Container>
    </section>
  );
}
