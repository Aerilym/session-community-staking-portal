import { z } from 'zod';

export const nodeGenerationSchema = z.object({
  contract_id: z.number().int(),
  /** Lifecycle state of the generation, eg: Running, Exited, Deregistered */
  state: z.string(),
  /** Unix timestamp (seconds) the generation registered, estimated from block height */
  registration_timestamp: z.number(),
  /** Unix timestamp (seconds) the generation ended, or null if still active */
  end_timestamp: z.number().nullable(),
  /** How the generation ended, eg: Exited, Liquidated, Deregistered. Null if still active */
  end_label: z.string().nullable(),
  /** Days between registration and end. Null if still active */
  duration_days: z.number().nullable(),
  contributor_count: z.number().int(),
  decommission_count: z.number().int(),
  operator_address: z.string(),
  /** Operator fee in percent times 100 (10,000 = 100%) */
  operator_fee: z.number(),
});

export type NodeGeneration = z.infer<typeof nodeGenerationSchema>;

export const nodeHistoryResponseSchema = z.object({
  last_updated: z.number(),
  /** Number of known generations for the node key family (0 if the key is new) */
  n_generations: z.number().int(),
  /** Generations sharing the node key family, oldest first */
  generations: z.array(nodeGenerationSchema),
});

export type NodeHistoryResponse = z.infer<typeof nodeHistoryResponseSchema>;
