import Image from 'next/image';
import type { ThumbnailImage } from '@/lib/catalog/types';
import { cn } from '@/lib/utils';

/**
 * Small product picture for cart lines, the checkout summary and order history. Renders
 * the resolved `thumbnailImage` in a 4:5 box so a square photograph and the 4:5 SVG
 * fallback take up the same space. Size it with width classes via `className`.
 */
export function ProductThumbnail({
  image,
  sizes,
  decorative = false,
  className,
}: {
  image: ThumbnailImage;
  /** The `sizes` hint for the optimizer, matching the width classes in `className`. */
  sizes: string;
  /** Hide from assistive tech when the product name is already announced next to it. */
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'bg-cream relative block aspect-[4/5] shrink-0 overflow-hidden rounded-lg',
        className,
      )}
      data-testid="product-thumbnail"
    >
      <Image
        src={image.src}
        alt={decorative ? '' : image.alt}
        aria-hidden={decorative || undefined}
        fill
        sizes={sizes}
        // Product art SVGs are served as-is; photographs go through the optimizer.
        unoptimized={image.src.endsWith('.svg')}
        className="object-cover"
      />
    </span>
  );
}
