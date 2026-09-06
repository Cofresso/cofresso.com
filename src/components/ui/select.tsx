import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'border-latte/50 bg-foam text-espresso focus:ring-espresso/40 h-11 w-full appearance-none rounded-lg border px-3 pr-9 text-base focus:ring-2 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="text-latte pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
