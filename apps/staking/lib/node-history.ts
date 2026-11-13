import type { NodeGeneration } from '@/lib/node-history-schema';

/** States of a generation that is still running on the network */
const ACTIVE_GENERATION_STATES = new Set(['Running', 'Decommissioned', 'Ready To Exit']);

/** Whether the generation is still staked on the network */
export function isActiveGeneration(generation: NodeGeneration): boolean {
  return ACTIVE_GENERATION_STATES.has(generation.state);
}

export type NodeHistorySummary = {
  /** Ended generations (exited, liquidated or deregistered) */
  previousGenerations: number;
  /** Total days staked across ended generations */
  totalUptimeDays: number;
  /** Generations that exited normally (operator requested unlock) */
  normalExits: number;
  /** Generations ended by liquidation (missed obligations) */
  liquidations: number;
  /** Generations ended by network deregistration */
  deregistrations: number;
  /** Whether any generation of this node key is currently staked on the network */
  keyCurrentlyActive: boolean;
  /** Ended generations, oldest first */
  endedGenerations: Array<NodeGeneration>;
};

/** Summarises the generation history of a node key for display */
export function summarizeNodeHistory(generations: Array<NodeGeneration>): NodeHistorySummary {
  const endedGenerations = generations.filter(({ end_timestamp }) => end_timestamp !== null);

  return {
    previousGenerations: endedGenerations.length,
    totalUptimeDays: endedGenerations.reduce(
      (acc, { duration_days }) => acc + (duration_days ?? 0),
      0
    ),
    normalExits: endedGenerations.filter(({ end_label }) => end_label === 'Exited').length,
    liquidations: endedGenerations.filter(({ end_label }) => end_label === 'Liquidated').length,
    deregistrations: endedGenerations.filter(({ end_label }) => end_label === 'Deregistered')
      .length,
    keyCurrentlyActive: generations.some((generation) => isActiveGeneration(generation)),
    endedGenerations,
  };
}
