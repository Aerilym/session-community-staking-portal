'use client';

import { useTotalStaked } from '@/app/mystakes/modules/useTotalStaked';
import { SeshAmountWithUsd } from '@/components/FiatUsd';
import { useDailyRewards } from '@/hooks/useDailyRewards';
import { DYNAMIC_MODULE } from '@/lib/constants';
import { formatPercentage } from '@/lib/locale-client';
import { SENT_DECIMALS } from '@session/contracts';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { Module } from '@session/ui/components/Module';
import { QuestionIcon } from '@session/ui/icons/QuestionIcon';
import { Tooltip } from '@session/ui/ui/tooltip';
import { bigIntToNumber } from '@session/util-crypto/maths';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export default function KeyInfoModule() {
  const dict = useTranslations('modules.keyInfo');

  const { totalStaked } = useTotalStaked();
  const { dailyRewardAmount } = useDailyRewards();
  const dailyRewards = dailyRewardAmount ?? null;

  // NOTE: the user's effective APY, 24h rewards annualised over their stake
  const apyPercent =
    totalStaked !== null && totalStaked > 0n && dailyRewards !== null
      ? (bigIntToNumber(dailyRewards, SENT_DECIMALS) * 365) /
        bigIntToNumber(totalStaked, SENT_DECIMALS)
      : null;

  return (
    <Module
      size="lg"
      className="[&>div:not([class*='absolute'])]:!p-2 md:[&>div:not([class*='absolute'])]:!p-3"
    >
      <div className="flex w-full flex-row flex-wrap justify-between gap-2">
        <KeyInfoStat
          label={dict('totalStaked')}
          tooltipContent={dict('totalStakedTooltip')}
          value={
            totalStaked !== null ? (
              <SeshAmountWithUsd
                amount={totalStaked}
                formatted={formatSENTBigInt(totalStaked, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
              />
            ) : null
          }
        />
        <KeyInfoStat
          label={dict('dailyRewards')}
          tooltipContent={dict('dailyRewardsTooltip')}
          value={
            dailyRewards !== null ? (
              <SeshAmountWithUsd
                amount={dailyRewards}
                formatted={formatSENTBigInt(dailyRewards, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
              />
            ) : null
          }
        />
        <KeyInfoStat
          label={dict('apy')}
          tooltipContent={dict('apyTooltip')}
          value={
            apyPercent !== null ? (
              <span className="inline-flex flex-col items-baseline gap-1 text-nowrap align-middle">
                {formatPercentage(apyPercent)}
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
}: { label: string; value: ReactNode; tooltipContent: string }) {
  return (
    <div className="flex flex-col items-start justify-center gap-1 text-start">
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
