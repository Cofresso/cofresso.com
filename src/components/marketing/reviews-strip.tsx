import Link from 'next/link';
import { Rating } from '@/components/ui/rating';
import type { RecentReview } from '@/lib/db/queries/catalog';

export function ReviewsStrip({ reviews }: { reviews: RecentReview[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="reviews-strip">
      {reviews.map((r) => (
        <figure key={r.id} className="bg-foam flex flex-col gap-3 rounded-2xl p-6">
          <Rating value={r.rating} />
          <blockquote className="text-sm leading-relaxed">“{r.body}”</blockquote>
          <figcaption className="text-latte mt-auto text-xs">
            {r.authorName}
            {r.verified ? ' · Verified buyer' : ''} · on{' '}
            <Link
              href={`/products/${r.product.slug}`}
              className="text-espresso underline-offset-2 hover:underline"
            >
              {r.product.name}
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
