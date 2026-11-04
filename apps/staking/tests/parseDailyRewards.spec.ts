import {
  computeAprFraction,
  parseDailyRewards,
  SECONDS_PER_DAY,
  type RewardsWindow,
} from '@/lib/parseDailyRewards';
import { SENT_DECIMALS } from '@session/contracts';
import type { DailyRewardInfo } from '@session/staking-api-js/schema';

const NOW = 1_800_000_000;
const DAY = SECONDS_PER_DAY;

const atomic = (sesh: number) => BigInt(sesh) * 10n ** BigInt(SENT_DECIMALS);

const entry = (secondsAgo: number, lifetimeRewardsAtomic: bigint): DailyRewardInfo => ({
  block: 1,
  lifetime_rewards: Number(lifetimeRewardsAtomic),
  timestamp: NOW - secondsAgo,
});

describe('parseDailyRewards', () => {
  it('counts every reward event inside the trailing 24h window', () => {
    const drip = atomic(2);
    const rewards: Array<DailyRewardInfo> = [];
    let lifetime = 0n;
    for (let hoursAgo = 48; hoursAgo >= 0; hoursAgo -= 2) {
      lifetime += drip;
      rewards.push(entry(hoursAgo * 3600, lifetime));
    }

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily).not.toBeNull();
    expect(daily?.rewardAmount).toBe(drip * 13n);
  });

  it('includes the first in-range event when a pre-cutoff baseline exists', () => {
    const rewards = [entry(DAY + 3600, atomic(100)), entry(3600, atomic(100 + 5))];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily?.rewardAmount).toBe(atomic(5));
  });

  it('uses the last pre-cutoff event as the baseline', () => {
    const rewards = [
      entry(30 * 3600, atomic(100)),
      entry(28 * 3600, atomic(110)),
      entry(20 * 3600, atomic(115)),
      entry(2 * 3600, atomic(120)),
    ];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily?.rewardFrom).toBe(NOW - 28 * 3600);
    expect(daily?.rewardTo).toBe(NOW - 2 * 3600);
    expect(daily?.rewardAmount).toBe(atomic(120) - atomic(110));
  });

  it('annualises over the actual observation span for sparse events', () => {
    const rewards = [
      entry(30 * 3600, atomic(100)),
      entry(28 * 3600, atomic(110)),
      entry(2 * 3600, atomic(110 + 10)),
    ];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily?.rewardSpanSeconds).toBe(28 * 3600);
    expect(daily?.dailyAverageAmount).toBe((atomic(10) * BigInt(DAY)) / BigInt(28 * 3600));
  });

  it('falls back to the first in-range event when history does not reach the window start', () => {
    const rewards = [entry(10 * 3600, atomic(3)), entry(2 * 3600, atomic(3 + 4))];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily?.rewardFrom).toBe(NOW - 10 * 3600);
    expect(daily?.rewardSpanSeconds).toBe(10 * 3600);
    expect(daily?.rewardAmount).toBe(atomic(4));
    expect(daily?.dailyAverageAmount).toBe((atomic(4) * BigInt(DAY)) / BigInt(10 * 3600));
  });

  it('returns a null daily window for rewards older than 24h', () => {
    const rewards = [entry(3 * DAY, atomic(10)), entry(2 * DAY, atomic(10 + 14))];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily).toBeNull();
  });

  it('returns null windows for empty rewards', () => {
    const { daily } = parseDailyRewards([], NOW);

    expect(daily).toBeNull();
  });

  it('returns a null daily window when a single entry is measurable', () => {
    const { daily } = parseDailyRewards([entry(5 * 3600, atomic(9))], NOW);

    expect(daily).toBeNull();
  });

  it('truncates fractional timestamps to whole seconds', () => {
    const rewards = [
      { block: 1, lifetime_rewards: 100e9, timestamp: NOW - DAY - 29.70556497574 },
      { block: 2, lifetime_rewards: 110e9, timestamp: NOW - 3600.123 },
    ];

    const { daily } = parseDailyRewards(rewards, NOW + 0.9);

    expect(daily?.rewardFrom).toBe(NOW - DAY - 30);
    expect(daily?.rewardTo).toBe(NOW - 3601);
    expect(daily?.rewardSpanSeconds).toBe(DAY + 30);
    expect(daily?.rewardAmount).toBe(atomic(10));
  });

  it('keeps bigint precision for whale sized lifetime rewards', () => {
    const baselineLifetime = 2n ** 60n;
    const delta = 5000n * 256n;
    const rewards = [
      entry(30 * 3600, baselineLifetime),
      entry(2 * 3600, baselineLifetime + delta),
    ];

    const { daily } = parseDailyRewards(rewards, NOW);

    expect(daily?.rewardAmount).toBe(delta);
  });
});

describe('computeAprFraction', () => {
  const window: RewardsWindow = {
    rewardAmount: atomic(1),
    rewardFrom: NOW - DAY,
    rewardTo: NOW,
    rewardSpanSeconds: DAY,
    dailyAverageAmount: atomic(1),
  };

  it('returns the simple annualised rate as a fraction', () => {
    expect(computeAprFraction(window, atomic(1000))).toBeCloseTo(0.365, 6);
  });

  it('returns null for a zero stake', () => {
    expect(computeAprFraction(window, 0n)).toBeNull();
  });
});
