'use client';

import { cn } from '@/lib/utils';
import { IconMinus, IconPlus } from './icons';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled,
  label = 'Quantity',
  size = 'md',
  className,
}: QuantityStepperProps) {
  const btn = cn(
    'flex items-center justify-center text-espresso disabled:opacity-40',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  return (
    <div
      className={cn(
        'border-latte/50 bg-foam inline-flex items-center rounded-full border',
        className,
      )}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <IconMinus width={16} height={16} />
      </button>
      <span
        className={cn('min-w-8 text-center tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <IconPlus width={16} height={16} />
      </button>
    </div>
  );
}
