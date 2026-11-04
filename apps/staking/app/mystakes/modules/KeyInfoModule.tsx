'use client';

import { useSeshPrice } from '@/app/mystakes/modules/PriceModule';
import { useTotalStaked } from '@/app/mystakes/modules/useTotalStaked';
import { SeshAmountWithUsd } from '@/components/FiatUsd';
import { ModuleOverlayTitle } from '@/components/ModuleOverlayTitle';
import { useDailyRewards } from '@/hooks/useDailyRewards';
import { DYNAMIC_MODULE } from '@/lib/constants';
import { formatPercentage } from '@/lib/locale-client';
import { computeAprFraction } from '@/lib/parseDailyRewards';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { Module } from '@session/ui/components/Module';
import { QuestionIcon } from '@session/ui/icons/QuestionIcon';
import { Tooltip } from '@session/ui/ui/tooltip';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export default function KeyInfoModule() {
  const dict = useTranslations('modules.keyInfo');
  const titleFormat = useTranslations('modules.title');

  const { totalStaked } = useTotalStaked();
  const { daily } = useDailyRewards();
  const price = useSeshPrice();

  const rewardsAmount = daily?.rewardAmount ?? null;

  const aprPercent =
    daily && totalStaked !== null && totalStaked > 0n
      ? computeAprFraction(daily, totalStaked)
      : null;

  return (
    <Module size="lg">
      <ModuleOverlayTitle longText={titleFormat('format', { title: dict('title') })} />
      <div className="flex w-full flex-row flex-wrap justify-between gap-2">
        <KeyInfoStat
          label={dict('totalStaked')}
          tooltipContent={dict('totalStakedTooltip')}
          value={
            totalStaked !== null ? (
              <SeshAmountWithUsd
                amount={totalStaked}
                formatted={formatSENTBigInt(totalStaked, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
                price={price}
              />
            ) : null
          }
        />
        <KeyInfoStat
          label={dict('dailyRewards')}
          tooltipContent={dict('dailyRewardsTooltip')}
          value={
            rewardsAmount !== null ? (
              <SeshAmountWithUsd
                amount={rewardsAmount}
                formatted={formatSENTBigInt(rewardsAmount, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
                price={price}
              />
            ) : null
          }
        />
        <KeyInfoStat
          label={dict('apr')}
          tooltipContent={dict('aprTooltip')}
          value={
            aprPercent !== null ? (
              <span className="inline-flex flex-col items-baseline gap-1 text-nowrap align-middle">
                {formatPercentage(aprPercent)}
                <span className="text-muted-foreground text-sm">{dict('current')}</span>
              </span>
            ) : null
          }
        />
      </div>
    </Module>
  );
}

function KeyInfoStat({
  label,
  value,
  tooltipContent,
}: {
  label: string;
  value: ReactNode;
  tooltipContent: string;
}) {
  return (
    <div className="flex flex-col items-start justify-center text-start">
      <span className="inline-flex flex-row gap-1 text-muted-foreground text-sm">
        {label}
        <InfoTooltip>{tooltipContent}</InfoTooltip>
      </span>
      <span className="text-2xl">{value ?? '—'}</span>
    </div>
  );
}

function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip tooltipContent={children} putContentInPortal>
      <div className="cursor-pointer self-center">
        <QuestionIcon className="h-3 w-3 fill-muted-foreground" />
      </div>
    </Tooltip>
  );
}
