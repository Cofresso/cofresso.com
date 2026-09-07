import Image from 'next/image';
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/icons';
import { brewGuides } from '@/lib/content/brew-guides';
import { guideImage } from '@/lib/images/content';

export function BrewGuidesTeaser() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="brew-guides-teaser">
      {brewGuides.map((g) => {
        const cover = guideImage(g.slug);
        return (
          <Link
            key={g.slug}
            href={`/brew-guides/${g.slug}`}
            className="group border-latte/30 bg-foam hover:border-copper rounded-2xl border p-6 transition-colors"
          >
            {cover ? (
              <div
                className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-xl"
                data-testid="guide-teaser-cover"
              >
                <Image
                  src={cover.url}
                  alt={cover.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            ) : null}
            <p className="text-latte text-xs font-semibold tracking-[0.2em] uppercase">
              {g.method}
            </p>
            <h3 className="mt-2 text-xl">{g.title}</h3>
            <p className="text-latte mt-2 text-sm">{g.summary}</p>
            <p className="text-espresso/70 mt-4 text-sm">
              {g.ratio.split(' (')[0]} · {g.totalTime}
            </p>
            <span className="text-copper-dark mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Read guide{' '}
              <IconArrowRight
                width={16}
                height={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
