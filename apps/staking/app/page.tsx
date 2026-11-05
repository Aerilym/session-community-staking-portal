import { Footer } from '@/components/Footer';
import { LandingExplorerSection } from '@/components/LandingExplorerSection';
import { LANDING_BUTTON_URL, SOCIALS } from '@/lib/constants';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { Social } from '@session/ui/components/SocialLinkList';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { cn } from '@session/ui/lib/utils';
import { Button } from '@session/ui/ui/button';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';

const PrimaryButton = ({ size, className }: { size: 'sm' | 'lg'; className?: string }) => {
  const dictionary = useTranslations('home');

  return (
    <Link href={LANDING_BUTTON_URL.PRIMARY} prefetch className={className}>
      <Button size={size} data-testid={ButtonDataTestId.Home_Primary} className="uppercase">
        {dictionary('buttons.primary')}
      </Button>
    </Link>
  );
};

const SecondaryButton = ({ size, className }: { size: 'sm' | 'lg'; className?: string }) => {
  const dictionary = useTranslations('home');

  return (
    <Link href={LANDING_BUTTON_URL.SECONDARY} target="_blank" prefetch className={className}>
      <Button
        size={size}
        data-testid={ButtonDataTestId.Home_Secondary}
        variant="outline"
        className="uppercase"
      >
        {dictionary('buttons.secondary')}
      </Button>
    </Link>
  );
};

const CommunityBadge = () => {
  const dictionary = useTranslations('home');

  return (
    <Link
      href={LANDING_BUTTON_URL.COMMUNITY}
      target="_blank"
      prefetch
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-session-green/50 bg-session-green/10',
        'px-4 py-1.5 font-medium text-session-green text-xs uppercase backdrop-blur-sm',
        'tracking-widest transition-colors hover:bg-session-green/20'
      )}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-session-green" aria-hidden />
      {dictionary('communityBadge')}
    </Link>
  );
};

const CommunityButton = ({ size, className }: { size: 'sm' | 'lg'; className?: string }) => {
  const dictionary = useTranslations('home');

  return (
    <Link href={LANDING_BUTTON_URL.COMMUNITY} target="_blank" prefetch className={className}>
      <Button
        size={size}
        data-testid={ButtonDataTestId.Home_Community}
        variant="outline"
        className="border-session-green/50 uppercase hover:border-session-green"
      >
        {dictionary('buttons.community')}
      </Button>
    </Link>
  );
};

const COMMUNITY_CALLOUTS = [
  {
    dictionaryKey: 'mainSite',
    href: LANDING_BUTTON_URL.COMMUNITY,
  },
  {
    dictionaryKey: 'forum',
    href: SOCIALS[Social.Session].link,
  },
  {
    dictionaryKey: 'openSource',
    href: SOCIALS[Social.Github].link,
  },
] as const;

type CommunityCallout = (typeof COMMUNITY_CALLOUTS)[number];

const CommunityCalloutCard = ({ dictionaryKey, href }: CommunityCallout) => {
  const dictionary = useTranslations('home');

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group rounded-lg bg-module-outline p-px bg-blend-lighten shadow-md',
        'transition-all ease-in-out hover:brightness-125'
      )}
    >
      <div className="flex h-full flex-col items-start justify-between gap-6 rounded-[0.45rem] bg-module p-6">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium text-lg text-session-green">
            {dictionary(`community.cards.${dictionaryKey}.title`)}
          </h4>
          <p className="text-muted-foreground text-sm">
            {dictionary(`community.cards.${dictionaryKey}.description`)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 font-medium text-session-green text-sm">
          {dictionary(`community.cards.${dictionaryKey}.cta`)}
          <span
            className="group-hover:-translate-y-0.5 inline-block transition-transform group-hover:translate-x-0.5"
            aria-hidden
          >
            <LinkOutIcon className="h-4 w-4" />
          </span>
        </span>
      </div>
    </a>
  );
};

const CommunitySection = () => {
  const dictionary = useTranslations('home');

  return (
    <section className="flex w-full max-w-screen-3xl flex-col gap-10 px-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h3 className="font-medium font-monument-extended text-2xl md:text-4xl">
          {dictionary('community.title')}
        </h3>
        <p className="text-balance text-muted-foreground md:text-lg">
          {dictionary('community.description')}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COMMUNITY_CALLOUTS.map(({ dictionaryKey, href }) => (
          <CommunityCalloutCard key={dictionaryKey} dictionaryKey={dictionaryKey} href={href} />
        ))}
      </div>
    </section>
  );
};

export default function LandingPage() {
  const dictionary = useTranslations('home');
  return (
    <div className={cn('mx-auto flex flex-col items-center justify-center gap-10 overflow-hidden')}>
      <div
        className={cn(
          'flex w-screen max-w-screen-3xl flex-col-reverse items-center justify-around py-16 align-middle',
          'md:-mt-header-displacement',
          'lg:grid lg:grid-cols-2 lg:gap-x-48 lg:p-8',
          'xl:p-32 xl:pt-72'
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-10 align-middle',
            'md:-mt-header-displacement',
            'lg:mt-0'
          )}
        >
          <div className={'flex flex-col items-center gap-6 lg:items-start'}>
            <CommunityBadge />
            <div
              className={'flex flex-col items-center justify-start backdrop-blur-sm lg:items-start'}
            >
              <h1 className="whitespace-nowrap text-center font-medium 3xl:text-8xl text-5xl md:text-7xl lg:text-start">
                {dictionary.rich('title')}
              </h1>
              <h2
                className={cn(
                  'whitespace-nowrap text-center font-medium 3xl:text-8xl text-3xl md:text-4xl lg:text-start xl:text-7xl'
                )}
              >
                {dictionary('titleDescription')}
              </h2>
            </div>
          </div>
          <div className="flex flex-row flex-wrap items-center justify-center gap-4 lg:justify-start">
            <SecondaryButton size="sm" className="lg:hidden" />
            <PrimaryButton size="sm" className="lg:hidden" />
            <CommunityButton size="sm" className="lg:hidden" />
            <PrimaryButton size="lg" className="hidden lg:inline" />
            <SecondaryButton size="lg" className="hidden lg:inline" />
            <CommunityButton size="lg" className="hidden lg:inline" />
          </div>
        </div>
        <div className="-z-10 flex max-w-[50vh] items-center justify-center overflow-hidden align-middle lg:max-w-full">
          <Image
            src="/images/cube.png"
            alt={dictionary('heroImageAlt')}
            height={1024}
            width={1024}
            priority
          />
        </div>
      </div>
      <LandingExplorerSection />
      <CommunitySection />
      <Footer />
    </div>
  );
}
