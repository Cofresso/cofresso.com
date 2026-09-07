import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Product art is local SVG, served as-is.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Next serves the first format the browser's Accept header advertises
    // support for, so AVIF must come first or it is effectively inert.
    formats: ['image/avif', 'image/webp'],
    // Generated photography lives in the CDN-backed assets bucket, served by
    // the same load balancer under /assets/* (see infra/loadbalancer.tf).
    remotePatterns: [{ protocol: 'https', hostname: 'cofresso.com', pathname: '/assets/**' }],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.cofresso.com' }],
        destination: 'https://cofresso.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
