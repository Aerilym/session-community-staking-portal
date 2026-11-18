import { NEXT_PUBLIC_SITE_URL } from '@/lib/env';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${NEXT_PUBLIC_SITE_URL}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${NEXT_PUBLIC_SITE_URL}/stake`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${NEXT_PUBLIC_SITE_URL}/register`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${NEXT_PUBLIC_SITE_URL}/vested-stakes`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];
}
