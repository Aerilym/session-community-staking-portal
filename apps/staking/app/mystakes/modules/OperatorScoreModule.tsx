'use client';

import DynamicModuleCard from '@/app/mystakes/modules/DynamicModuleCard';
import type { AddressModuleProps } from '@/app/mystakes/modules/types';
import { BACKEND, PREFERENCE, URL } from '@/lib/constants';
import { formatDate } from '@/lib/locale-client';
import type { QUERY_STATUS } from '@/lib/query';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { usePreferences } from 'usepref';
import type { Address } from 'viem';
import { z } from 'zod';

const operatorScoreSchema = z.object({
  last_updated: z.number(),
  n_operators: z.number().int(),
  score: z.number().int().nullable(),
  rank: z.number().int().nullable(),
});

export type OperatorScore = z.infer<typeof operatorScoreSchema>;

const formatScoreTimeMedium = (unixSeconds: number) =>
  formatDate(new Date(unixSeconds * 1000), { dateStyle: 'medium', timeStyle: 'short' });

const formatSignedScore = (score: number) => `${score > 0 ? '+' : ''}${score}`;

export function useOperatorScore({ addressOverride }: { addressOverride?: Address }) {
  const { address: connectedAddress } = useWallet();
  const address = addressOverride ?? connectedAddress;
  const { getItem } = usePreferences();

  const autoRefresh = !getItem<boolean>(PREFERENCE.DISABLE_BACKEND_AUTO_REFRESH);

  const query = useQuery({
    queryKey: ['operatorScore', address],
    enabled: !!address,
    refetchInterval: autoRefresh ? BACKEND.NODE_TARGET_UPDATE_INTERVAL_SECONDS * 1000 : false,
    queryFn: async (): Promise<OperatorScore> => {
      const res = await fetch(`${URL.SESH_TOKEN_EXPLORER}/api/operators/score/${address}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch operator score: ${res.status}`);
      }

      return operatorScoreSchema.parse(await res.json());
    },
  });

  return { ...query, enabled: !!address };
}

export default function OperatorScoreModule({
  addressOverride,
  titleOverride,
  size,
  variant,
}: AddressModuleProps) {
  const dict = useTranslations('modules.operatorScore');

  const { data, status, refetch, enabled } = useOperatorScore({ addressOverride });
  const notScored = !!data && (data.score === null || data.rank === null);
  const date = data ? formatScoreTimeMedium(data.last_updated) : null;

  return (
    <DynamicModuleCard
      titleLong={titleOverride ?? dict('title')}
      tooltipContent={
        notScored ? dict('notScoredDescription') : dict.rich('description', { date_time: date })
      }
      status={status as QUERY_STATUS}
      refetch={refetch}
      enabled={enabled}
      size={size}
      variant={variant}
    >
      {data ? (
        data.score === null || data.rank === null ? (
          <span className="inline-flex flex-col items-start gap-2.5 align-middle">
            <span className="mt-0.5 text-muted-foreground text-sm">{dict('notScored')}</span>
            <a
              href={`${URL.SESH_TOKEN_EXPLORER}/operators`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-session-green text-sm underline underline-offset-2"
            >
              {dict('viewOperatorsCount', { count: data.n_operators })}
              <LinkOutIcon className="h-4 w-4" />
            </a>
          </span>
        ) : (
          <span className="inline-flex flex-col items-start gap-0.5 align-middle">
            <span className={data.score >= 0 ? 'text-session-green' : 'text-indicator-red'}>
              {formatSignedScore(data.score)}
            </span>
            <span className="text-muted-foreground text-sm">
              <a
                href={`${URL.SESH_TOKEN_EXPLORER}/operators`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:text-session-green"
              >
                {dict('rank', { rank: data.rank, total: data.n_operators })}
                <LinkOutIcon className="h-4 w-4" />
              </a>
            </span>
          </span>
        )
      ) : (
        '—'
      )}
    </DynamicModuleCard>
  );
}
