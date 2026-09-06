import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { siteConfig } from '@/lib/config';
import { Logo } from './logo';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-latte/20 bg-foam mt-24 border-t">
      <Container className="grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="text-latte mt-4 max-w-sm text-sm">{siteConfig.description}</p>
        </div>
        <div>
          <h3 className="font-body text-latte text-xs font-semibold tracking-[0.2em] uppercase">
            Shop
          </h3>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {siteConfig.nav.slice(0, 4).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-copper">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-body text-latte text-xs font-semibold tracking-[0.2em] uppercase">
            Help
          </h3>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {siteConfig.footerLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-copper">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-copper">
                {siteConfig.supportEmail}
              </a>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-latte/20 border-t">
        <Container className="text-latte flex flex-col items-center justify-between gap-2 py-5 text-xs sm:flex-row">
          <p>© {year} Cofresso Coffee Co. All rights reserved.</p>
          <p>
            Made with{' '}
            <a
              href={siteConfig.easterEggUrl}
              className="hover:text-copper"
              title="The beans are open source"
              data-testid="easter-egg-link"
              rel="noopener"
            >
              ☕
            </a>{' '}
            in a very small roastery.
          </p>
        </Container>
      </div>
    </footer>
  );
}
