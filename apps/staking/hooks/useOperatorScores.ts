'use client';

import { QUERY } from '@/lib/constants';
import {
  OPERATOR_SCORES_QUERY_KEY,
  type OperatorScoreSummary,
  operatorScoreBatchResponseSchema,
} from '@/lib/operator-score-schema';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Compat shim: seshtoken.info deployments before the unit normalization serve
 * `median_operator_fee` in raw node-fee units (1,000,000 = 100%). Values above
 * 10,000 (= 100%, the maximum possible fee) can only be raw units, so convert
 * them to percent times 100. Remove once all deployments serve the normalized
 * units.
 */
function normalizeMedianOperatorFee(value: number | null): number | null {
  return value !== null && value > 10_000 ? value / 100 : value;
}

/**
 * Fetches the operator scores dataset (all operators + median fee) from the
 * SESH token explorer via the same-origin `/api/operators` proxy. The query is
 * prefetched on the server and hydrated, so cached data renders immediately
 * without a client fetch.
 *
 * @returns A map of lowercased operator address to score summary (operators
 *          without data are omitted) and the median operator fee of
 *          multicontributor network nodes in percent times 100 (10,000 = 100%).
 */
export function useOperatorScores() {
  const query = useQuery({
    queryKey: OPERATOR_SCORES_QUERY_KEY,
    staleTime: QUERY.STALE_TIME_OPERATOR_SCORES,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/api/operators/score');

      if (!res.ok) {
        throw new Error(`Failed to fetch operator scores: ${res.status}`);
      }

      return operatorScoreBatchResponseSchema.parse(await res.json());
    },
  });

  const operatorScores = useMemo(() => {
    const map = new Map<string, OperatorScoreSummary>();
    if (query.data) {
      for (const [address, summary] of Object.entries(query.data.operators)) {
        map.set(address, summary);
      }
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    /** Lookup of lowercased operator address to score summary */
    operatorScores,
    /** Total number of rated operators on the network */
    nOperators: query.data?.n_operators ?? null,
    /** Median operator fee of multicontributor network nodes, in percent times 100 (10,000 = 100%) */
    medianOperatorFee: query.data
      ? normalizeMedianOperatorFee(query.data.median_operator_fee)
      : null,
  };
}
