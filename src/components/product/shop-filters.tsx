'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { Select } from '@/components/ui/select';
import { ROAST_OPTIONS } from '@/lib/catalog/labels';
import type { Collection } from '@/lib/db/schema';
import {
  filtersToSearchParams,
  parseProductFilters,
  SORT_OPTIONS,
  type ProductFilters,
} from '@/lib/shop/filters';

interface ShopFiltersProps {
  filters: ProductFilters;
  collections: Collection[];
  origins: string[];
  resultCount: number;
  lockCollection?: boolean;
}

export function ShopFilters({
  filters,
  collections,
  origins,
  resultCount,
  lockCollection = false,
}: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  // Each change patches the *query string*, never the `filters` prop: that prop is the state
  // of the last completed server render, so two quick changes would both patch the same old
  // state and the second would resurrect whatever the first cleared.
  //
  // `useSearchParams()` (like `window.location`) only reflects the last *committed*
  // navigation — Next.js updates both from an effect on the router state — so it is stale
  // for exactly as long as the transition is pending. Patch the query we last asked for
  // instead, and resync from the URL whenever no navigation of ours is in flight (our own
  // navigation committed, or the user used back/forward).
  const observedQuery = searchParams.toString();
  const requestedQuery = useRef(observedQuery);
  useEffect(() => {
    if (!pending) requestedQuery.current = observedQuery;
  }, [observedQuery, pending]);

  const update = (patch: Partial<ProductFilters>) => {
    const current = parseProductFilters(
      Object.fromEntries(new URLSearchParams(requestedQuery.current)),
    );
    const next = { ...current, ...patch } as ProductFilters;
    for (const key of Object.keys(next) as (keyof ProductFilters)[])
      if (next[key] === undefined || next[key] === '') delete next[key];
    if (!next.sort) next.sort = 'featured';
    const qs = filtersToSearchParams(next).toString();
    requestedQuery.current = qs;
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const hasFilters = Boolean(
    filters.roast || filters.origin || (!lockCollection && filters.collection),
  );

  return (
    <div
      className="bg-foam mb-8 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:flex-wrap sm:items-end"
      data-testid="shop-filters"
      aria-busy={pending}
    >
      {!lockCollection ? (
        <label className="text-latte flex flex-1 flex-col gap-1 text-xs font-medium">
          Collection
          <Select
            value={filters.collection ?? ''}
            onChange={(e) => update({ collection: e.target.value || undefined })}
            data-testid="filter-collection"
          >
            <option value="">All</option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="text-latte flex flex-1 flex-col gap-1 text-xs font-medium">
        Roast
        <Select
          value={filters.roast ?? ''}
          onChange={(e) =>
            update({ roast: (e.target.value || undefined) as ProductFilters['roast'] })
          }
          data-testid="filter-roast"
        >
          <option value="">Any</option>
          {ROAST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-latte flex flex-1 flex-col gap-1 text-xs font-medium">
        Origin
        <Select
          value={filters.origin ?? ''}
          onChange={(e) => update({ origin: e.target.value || undefined })}
          data-testid="filter-origin"
        >
          <option value="">Any</option>
          {origins.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-latte flex flex-1 flex-col gap-1 text-xs font-medium">
        Sort
        <Select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as ProductFilters['sort'] })}
          data-testid="filter-sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>
      <div className="text-latte flex items-center justify-between gap-4 text-sm sm:ml-auto">
        <span data-testid="result-count">
          {resultCount} {resultCount === 1 ? 'product' : 'products'}
        </span>
        {hasFilters ? (
          <button
            type="button"
            className="hover:text-espresso underline-offset-2 hover:underline"
            onClick={() =>
              // On a collection page the collection comes from the path, not the query.
              update({ roast: undefined, origin: undefined, collection: undefined })
            }
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
