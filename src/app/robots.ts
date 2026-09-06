import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = getServerEnv().SITE_URL;
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/checkout', '/orders', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
