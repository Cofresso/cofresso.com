import { IconSearch } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function SearchForm({
  className,
  defaultValue = '',
}: {
  className?: string;
  defaultValue?: string;
}) {
  return (
    <form action="/search" method="get" role="search" className={cn('relative', className)}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search coffee, gear…"
        className="border-latte/40 bg-foam placeholder:text-latte focus:ring-espresso/30 h-10 w-full rounded-full border pr-4 pl-10 text-sm focus:ring-2 focus:outline-none"
      />
      <IconSearch
        className="text-latte pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        width={16}
        height={16}
      />
    </form>
  );
}
