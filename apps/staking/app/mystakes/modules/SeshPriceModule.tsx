'use client';

import DynamicModuleCard from '@/app/mystakes/modules/DynamicModuleCard';
import { useHistoricalPriceQuery } from '@/app/mystakes/modules/PriceModule';
import { formatDate, formatUSD } from '@/lib/locale-client';
import type { QUERY_STATUS } from '@/lib/query';
import { useTranslations } from 'next-intl';

const formatPriceTimeMedium = (unixSeconds: number) =>
  formatDate(new Date(unixSeconds * 1000), { dateStyle: 'medium', timeStyle: 'short' });

export default function SeshPriceModule() {
  const dict = useTranslations('modules.seshPrice');
  const dictPrice = useTranslations('modules.price');
  const { data, status, refetch } = useHistoricalPriceQuery();

  const first = data?.length ? data[0] : undefined;
  const last = data?.length ? data[data.length - 1] : undefined;
  const date = last ? formatPriceTimeMedium(last.t) : null;

  // Price change over the fetched window (7 days)
  const diff = first && last ? last.price - first.price : null;
  const diffPercent = diff !== null && first && first.price > 0 ? (diff / first.price) * 100 : null;

  return (
    <DynamicModuleCard
      titleLong={dict('title')}
      tooltipContent={dictPrice.rich('description', { date_time: date })}
      status={status as QUERY_STATUS}
      refetch={refetch}
      enabled
    >
      {last && diff !== null && diffPercent !== null ? (
        <span className="inline-flex flex-col items-start gap-0.5 align-middle">
          <span>{formatUSD(last.price)}</span>
          <span className={`text-sm ${diff >= 0 ? 'text-session-green' : 'text-indicator-red'}`}>
            <span className="text-muted-foreground">7d</span>{' '}
            {`${diff >= 0 ? '+' : '-'}${formatUSD(Math.abs(diff), { maximumFractionDigits: 3 })} (${diff >= 0 ? '+' : '-'}${Math.abs(diffPercent).toFixed(1)}%)`}
          </span>
        </span>
      ) : (
        '—'
      )}
    </DynamicModuleCard>
  );
}
