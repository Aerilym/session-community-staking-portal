'use client';

import { useHistoricalPriceQuery } from '@/app/mystakes/modules/PriceModule';
import { EXPLORER_LINKS, ExplorerSearch } from '@/components/ExplorerSearch';
import { formatDate, formatUSD } from '@/lib/locale-client';
import { ModuleTooltip } from '@session/ui/components/Module';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { cn } from '@session/ui/lib/utils';
import { Button } from '@session/ui/ui/button';
import { useTranslations } from 'next-intl';

export function LandingExplorerSection() {
  const dictionary = useTranslations('home.explorer');
  const priceDictionary = useTranslations('modules.price');
  const { data } = useHistoricalPriceQuery();

  const first = data?.length ? data[0] : null;
  const last = data?.length ? (data[data.length - 1] ?? null) : null;
  const price = last?.price ?? null;
  const diffPercent =
    first && last && first.price > 0 ? ((last.price - first.price) / first.price) * 100 : null;
  const lastUpdated =
    last != null
      ? formatDate(new Date(last.t * 1000), { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <section className="flex w-full max-w-screen-3xl flex-col items-center px-8 py-16">
      <div
        className={cn(
          'w-full max-w-3xl rounded-lg bg-module-outline p-px bg-blend-lighten shadow-md',
          'transition-all ease-in-out hover:brightness-125'
        )}
      >
        <div className="flex flex-col items-center gap-6 rounded-md bg-module p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <h3 className="font-medium font-monument-extended text-2xl md:text-4xl">
              {dictionary('title')}
            </h3>
            <p className="max-w-2xl text-balance text-muted-foreground md:text-lg">
              {dictionary('tagline')}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-widest">
                {priceDictionary('title')}
              </span>
              {lastUpdated != null ? (
                <ModuleTooltip>
                  {priceDictionary.rich('description', { date_time: lastUpdated })}
                </ModuleTooltip>
              ) : null}
            </div>
            <span className="font-medium font-monument-extended text-4xl md:text-5xl">
              {price != null ? formatUSD(price) : '—'}
            </span>
            {diffPercent != null ? (
              <span
                className={cn(
                  'font-medium text-sm',
                  diffPercent >= 0 ? 'text-session-green' : 'text-destructive'
                )}
              >
                {diffPercent >= 0 ? '+' : ''}
                {diffPercent.toFixed(2)}% ({dictionary('weekChange')})
              </span>
            ) : null}
          </div>
          <ExplorerSearch className="w-full max-w-xl" />
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
            {EXPLORER_LINKS.map(({ label, href, testId }) => (
              <Button
                key={href}
                asChild
                variant="outline"
                size="sm"
                className="flex w-full items-center justify-between px-4"
                data-testid={testId}
              >
                <a href={href} target="_blank" rel="noreferrer">
                  {label}
                  <LinkOutIcon className="h-4 w-4" />
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
