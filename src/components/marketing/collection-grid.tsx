import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/icons';
import type { Collection } from '@/lib/db/schema';

const art: Record<string, string> = {
  'single-origin': 'from-copper/30 to-cream',
  blends: 'from-espresso/30 to-cream',
  decaf: 'from-leaf/30 to-cream',
  equipment: 'from-latte/40 to-cream',
};

export function CollectionGrid({ collections }: { collections: Collection[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="collection-grid">
      {collections.map((c) => (
        <Link
          key={c.id}
          href={`/collections/${c.slug}`}
          className={`group flex min-h-44 flex-col justify-between rounded-2xl bg-gradient-to-br p-6 transition-shadow hover:shadow-lg ${art[c.slug] ?? 'from-latte/30 to-cream'}`}
        >
          <span className="text-espresso/60 text-xs font-semibold tracking-[0.2em] uppercase">
            Collection
          </span>
          <span>
            <span className="font-display block text-2xl">{c.name}</span>
            <span className="text-espresso/70 mt-1 block text-sm">{c.description}</span>
            <span className="text-copper-dark mt-3 inline-flex items-center gap-1 text-sm font-medium">
              Browse{' '}
              <IconArrowRight
                width={16}
                height={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
