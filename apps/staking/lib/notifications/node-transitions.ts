import { STAKE_STATE, type StakeStateInput, parseStakeState } from '@/lib/stake-state';
import type { NodesResponse } from '@session/staking-api-js/schema';

/**
 * Pure node state transition logic for the notifications worker. This module is free of
 * side effects (no database, no push, no server-only imports) so it can be unit tested.
 */

type NetworkNode = NodesResponse['nodes'][number];

/**
 * Minimal structural view of a node snapshot. The `/nodes` endpoint returns full
 * {@link NetworkNode} entries, while tests can build partial snapshots.
 */
export type NodeSnapshot = StakeStateInput &
  Pick<NetworkNode, 'pubkey_ed25519' | 'fetched_block_height' | 'registration_height'>;

/**
 * States that trigger a notification when transitioned into. `Deregistered` is included
 * because a deregistered node that has not been exited yet is ready for exit (the stake
 * can be reclaimed by the contributor).
 */
export const NOTIFIABLE_STATES = new Set<string>([
  STAKE_STATE.DECOMMISSIONED,
  STAKE_STATE.AWAITING_EXIT,
  STAKE_STATE.DEREGISTERED,
]);

/**
 * States that mean the node is ready to exit (either the contributor requested the exit or
 * the network deregistered the node). Both share the `ready-for-exit` notification, which
 * should only be sent once per node.
 */
export const READY_TO_EXIT_STATES = new Set<string>([
  STAKE_STATE.AWAITING_EXIT,
  STAKE_STATE.DEREGISTERED,
]);

/**
 * The `/nodes` endpoint returns an entry per registration, so a re-registered node appears
 * multiple times: a stale entry for the previous (e.g. deregistered) generation alongside the
 * current one. Collapses entries to the freshest snapshot per ed25519 key.
 */
export function resolveCurrentNodes(nodes: NodeSnapshot[]): Map<string, NodeSnapshot> {
  const currentNodes = new Map<string, NodeSnapshot>();

  for (const node of nodes) {
    const existing = currentNodes.get(node.pubkey_ed25519);
    if (!existing || isFresherSnapshot(node, existing)) {
      currentNodes.set(node.pubkey_ed25519, node);
    }
  }

  return currentNodes;
}

function isFresherSnapshot(node: NodeSnapshot, other: NodeSnapshot) {
  return (
    node.fetched_block_height > other.fetched_block_height ||
    (node.fetched_block_height === other.fetched_block_height &&
      node.registration_height > other.registration_height)
  );
}

export interface NodeStateNotification {
  node: NodeSnapshot;
  state: string;
}

/**
 * Compares the current node snapshots against the previously seen states and resolves the
 * notifications to send, along with the updated states to persist.
 *
 * Notifications are only sent for transitions into a {@link NOTIFIABLE_STATES} state, never
 * when seeding a node for the first time, and the `ready-for-exit` notification is only sent
 * on the first transition into a {@link READY_TO_EXIT_STATES} state.
 */
export function resolveNodeStateNotifications(
  previousStates: ReadonlyMap<string, string>,
  nodes: NodeSnapshot[],
  blockHeight: number
): { notifications: NodeStateNotification[]; currentStates: Map<string, string> } {
  const notifications: NodeStateNotification[] = [];
  const currentStates = new Map<string, string>();

  for (const [nodeKey, node] of resolveCurrentNodes(nodes)) {
    const newState = parseStakeState(node, blockHeight);
    const previousState = previousStates.get(nodeKey);
    currentStates.set(nodeKey, newState);

    if (previousState === newState) continue;
    if (!previousState || !NOTIFIABLE_STATES.has(newState)) continue;
    if (READY_TO_EXIT_STATES.has(previousState) && READY_TO_EXIT_STATES.has(newState)) continue;

    notifications.push({ node, state: newState });
  }

  return { notifications, currentStates };
}
