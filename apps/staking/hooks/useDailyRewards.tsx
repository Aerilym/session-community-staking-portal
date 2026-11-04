import { BACKEND, PREFERENCE } from '@/lib/constants';
import { parseDailyRewards } from '@/lib/parseDailyRewards';
import { getDailyRewards } from '@/lib/queries/getDailyRewards';
import { useStakingBackendQueryWithParams } from '@/lib/staking-api-client';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useMemo } from 'react';
import { usePreferences } from 'usepref';
import type { Address } from 'viem';

export const useDailyRewards = (params?: { addressOverride?: Address }) => {
  const { address: connectedAddress } = useWallet();
  const { getItem } = usePreferences();
  const address = params?.addressOverride ?? connectedAddress;

  const autoRefresh = !getItem<boolean>(PREFERENCE.DISABLE_BACKEND_AUTO_REFRESH);

  const enabled = !!address;

  const { data, status, refetch } = useStakingBackendQueryWithParams(
    getDailyRewards,
    {
      address: address!,
    },
    {
      enabled,
      refetchInterval: autoRefresh ? BACKEND.NODE_TARGET_UPDATE_INTERVAL_SECONDS * 1000 : undefined,
    }
  );

  const parsedData = useMemo(() => {
    if (!data) {
      return { daily: null };
    }
    return parseDailyRewards(data.rewards, Math.trunc(Date.now() / 1000));
  }, [data]);

  return {
    ...parsedData,
    refetch,
    status,
    enabled,
  };
};
