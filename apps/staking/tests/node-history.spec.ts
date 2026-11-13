import type { NodeGeneration } from '../lib/node-history-schema';
import { isActiveGeneration, summarizeNodeHistory } from '../lib/node-history';

function createGeneration(overrides: Partial<NodeGeneration> = {}): NodeGeneration {
  return {
    contract_id: 1,
    state: 'Exited',
    registration_timestamp: 1_700_000_000,
    end_timestamp: 1_708_640_000,
    end_label: 'Exited',
    duration_days: 100,
    contributor_count: 4,
    decommission_count: 0,
    operator_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    operator_fee: 2500,
    ...overrides,
  };
}

describe('isActiveGeneration', () => {
  it('is true for running, decommissioned and ready-to-exit states', () => {
    expect(isActiveGeneration(createGeneration({ state: 'Running', end_timestamp: null, end_label: null, duration_days: null }))).toBe(true);
    expect(isActiveGeneration(createGeneration({ state: 'Decommissioned', end_timestamp: null, end_label: null, duration_days: null }))).toBe(true);
    expect(isActiveGeneration(createGeneration({ state: 'Ready To Exit', end_timestamp: null, end_label: null, duration_days: null }))).toBe(true);
  });

  it('is false for ended states', () => {
    expect(isActiveGeneration(createGeneration())).toBe(false);
    expect(isActiveGeneration(createGeneration({ state: 'Deregistered', end_label: 'Deregistered' }))).toBe(false);
  });
});

describe('summarizeNodeHistory', () => {
  it('returns zeroed summary for an empty history', () => {
    const summary = summarizeNodeHistory([]);
    expect(summary.previousGenerations).toBe(0);
    expect(summary.totalUptimeDays).toBe(0);
    expect(summary.normalExits).toBe(0);
    expect(summary.liquidations).toBe(0);
    expect(summary.deregistrations).toBe(0);
    expect(summary.keyCurrentlyActive).toBe(false);
  });

  it('counts outcomes and sums uptime across ended generations', () => {
    const summary = summarizeNodeHistory([
      createGeneration({ contract_id: 1, duration_days: 100, end_label: 'Exited' }),
      createGeneration({ contract_id: 2, duration_days: 50, end_label: 'Liquidated' }),
      createGeneration({ contract_id: 3, duration_days: 25, end_label: 'Deregistered' }),
    ]);

    expect(summary.previousGenerations).toBe(3);
    expect(summary.totalUptimeDays).toBeCloseTo(175);
    expect(summary.normalExits).toBe(1);
    expect(summary.liquidations).toBe(1);
    expect(summary.deregistrations).toBe(1);
    expect(summary.keyCurrentlyActive).toBe(false);
  });

  it('ignores active generations in outcome counts but flags the key as active', () => {
    const summary = summarizeNodeHistory([
      createGeneration({ contract_id: 1, duration_days: 100, end_label: 'Exited' }),
      createGeneration({
        contract_id: 2,
        state: 'Running',
        end_timestamp: null,
        end_label: null,
        duration_days: null,
      }),
    ]);

    expect(summary.previousGenerations).toBe(1);
    expect(summary.normalExits).toBe(1);
    expect(summary.keyCurrentlyActive).toBe(true);
  });
});
