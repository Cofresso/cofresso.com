import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function Rating({ value, count, size = 'sm', className }: RatingProps) {
  const rounded = Math.round(value * 2) / 2;
  const dim = size === 'sm' ? 'size-3.5' : 'size-5';
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={cn(dim, i <= rounded ? 'text-copper' : 'text-latte/40')}
            fill="currentColor"
          >
            <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8z" />
          </svg>
        ))}
      </span>
      {typeof count === 'number' ? <span className="text-latte text-xs">({count})</span> : null}
    </span>
  );
}
