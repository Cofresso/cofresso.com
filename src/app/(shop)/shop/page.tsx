import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product/product-grid';
import { ShopFilters } from '@/components/product/shop-filters';
import { Container } from '@/components/ui/container';
import { listCollections, listOrigins, listProducts } from '@/lib/db/queries/catalog';
import { parseProductFilters, type RawSearchParams } from '@/lib/shop/filters';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Single origins, blends, decaf and the gear to brew them.',
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseProductFilters(await searchParams);
  const [items, collections, origins] = await Promise.all([
    listProducts(filters),
    listCollections(),
    listOrigins(),
  ]);

  return (
    <Container className="py-12">
      <div className="mb-8">
        <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">Shop</p>
        <h1 className="text-4xl sm:text-5xl">All coffee &amp; gear</h1>
      </div>
      <ShopFilters
        filters={filters}
        collections={collections}
        origins={origins}
        resultCount={items.length}
      />
      <ProductGrid items={items} listId="shop" />
    </Container>
  );
}
