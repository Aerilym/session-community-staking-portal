'use client';

import { QUERY } from '@/lib/constants';
import { type NodeHistoryResponse, nodeHistoryResponseSchema } from '@/lib/node-history-schema';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetches the generation history of a node key (previous stakes sharing the
 * same ed25519/BLS key family) from the SESH token explorer via the same-origin
 * `/api/node` proxy.
 *
 * @param pubKey The node's ed25519 public key.
 */
export function useNodeHistory(pubKey: string) {
  return useQuery({
    queryKey: ['nodeHistory', pubKey],
    staleTime: QUERY.STALE_TIME_OPERATOR_SCORES,
    retry: 1,
    queryFn: async (): Promise<NodeHistoryResponse> => {
      const res = await fetch(`/api/node/${pubKey}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch node history: ${res.status}`);
      }

      return nodeHistoryResponseSchema.parse(await res.json());
    },
  });
}
