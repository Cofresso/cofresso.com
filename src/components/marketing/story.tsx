import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import type { ManifestImage } from '@/lib/images/manifest';
import logo from '../../../public/logo.png';

export function Story({ image }: { image?: ManifestImage | null }) {
  return (
    <section
      className="bg-espresso text-foam grid items-center gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-2"
      data-testid="story"
    >
      <div>
        <p className="text-copper mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
          Our story
        </p>
        <h2 className="text-3xl sm:text-4xl">
          We started with a spreadsheet and a popcorn popper.
        </h2>
        <p className="text-foam/80 mt-5">
          Cofresso began as an engineering team&apos;s obsession with getting the office coffee
          right. We logged every roast, every ratio and every brew until the numbers turned into
          something we were proud to drink. Now we roast for a few thousand people who care as much
          as we do.
        </p>
        <ButtonLink
          href="/about"
          variant="outline"
          className="border-foam/40 text-foam hover:border-foam hover:bg-foam/10 mt-8"
        >
          Read more
        </ButtonLink>
      </div>
      <div className="flex justify-center">
        {image ? (
          <div
            className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl"
            data-testid="story-image"
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <Image
            src={logo}
            alt="Cofresso double-bean mark"
            width={260}
            height={260}
            className="drop-shadow-2xl"
          />
        )}
      </div>
    </section>
  );
}
