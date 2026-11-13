import {
  OPERATOR_SCORES_QUERY_KEY,
  type OperatorScoreBatchResponse,
  operatorScoreBatchResponseSchema,
} from '@/lib/operator-score-schema';

/**
 * Fetches the operator scores dataset (all operators + median fee) from the
 * SESH token explorer for server-side prefetching.
 *
 * Uses the Next.js data cache (revalidate 300) so concurrent requests and
 * rebuilds reuse a single upstream fetch.
 */
export async function fetchOperatorScoresForServer(): Promise<OperatorScoreBatchResponse> {
  const baseUrl = process.env.OPERATOR_INFO_API_URL ?? 'https://seshtoken.info';

  const res = await fetch(`${baseUrl}/api/operators/score`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch operator scores: ${res.status}`);
  }

  return operatorScoreBatchResponseSchema.parse(await res.json());
}

export const operatorScoresServerPrefetch = {
  queryKey: OPERATOR_SCORES_QUERY_KEY,
  queryFn: fetchOperatorScoresForServer,
};
