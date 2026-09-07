import Image from 'next/image';
import type { Collection } from '@/lib/db/schema';

/**
 * Image-only banner. The page keeps ownership of the `<h1>` (and of the
 * `collection-title` test id), so there is exactly one heading per page.
 */
export function CollectionHero({ collection }: { collection: Collection }) {
  if (!collection.heroImageUrl) return null;
  return (
    <div
      className="bg-foam relative mb-8 aspect-[16/6] w-full overflow-hidden rounded-3xl"
      data-testid="collection-hero"
    >
      <Image
        src={collection.heroImageUrl}
        alt={collection.heroImageAlt ?? `Cofresso ${collection.name} collection`}
        fill
        sizes="(min-width: 1152px) 1152px, 100vw"
        priority
        className="object-cover"
      />
      <div
        className="from-espresso/40 absolute inset-0 bg-gradient-to-t to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
