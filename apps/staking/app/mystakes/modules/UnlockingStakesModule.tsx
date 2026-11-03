'use client';

import DynamicModuleCard from '@/app/mystakes/modules/DynamicModuleCard';
import type { AddressModuleProps } from '@/app/mystakes/modules/types';
import { SeshAmountWithUsd } from '@/components/FiatUsd';
import { useNetworkBalances } from '@/hooks/useNetworkBalances';
import { DYNAMIC_MODULE, URL } from '@/lib/constants';
import { externalLink } from '@/lib/locale-defaults';
import type { QUERY_STATUS } from '@/lib/query';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { useTranslations } from 'next-intl';

export default function UnlockingStakesModule({
  addressOverride,
  size,
  variant,
}: AddressModuleProps) {
  const dict = useTranslations('modules.unlockingStakes');

  const { timeLockedStakes, refetch, status, enabled } = useNetworkBalances({
    addressOverride,
  });

  return (
    <DynamicModuleCard
      titleLong={dict('title')}
      titleShort={dict('titleShort')}
      tooltipContent={dict.rich('description', {
        link: externalLink(URL.LEARN_MORE_TOTAL_REWARDS),
      })}
      status={status as QUERY_STATUS}
      refetch={refetch}
      enabled={enabled}
      size={size}
      variant={variant}
    >
      <SeshAmountWithUsd
        amount={timeLockedStakes ?? null}
        formatted={formatSENTBigInt(timeLockedStakes, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
      />
    </DynamicModuleCard>
  );
}
