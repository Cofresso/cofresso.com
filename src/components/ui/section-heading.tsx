import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'text-center sm:flex-col sm:items-center',
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-copper mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-3xl leading-tight sm:text-4xl">{title}</h2>
        {description ? <p className="text-latte mt-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
