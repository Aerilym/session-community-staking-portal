import { SESSION_NODE_FULL_STAKE_AMOUNT } from '@/lib/constants';
import { getTotalStaked } from '@/lib/maths';
import type { ContributionContract } from '@session/staking-api-js/schema';

/**
 * Percentage of the full stake amount contributed so far (0-100, 2 decimal places).
 */
export function getFillPercentage(contract: ContributionContract): number {
  const totalStaked = getTotalStaked(contract.contributors);
  // Integer math to avoid precision loss, 2 decimal places
  return Number((totalStaked * 10_000n) / SESSION_NODE_FULL_STAKE_AMOUNT) / 100;
}

/**
 * Difference between the contract's operator fee and the median operator fee of
 * multicontributor network nodes, in percentage points. Positive means above the median.
 *
 * @param fee The contract's operator fee in percent times 100 (10,000 = 100%).
 * @param medianOperatorFee Median operator fee in percent times 100 (from seshtoken.info).
 * @returns null if the fee or median is unavailable.
 */
export function getFeeDeltaVsMedian(
  fee: number | null,
  medianOperatorFee?: number | null
): number | null {
  if (fee === null || medianOperatorFee === null || medianOperatorFee === undefined) return null;
  return fee / 10_000 - medianOperatorFee / 10_000;
}
