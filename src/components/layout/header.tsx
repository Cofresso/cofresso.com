import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { IconSearch } from '@/components/ui/icons';
import { siteConfig } from '@/lib/config';
import { getCurrentCart } from '@/lib/cart/request-cache';
import { CartButton } from './cart-button';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';

export async function Header() {
  const cart = await getCurrentCart();
  const count = cart?.totals.itemCount ?? 0;

  return (
    <header className="border-latte/20 bg-cream/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="bg-espresso text-foam text-center text-xs" data-testid="announcement-bar">
        <Container className="py-2">
          Free shipping on orders over $45 · Subscribe &amp; save 15%
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Logo />
        </div>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-espresso/80 hover:text-espresso text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SearchForm className="hidden w-56 lg:block" />
          <Link href="/search" className="rounded-full p-2 lg:hidden" aria-label="Search">
            <span className="sr-only">Search</span>
            <IconSearch width={22} height={22} />
          </Link>
          <CartButton count={count} />
        </div>
      </Container>
    </header>
  );
}
