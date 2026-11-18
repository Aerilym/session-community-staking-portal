import { NEXT_PUBLIC_SITE_URL } from '@/lib/env';
import { getTranslations } from 'next-intl/server';

const SITE_IMAGE = `${NEXT_PUBLIC_SITE_URL}/images/link_preview.png`;

export const siteMetadata = async (props: {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
}) => {
  const dict = await getTranslations('metadata.root');
  const { title, description = dict('description'), image = SITE_IMAGE, path } = props;
  const fullTitle = `${title ? `${title} | ` : ''}${dict('title')}`;
  const canonical = path ? `${NEXT_PUBLIC_SITE_URL}${path}` : NEXT_PUBLIC_SITE_URL;
  return {
    metadataBase: new URL(NEXT_PUBLIC_SITE_URL),
    title: fullTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      siteName: dict('title'),
      locale: 'en',
      title: fullTitle,
      description,
      url: canonical,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: dict('title'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
    icons: {
      icon: [
        { url: '/images/favicon.svg', type: 'image/svg+xml' },
        { url: '/images/favicon.ico', sizes: '16x16 32x32' },
        { url: '/images/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/images/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/images/favicon-48.png', sizes: '48x48', type: 'image/png' },
      ],
      apple: '/images/apple-touch-icon.png',
    },
    appleWebApp: {
      capable: true,
      title: 'SESH Community Staking',
      statusBarStyle: 'black-translucent',
    },
  };
};
