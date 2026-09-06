import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product/product-grid';
import { ShopFilters } from '@/components/product/shop-filters';
import { Container } from '@/components/ui/container';
import {
  getCollectionBySlug,
  listCollections,
  listOrigins,
  listProducts,
} from '@/lib/db/queries/catalog';
import { parseProductFilters, type RawSearchParams } from '@/lib/shop/filters';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = await getCollectionBySlug((await params).slug);
  return collection
    ? { title: collection.name, description: collection.description }
    : { title: 'Collection' };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const filters = { ...parseProductFilters(await searchParams), collection: slug };
  const [items, collections, origins] = await Promise.all([
    listProducts(filters),
    listCollections(),
    listOrigins(),
  ]);

  return (
    <Container className="py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
          Collection
        </p>
        <h1 className="text-4xl sm:text-5xl" data-testid="collection-title">
          {collection.name}
        </h1>
        <p className="text-latte mt-3">{collection.description}</p>
      </div>
      <ShopFilters
        filters={filters}
        collections={collections}
        origins={origins}
        resultCount={items.length}
        lockCollection
      />
      <ProductGrid items={items} listId={`collection_${slug}`} />
    </Container>
  );
}
