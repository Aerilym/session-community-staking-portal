import { NEXT_PUBLIC_SITE_URL } from '@/lib/env';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/mystakes', '/faucet', '/leaderboard', '/sw.js'],
    },
    sitemap: `${NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
