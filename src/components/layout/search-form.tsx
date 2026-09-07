import { useId } from 'react';
import { IconSearch } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function SearchForm({
  className,
  defaultValue = '',
  ariaLabel = 'Search products',
}: {
  className?: string;
  defaultValue?: string;
  /** Distinguishes this instance's `role="search"` landmark and input label when
   * more than one SearchForm is mounted on the page at once (e.g. the header's
   * and the mobile nav sheet's). */
  ariaLabel?: string;
}) {
  const inputId = useId();
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label={ariaLabel}
      className={cn('relative', className)}
    >
      <label htmlFor={inputId} className="sr-only">
        {ariaLabel}
      </label>
      <input
        id={inputId}
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
