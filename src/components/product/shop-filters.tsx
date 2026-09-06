'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/select';
import { ROAST_OPTIONS } from '@/lib/catalog/labels';
import type { Collection } from '@/lib/db/schema';
import { filtersToSearchParams, SORT_OPTIONS, type ProductFilters } from '@/lib/shop/filters';

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
  const [pending, start] = useTransition();

  const update = (patch: Partial<ProductFilters>) => {
    const next = { ...filters, ...patch } as ProductFilters;
    for (const key of Object.keys(next) as (keyof ProductFilters)[])
      if (next[key] === undefined || next[key] === '') delete next[key];
    if (!next.sort) next.sort = 'featured';
    const qs = filtersToSearchParams(next).toString();
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
              update({
                roast: undefined,
                origin: undefined,
                collection: lockCollection ? filters.collection : undefined,
              })
            }
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
