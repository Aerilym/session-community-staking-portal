import { STAKE_STATE } from '@/lib/stake-state';
import {
  type NodeSnapshot,
  resolveCurrentNodes,
  resolveNodeStateNotifications,
} from '../lib/notifications/node-transitions';
import { ARBITRUM_EVENT, EXIT_TYPE } from '@session/staking-api-js/enums';
import type { ArbitrumEvent } from '@session/staking-api-js/schema';
import type { Ed25519PublicKey } from '@session/util-crypto/keys';

const ED25519_KEY = (n: number) => `e${`${n}`.padStart(63, '0')}` as Ed25519PublicKey;

const event = (name: ARBITRUM_EVENT, block: number) => ({ name, block }) as ArbitrumEvent;

const BLOCK_HEIGHT = 1000;

type SnapshotOverrides = Partial<NodeSnapshot>;

const runningSnapshot = (overrides: SnapshotOverrides = {}): NodeSnapshot => ({
  pubkey_ed25519: ED25519_KEY(1),
  fetched_block_height: 1000,
  registration_height: 100,
  active: true,
  events: [event(ARBITRUM_EVENT.NewServiceNodeV2, 100)],
  exit_type: null,
  deregistration_height: null,
  requested_unlock_height: 0,
  ...overrides,
});

const deregisteredSnapshot = (overrides: SnapshotOverrides = {}): NodeSnapshot =>
  runningSnapshot({
    exit_type: EXIT_TYPE.DEREGISTER,
    deregistration_height: 500,
    events: [event(ARBITRUM_EVENT.ServiceNodeLiquidated, 200)],
    ...overrides,
  });

const awaitingExitSnapshot = (overrides: SnapshotOverrides = {}): NodeSnapshot =>
  runningSnapshot({
    events: [event(ARBITRUM_EVENT.ServiceNodeExitRequest, 200)],
    requested_unlock_height: 600,
    ...overrides,
  });

/** Runs one worker tick and returns the notifications plus the states to persist. */
const tick = (previousStates: ReadonlyMap<string, string>, nodes: NodeSnapshot[]) =>
  resolveNodeStateNotifications(previousStates, nodes, BLOCK_HEIGHT);

describe('resolveCurrentNodes', () => {
  it('keeps a single entry per key', () => {
    const node = runningSnapshot();
    expect(resolveCurrentNodes([node])).toEqual(new Map([[node.pubkey_ed25519, node]]));
  });

  it('keeps distinct keys apart', () => {
    const a = runningSnapshot({ pubkey_ed25519: ED25519_KEY(1) });
    const b = runningSnapshot({ pubkey_ed25519: ED25519_KEY(2) });
    const resolved = resolveCurrentNodes([a, b]);
    expect(resolved.size).toBe(2);
    expect(resolved.get(ED25519_KEY(1))).toBe(a);
    expect(resolved.get(ED25519_KEY(2))).toBe(b);
  });

  it('collapses duplicate keys to the freshest snapshot regardless of order', () => {
    const stale = deregisteredSnapshot({ fetched_block_height: 900, registration_height: 100 });
    const current = runningSnapshot({ fetched_block_height: 1000, registration_height: 200 });

    for (const entries of [
      [stale, current],
      [current, stale],
    ]) {
      expect(resolveCurrentNodes(entries)).toEqual(new Map([[current.pubkey_ed25519, current]]));
    }
  });

  it('breaks fetched_block_height ties by the latest registration (newest generation)', () => {
    const oldGeneration = deregisteredSnapshot({ fetched_block_height: 1000, registration_height: 100 });
    const newGeneration = runningSnapshot({ fetched_block_height: 1000, registration_height: 200 });

    expect(resolveCurrentNodes([oldGeneration, newGeneration])).toEqual(
      new Map([[newGeneration.pubkey_ed25519, newGeneration]])
    );
  });
});

