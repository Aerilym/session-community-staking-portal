'use client';

import DynamicModuleCard from '@/app/mystakes/modules/DynamicModuleCard';
import { useSeshPrice } from '@/app/mystakes/modules/PriceModule';
import type { AddressModuleProps } from '@/app/mystakes/modules/types';
import { SeshAmountWithUsd } from '@/components/FiatUsd';
import { useDailyRewards } from '@/hooks/useDailyRewards';
import { DYNAMIC_MODULE } from '@/lib/constants';
import { formatDate } from '@/lib/locale-client';
import type { QUERY_STATUS } from '@/lib/query';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

const formatDateTime = (unixSeconds: number) =>
  formatDate(new Date(unixSeconds * 1000), { dateStyle: 'medium', timeStyle: 'medium' });

export default function DailyRewardsModule({
  addressOverride,
  titleOverride,
  size,
  variant,
}: AddressModuleProps) {
  const dict = useTranslations('modules.addressDailyRewards');

  const { address: connectedAddress } = useWallet();
  const address = useMemo(
    () => addressOverride ?? connectedAddress,
    [addressOverride, connectedAddress]
  );

  const { daily, refetch, status, enabled } = useDailyRewards({
    addressOverride: address,
  });
  const price = useSeshPrice();

  const formattedStartDate = useMemo(
    () => (daily ? formatDateTime(daily.rewardFrom) : null),
    [daily]
  );

  const formattedEndDate = useMemo(() => (daily ? formatDateTime(daily.rewardTo) : null), [daily]);

  return (
    <DynamicModuleCard
      titleLong={titleOverride ?? dict('title')}
      titleShort={dict('titleShort')}
      tooltipContent={dict.rich('description', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      })}
      status={status as QUERY_STATUS}
      refetch={refetch}
      enabled={enabled}
      size={size}
      variant={variant}
    >
      <SeshAmountWithUsd
        amount={daily?.rewardAmount ?? null}
        formatted={formatSENTBigInt(
          daily?.rewardAmount ?? null,
          DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS
        )}
        price={price}
      />
    </DynamicModuleCard>
  );
}
