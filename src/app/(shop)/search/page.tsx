import type { Metadata } from 'next';
import { SearchForm } from '@/components/layout/search-form';
import { ProductGrid } from '@/components/product/product-grid';
import { Container } from '@/components/ui/container';
import { searchProducts } from '@/lib/db/queries/catalog';
import { SearchTracker } from './search-tracker';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : (raw ?? '')).slice(0, 80);
  const items = query ? await searchProducts(query) : [];

  return (
    <Container className="py-12">
      <div className="mb-8 max-w-xl">
        <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">Search</p>
        <h1 className="text-4xl">{query ? <>Results for “{query}”</> : 'Search the shop'}</h1>
        <SearchForm className="mt-6" defaultValue={query} />
        {query ? (
          <p className="text-latte mt-3 text-sm" data-testid="search-count">
            {items.length} {items.length === 1 ? 'result' : 'results'}
          </p>
        ) : null}
      </div>
      {query ? (
        <ProductGrid
          items={items}
          listId="search"
          emptyMessage="Nothing matched. Try an origin like “Ethiopia” or a note like “chocolate”."
        />
      ) : null}
      <SearchTracker query={query} resultCount={items.length} />
    </Container>
  );
}
