import { describe, expect, it } from 'vitest';
import { filtersToSearchParams, parseProductFilters } from './filters';

describe('parseProductFilters', () => {
  it('defaults to featured sort with no filters', () => {
    expect(parseProductFilters({})).toEqual({ sort: 'featured' });
  });
  it('accepts known values and drops unknown ones', () => {
    expect(
      parseProductFilters({
        collection: 'blends',
        roast: 'light',
        sort: 'price_asc',
        origin: 'Kenya',
        bogus: 'x',
      }),
    ).toEqual({
      collection: 'blends',
      roast: 'light',
      origin: 'Kenya',
      sort: 'price_asc',
    });
    expect(parseProductFilters({ roast: 'burnt', sort: 'sideways' })).toEqual({ sort: 'featured' });
  });
  it('takes the first value of repeated params', () => {
    expect(parseProductFilters({ collection: ['decaf', 'blends'] }).collection).toBe('decaf');
  });
  it('round-trips through search params', () => {
    const f = parseProductFilters({ collection: 'blends', sort: 'newest' });
    expect(filtersToSearchParams(f).toString()).toBe('collection=blends&sort=newest');
    expect(filtersToSearchParams(parseProductFilters({})).toString()).toBe('');
  });
});
