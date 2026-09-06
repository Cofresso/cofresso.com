export const siteConfig = {
  name: 'Cofresso',
  tagline: 'Specialty coffee, framed right.',
  description:
    'Cofresso roasts small-batch specialty coffee for people who care about every detail, from farm altitude to grind size.',
  currency: 'USD' as const,
  locale: 'en-US',
  supportEmail: 'hello@cofresso.com',
  easterEggUrl: 'https://github.com/coframe/coffee',
  pricing: {
    subscriptionDiscountPercent: 15,
    shippingFlatCents: 600,
    freeShippingThresholdCents: 4500,
    taxRate: 0.08,
  },
  subscriptionIntervals: [2, 4, 6] as const,
  nav: [
    { href: '/shop', label: 'Shop' },
    { href: '/collections/single-origin', label: 'Single Origin' },
    { href: '/collections/blends', label: 'Blends' },
    { href: '/collections/equipment', label: 'Equipment' },
    { href: '/brew-guides', label: 'Brew Guides' },
    { href: '/about', label: 'About' },
  ],
  footerLinks: [
    { href: '/faq', label: 'FAQ' },
    { href: '/orders', label: 'Track an order' },
    { href: '/about', label: 'Our story' },
  ],
};

export type SubscriptionInterval = (typeof siteConfig.subscriptionIntervals)[number];
