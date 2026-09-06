import type { MetadataRoute } from 'next';
import { brewGuides } from '@/lib/content/brew-guides';
import { listCollections, listProductSlugs } from '@/lib/db/queries/catalog';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().SITE_URL;
  const [products, collections] = await Promise.all([listProductSlugs(), listCollections()]);
  const staticRoutes = ['', '/shop', '/about', '/faq', '/brew-guides', '/orders'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
  return [
    ...staticRoutes,
    ...collections.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...brewGuides.map((g) => ({
      url: `${base}/brew-guides/${g.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
