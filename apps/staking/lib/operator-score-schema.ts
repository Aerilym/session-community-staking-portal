import { z } from 'zod';

/**
 * Operator score summary from the SESH token explorer API.
 * @see https://seshtoken.info/api/operators/score
 */
export const operatorScoreSummarySchema = z.object({
  score: z.number().int().nullable(),
  rank: z.number().int().nullable(),
  n_active_nodes: z.number().int(),
  /** Unix timestamp (seconds) of the operator's first node registration. Null if unknown. */
  first_registration_timestamp: z.number().nullable(),
  /** Average age of the operator's active nodes in days. Null if the operator has no active nodes. */
  avg_node_age_days: z.number().nullable(),
  /** Number of the operator's nodes deregistered in the last 60 days. */
  deregistrations_recent: z.number().int(),
  /** Number of the operator's nodes deregistered 60-90 days ago. */
  deregistrations_longterm: z.number().int(),
  /** Number of the operator's active nodes not running the latest version. Null when the
   *  latest version hasn't reached majority network adoption (no penalty applies). */
  outdated_version_nodes: z.number().int().nullable(),
  /** Unique IPs per active node (1 = one IP per node). Null if the operator has no active nodes. */
  ip_per_node: z.number().nullable(),
  /** Number of unique IPs across the operator's active nodes. Null if the operator has no active nodes. */
  n_unique_ips: z.number().int().nullable(),
  /** Average operator fee across the operator's active nodes, in percent times 100 (10,000 = 100%). Null if unknown. */
  fee_avg: z.number().nullable(),
  attributes: z.array(z.string()),
  modifiers: z.array(z.string()),
});

export type OperatorScoreSummary = z.infer<typeof operatorScoreSummarySchema>;

export const operatorScoreBatchResponseSchema = z.object({
  last_updated: z.number(),
  n_operators: z.number().int(),
  /** Median operator fee of multicontributor network nodes, in percent times 100
   *  (10,000 = 100%), matching the units of fee_avg. */
  median_operator_fee: z.number().nullable(),
  /** Operator summaries keyed by lowercased address. Addresses without data are omitted. */
  operators: z.record(z.string(), operatorScoreSummarySchema),
});

export type OperatorScoreBatchResponse = z.infer<typeof operatorScoreBatchResponseSchema>;

/** Query key for the full operator scores dataset (shared by the server-side
 *  prefetch and the client hook so hydrated cache entries match). */
export const OPERATOR_SCORES_QUERY_KEY = ['operatorScores'] as const;
