import { Rating } from '@/components/ui/rating';
import type { Review } from '@/lib/db/schema';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function ReviewList({ reviews, average }: { reviews: Review[]; average: number }) {
  if (reviews.length === 0) {
    return (
      <p className="text-latte text-sm">No reviews yet. Be the first when you get your bag.</p>
    );
  }
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  return (
    <div className="grid gap-10 lg:grid-cols-[280px_1fr]" data-testid="reviews">
      <div className="bg-foam rounded-2xl p-6">
        <p className="font-display text-5xl">{average.toFixed(1)}</p>
        <Rating value={average} size="md" className="mt-1" />
        <p className="text-latte mt-1 text-sm">
          Based on {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </p>
        <ul className="mt-5 flex flex-col gap-1.5">
          {distribution.map(({ star, count }) => (
            <li key={star} className="flex items-center gap-2 text-xs">
              <span className="w-6 tabular-nums">{star}★</span>
              <span className="bg-latte/20 h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="bg-copper block h-full"
                  style={{ width: `${(count / reviews.length) * 100}%` }}
                />
              </span>
              <span className="text-latte w-4 text-right tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-latte/20 divide-y">
        {reviews.map((r) => (
          <li key={r.id} className="py-5">
            <div className="flex items-center justify-between gap-3">
              <Rating value={r.rating} />
              <time dateTime={r.createdAt.toISOString()} className="text-latte text-xs">
                {dateFormat.format(r.createdAt)}
              </time>
            </div>
            <h3 className="font-body mt-2 text-base font-semibold">{r.title}</h3>
            <p className="mt-1 text-sm leading-relaxed">{r.body}</p>
            <p className="text-latte mt-2 text-xs">
              {r.authorName}
              {r.verified ? ' · Verified buyer' : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
