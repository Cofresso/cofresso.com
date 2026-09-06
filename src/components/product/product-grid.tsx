import type { ProductCardData } from '@/lib/catalog/types';
import { ProductCard } from './product-card';
import { ProductListTracker } from './product-list-tracker';

interface ProductGridProps {
  items: ProductCardData[];
  listId: string;
  emptyMessage?: string;
}

export function ProductGrid({
  items,
  listId,
  emptyMessage = 'No products match those filters yet.',
}: ProductGridProps) {
  if (items.length === 0) {
    return (
      <p className="bg-foam text-latte rounded-2xl p-10 text-center" data-testid="empty-grid">
        {emptyMessage}
      </p>
    );
  }
  return (
    <>
      <div
        className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4"
        data-testid="product-grid"
      >
        {items.map((item, i) => (
          <ProductCard key={item.product.id} data={item} priority={i < 4} />
        ))}
      </div>
      <ProductListTracker listId={listId} items={items} />
    </>
  );
}
