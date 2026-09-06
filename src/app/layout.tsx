import type { Metadata } from 'next';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { ConsoleEasterEgg } from '@/components/analytics/console-easter-egg';
import { ThirdPartyScripts } from '@/components/analytics/third-party-scripts';
import { fraunces, inter } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Cofresso — Specialty coffee, framed right', template: '%s · Cofresso' },
  description: 'Small-batch specialty coffee roasted for people who care about every detail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        {children}
        <AnalyticsProvider />
        <ConsoleEasterEgg />
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
