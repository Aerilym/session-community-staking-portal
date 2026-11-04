import { SENT_DECIMALS } from '@session/contracts';
import type { DailyRewardInfo } from '@session/staking-api-js/schema';
import { bigIntToNumber, numberToBigInt } from '@session/util-crypto/maths';

export const SECONDS_PER_DAY = 24 * 60 * 60;

export type RewardsWindow = {
  rewardAmount: bigint;
  rewardFrom: number;
  rewardTo: number;
  rewardSpanSeconds: number;
  dailyAverageAmount: bigint;
};

export type DailyRewardsParseResult = {
  daily: RewardsWindow | null;
};

const parseWindow = (
  rewards: Array<DailyRewardInfo>,
  nowSeconds: number,
  windowSeconds: number
): RewardsWindow | null => {
  const now = Math.trunc(nowSeconds);
  const cutoff = now - windowSeconds;
  const firstInRangeIndex = rewards.findIndex(({ timestamp }) => timestamp >= cutoff);
  const end = rewards[rewards.length - 1] ?? null;
  if (firstInRangeIndex === -1 || !end) {
    return null;
  }

  const baseline = rewards[firstInRangeIndex - 1] ?? rewards[firstInRangeIndex];
  if (!baseline || baseline === end) {
    return null;
  }

  const rewardAmount =
    numberToBigInt(Math.round(end.lifetime_rewards)) -
    numberToBigInt(Math.round(baseline.lifetime_rewards));
  const rewardFrom = Math.trunc(baseline.timestamp);
  const rewardSpanSeconds = now - rewardFrom;

  if (rewardSpanSeconds <= 0 || end.timestamp < rewardFrom) {
    return null;
  }

  return {
    rewardAmount,
    rewardFrom,
    rewardTo: Math.trunc(end.timestamp),
    rewardSpanSeconds,
    dailyAverageAmount: (rewardAmount * BigInt(SECONDS_PER_DAY)) / BigInt(rewardSpanSeconds),
  };
};

/**
 * Parses the reward event history of an address into a trailing 24h window.
 * The delta is measured from the last reward event at or before the window
 * start. If the history does not reach back that far (the backend only returns
 * a limited window of events), the delta is measured from the first event
 * inside the window instead, excluding that event's own reward, and the span
 * shrinks to the observed history.
 * @param rewards Reward events, sorted ascending by timestamp.
 * @param nowSeconds Current unix time in seconds.
 */
export const parseDailyRewards = (
  rewards: Array<DailyRewardInfo>,
  nowSeconds: number
): DailyRewardsParseResult => ({
  daily: parseWindow(rewards, nowSeconds, SECONDS_PER_DAY),
});

/**
 * Simple (non-compounding) annualised rate of a rewards window over a stake, as
 * a fraction (eg. 0.16 for 16%).
 */
export const computeAprFraction = (window: RewardsWindow, stake: bigint): number | null => {
  if (stake <= 0n) {
    return null;
  }
  return (
    bigIntToNumber(window.dailyAverageAmount * 365n, SENT_DECIMALS) /
    bigIntToNumber(stake, SENT_DECIMALS)
  );
};
