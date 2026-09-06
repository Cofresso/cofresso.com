import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'copper' | 'leaf' | 'espresso';
const tones: Record<Tone, string> = {
  neutral: 'bg-latte/20 text-espresso',
  copper: 'bg-copper/15 text-copper-dark',
  leaf: 'bg-leaf/15 text-leaf',
  espresso: 'bg-espresso text-foam',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
