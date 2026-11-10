import { BASE_URL } from '@/lib/constants';
import { getTranslations } from 'next-intl/server';

const SITE_IMAGE = `${BASE_URL}/images/link_preview.png`;
// const SITE_ICON = `${BASE_URL}/images/icon.png`;

export const siteMetadata = async (props: {
  title?: string;
  description?: string;
  image?: string;
}) => {
  const dict = await getTranslations('metadata.root');
  const { title, description = dict('description'), image = SITE_IMAGE } = props;
  return {
    metadataBase: new URL('https://stake.seshtoken.info'),
    title: `${title ? `${title} | ` : ''}${dict('title')}`,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
        },
      ],
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
