import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().SITE_URL;
  const staticRoutes = ['', '/shop', '/about', '/faq', '/brew-guides', '/orders'];
  return staticRoutes.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