describe('resolveNodeStateNotifications', () => {
  it('never notifies when seeding a node for the first time', () => {
    const { notifications } = tick(new Map(), [deregisteredSnapshot()]);
    expect(notifications).toEqual([]);
  });

  it('notifies once when a running node is genuinely deregistered, then never again', () => {
    const key = ED25519_KEY(1);
    let states = tick(new Map(), [runningSnapshot()]).currentStates;
    expect(states.get(key)).toBe(STAKE_STATE.RUNNING);

    const deregistered = tick(states, [deregisteredSnapshot()]);
    expect(deregistered.notifications).toEqual([
      { node: deregisteredSnapshot(), state: STAKE_STATE.DEREGISTERED },
    ]);
    expect(deregistered.currentStates.get(key)).toBe(STAKE_STATE.DEREGISTERED);

    for (let i = 0; i < 3; i++) {
      const repeat = tick(deregistered.currentStates, [deregisteredSnapshot()]);
      expect(repeat.notifications).toEqual([]);
      expect(repeat.currentStates.get(key)).toBe(STAKE_STATE.DEREGISTERED);
    }
  });

  it('does not re-notify ready-to-exit when the node is subsequently deregistered by the network', () => {
    let states = tick(new Map(), [runningSnapshot()]).currentStates;

    const awaitingExit = tick(states, [awaitingExitSnapshot()]);
    expect(awaitingExit.notifications).toEqual([
      { node: awaitingExitSnapshot(), state: STAKE_STATE.AWAITING_EXIT },
    ]);

    const deregistered = tick(awaitingExit.currentStates, [deregisteredSnapshot()]);
    expect(deregistered.notifications).toEqual([]);
    expect(deregistered.currentStates.get(ED25519_KEY(1))).toBe(STAKE_STATE.DEREGISTERED);
  });

  it('does not notify an exit request until the unlock height is reached', () => {
    let states = tick(new Map(), [runningSnapshot()]).currentStates;

    const unlockNotReached = new Map([
      [ED25519_KEY(1), { ...awaitingExitSnapshot(), requested_unlock_height: BLOCK_HEIGHT + 1 }],
    ]);
    expect(tick(states, [...unlockNotReached.values()]).notifications).toEqual([]);

    const unlockReached = tick(states, [awaitingExitSnapshot()]);
    expect(unlockReached.notifications).toEqual([
      { node: awaitingExitSnapshot(), state: STAKE_STATE.AWAITING_EXIT },
    ]);
  });

  it('notifies when a running node is decommissioned but not when it recovers', () => {
    let states = tick(new Map(), [runningSnapshot()]).currentStates;

    const decommissioned = tick(states, [runningSnapshot({ active: false })]);
    expect(decommissioned.notifications).toEqual([
      { node: runningSnapshot({ active: false }), state: STAKE_STATE.DECOMMISSIONED },
    ]);

    const recovered = tick(decommissioned.currentStates, [runningSnapshot()]);
    expect(recovered.notifications).toEqual([]);
    expect(recovered.currentStates.get(ED25519_KEY(1))).toBe(STAKE_STATE.RUNNING);
  });

  it('does not notify a transition into a non-notifiable state', () => {
    let states = tick(new Map(), [runningSnapshot()]).currentStates;

    const exited = tick(states, [
      runningSnapshot({
        exit_type: EXIT_TYPE.EXIT,
        events: [event(ARBITRUM_EVENT.ServiceNodeExit, 300)],
      }),
    ]);
    expect(exited.notifications).toEqual([]);
    expect(exited.currentStates.get(ED25519_KEY(1))).toBe(STAKE_STATE.EXITED);
  });

  describe('regression: duplicate generations for the same node key', () => {
    // The `/nodes` endpoint returns an entry per registration, so a node that was
    // deregistered and re-registered appears twice with the same ed25519 key: a stale
    // deregistered generation and the current running generation. This previously caused a
    // spurious "deregistered" notification on every worker tick.
    const currentGeneration = runningSnapshot({
      fetched_block_height: 1000,
      registration_height: 200,
    });
    const staleGeneration = deregisteredSnapshot({
      fetched_block_height: 900,
      registration_height: 100,
    });

    it('seeds without notifying and never notifies on subsequent ticks', () => {
      const seed = tick(new Map(), [staleGeneration, currentGeneration]);
      expect(seed.notifications).toEqual([]);
      expect(seed.currentStates.get(ED25519_KEY(1))).toBe(STAKE_STATE.RUNNING);

      let states = seed.currentStates;
      for (let i = 0; i < 5; i++) {
        const next = tick(states, [staleGeneration, currentGeneration]);
        expect(next.notifications).toEqual([]);
        expect(next.currentStates.get(ED25519_KEY(1))).toBe(STAKE_STATE.RUNNING);
        states = next.currentStates;
      }
    });

    it('notifies exactly once when the current generation itself is deregistered', () => {
      const seed = tick(new Map(), [staleGeneration, currentGeneration]);

      const deregistered = tick(seed.currentStates, [
        staleGeneration,
        runningSnapshot({
          fetched_block_height: 1001,
          registration_height: 200,
          exit_type: EXIT_TYPE.DEREGISTER,
          deregistration_height: 500,
          events: [event(ARBITRUM_EVENT.ServiceNodeLiquidated, 400)],
        }),
      ]);
      expect(deregistered.notifications).toHaveLength(1);
      expect(deregistered.notifications[0]?.state).toBe(STAKE_STATE.DEREGISTERED);
    });
  });
});
