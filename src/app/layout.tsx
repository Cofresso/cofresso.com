import type { Metadata } from 'next';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { ConsoleEasterEgg } from '@/components/analytics/console-easter-egg';
import { ThirdPartyScripts } from '@/components/analytics/third-party-scripts';
import { Interruptions } from '@/components/interruptions/interruptions';
import { CartDrawer } from '@/components/layout/cart-drawer';
import { CartDrawerProvider } from '@/components/layout/cart-drawer-context';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { MobileNavProvider } from '@/components/layout/mobile-nav-context';
import { MobileNavSheet } from '@/components/layout/mobile-nav-sheet';
import { siteConfig } from '@/lib/config';
import { getServerEnv } from '@/lib/env';
import { fraunces, inter } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const base = getServerEnv().SITE_URL;
  return {
    metadataBase: new URL(base),
    title: {
      default: `${siteConfig.name} — ${siteConfig.tagline}`,
      template: `%s · ${siteConfig.name}`,
    },
    description: siteConfig.description,
    openGraph: { type: 'website', siteName: siteConfig.name, images: ['/logo.png'] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <CartDrawerProvider>
          <MobileNavProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
            <MobileNavSheet />
            <Interruptions />
          </MobileNavProvider>
        </CartDrawerProvider>
        <AnalyticsProvider />
        <ConsoleEasterEgg />
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
