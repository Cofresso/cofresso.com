import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import logo from '../../../public/logo.png';

export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2.5', className)}
      aria-label="Cofresso home"
    >
      <Image src={logo} alt="" width={36} height={36} priority className="size-9" />
      {wordmark ? (
        <span className="font-display text-2xl font-semibold tracking-tight">Cofresso</span>
      ) : null}
    </Link>
  );
}
