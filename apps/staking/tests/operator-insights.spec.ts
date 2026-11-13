import type { ContributionContract } from '@session/staking-api-js/schema';
import type { BLSPublicKey, Ed25519PublicKey, EthereumAddress } from '@session/util-crypto/keys';
import { getFeeDeltaVsMedian, getFillPercentage } from '../lib/operator-insights';

const FULL_STAKE_AMOUNT = 25_000_000000000n;

const operatorAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as EthereumAddress;
const contractAddress = '0x1234567890123456789012345678901234567890' as EthereumAddress;
const ed25519PubKey = '0x' + 'a'.repeat(64) as Ed25519PublicKey;
const blsPubKey = '0x' + 'b'.repeat(128) as BLSPublicKey;

function createContract(overrides: Partial<ContributionContract> = {}): ContributionContract {
  return {
    address: contractAddress,
    contributors: [],
    events: [],
    operator_address: operatorAddress,
    service_node_pubkey: ed25519PubKey,
    status: 0,
    fee: 500,
    manual_finalize: false,
    pubkey_bls: blsPubKey,
    ...overrides,
  };
}

function createFilledContract(amount: bigint): ContributionContract {
  return createContract({
    contributors: [
      {
        address: operatorAddress,
        beneficiary_address: null,
        amount,
        reserved: 0n,
      },
    ],
  });
}

describe('getFillPercentage', () => {
  it('returns 0 for an empty contract', () => {
    expect(getFillPercentage(createContract())).toBe(0);
  });

  it('returns 100 for a fully staked contract', () => {
    expect(getFillPercentage(createFilledContract(FULL_STAKE_AMOUNT))).toBe(100);
  });

  it('returns the filled fraction with two decimal places', () => {
    expect(getFillPercentage(createFilledContract(FULL_STAKE_AMOUNT / 4n))).toBe(25);
  });
});

describe('getFeeDeltaVsMedian', () => {
  it('returns null when the fee is null', () => {
    expect(getFeeDeltaVsMedian(null, 1000)).toBeNull();
  });

  it('returns null when the median is null or undefined', () => {
    expect(getFeeDeltaVsMedian(500, null)).toBeNull();
    expect(getFeeDeltaVsMedian(500, undefined)).toBeNull();
  });

  it('returns the delta in percentage points', () => {
    // fee 500 = 5%, median 1000 = 10%
    expect(getFeeDeltaVsMedian(500, 1000)).toBeCloseTo(-0.05);
  });

  it('returns 0 when the fee equals the median', () => {
    expect(getFeeDeltaVsMedian(1000, 1000)).toBe(0);
  });
});
