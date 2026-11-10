import type { FeeConfig, BatchCall } from '../fees';
import {
  buildFeeCall,
  computeFee,
  ethWeiToUsd,
  formatUsd,
  isFeeModeAvailable,
  isFlowFeeEnabled,
  seshAtomicToEthWei,
  seshAtomicToUsd,
  withFee,
} from '../fees';
import { encodeFunctionData } from 'viem';
import { SENTAbi } from '../abis';

const ARBITRUM_CHAIN_ID = 42161;

const CONFIG: FeeConfig = {
  address: '0x0000000000000000000000000000000000000001',
  defaultMode: 'sesh',
  seshFlat: 1_000_000_000n,
  ethFlat: 1_000_000n,
  bps: 50n,
};

const SESH_ONLY: FeeConfig = { ...CONFIG, ethFlat: 0n };
const ETH_ONLY: FeeConfig = { ...CONFIG, seshFlat: 0n, bps: 0n };

// Prices at which $0.02/SESH and $2000/ETH reproduce the historic constant
// conversion rate (1 SESH = 1e13 wei)
const PRICES = { seshUsd: 0.02, ethUsd: 2000 } as const;

const CALL_A: BatchCall = { to: '0x000000000000000000000000000000000000000a', data: '0x01' };
const CALL_B: BatchCall = { to: '0x000000000000000000000000000000000000000b', data: '0x02' };

// #region - seshAtomicToEthWei

describe('seshAtomicToEthWei', () => {
  test('converts at the given prices', () => {
    // 1 SESH (1e9 atomic) at $0.02 with ETH at $2000 = $0.02 = 1e13 wei
    expect(seshAtomicToEthWei(10n ** 9n, 0.02, 2000)).toBe(10n ** 13n);
  });

  test('rounds down for sub-wei amounts', () => {
    // 1 atomic SESH = 1e4 wei; 0.05 atomic rounds to 0
    expect(seshAtomicToEthWei(1n, 0.02, 2000)).toBe(10_000n);
    expect(seshAtomicToEthWei(0n, 0.02, 2000)).toBe(0n);
  });
});

// #endregion
// #region - USD conversion

describe('USD conversion', () => {
  test('converts SESH to USD at the given price', () => {
    // 100 SESH * $0.02 = $2
    expect(seshAtomicToUsd(100n * 10n ** 9n, 0.02)).toBe(2);
  });

  test('converts ETH to USD at the given price', () => {
    // 0.01 ETH * $2000 = $20
    expect(ethWeiToUsd(10n ** 16n, 2000)).toBe(20);
  });

  test('returns null when no price is available', () => {
    expect(seshAtomicToUsd(100n * 10n ** 9n, null)).toBeNull();
    expect(ethWeiToUsd(10n ** 16n, null)).toBeNull();
  });
});

describe('formatUsd', () => {
  test('keeps two decimals', () => {
    expect(formatUsd(10.23)).toBe('10.23');
  });

  test('trims trailing zeros', () => {
    expect(formatUsd(0.1)).toBe('0.1');
    expect(formatUsd(10)).toBe('10');
  });

  test('clamps sub-cent amounts', () => {
    expect(formatUsd(0.001)).toBe('<0.01');
  });
});

// #endregion
// #region - computeFee

describe('computeFee', () => {
  test('returns null for null config', () => {
    expect(computeFee(1_000n, 'sesh', null)).toBeNull();
  });

  test('sesh mode is flat plus bps of the claim amount', () => {
    // 1 SESH flat + 0.5% of 1_000 = 1_000_000_005, rounded down to 3 significant digits
    expect(computeFee(1_000n, 'sesh', CONFIG)).toBe(1_000_000_000n);
  });

  test('eth mode is flat plus the bps converted at the given prices', () => {
    // 0.5% of 1_000 = 5 atomic SESH = 5 * 1e4 wei = 50_000 wei, plus the flat fee
    expect(computeFee(1_000n, 'eth', CONFIG, PRICES)).toBe(1_050_000n);
  });

  test('eth mode is unavailable without both prices when bps applies', () => {
    expect(computeFee(1_000n, 'eth', CONFIG, null)).toBeNull();
    expect(computeFee(1_000n, 'eth', CONFIG, { seshUsd: 0.02, ethUsd: null })).toBeNull();
    expect(computeFee(1_000n, 'eth', CONFIG, { seshUsd: null, ethUsd: 2000 })).toBeNull();
  });

  test('eth mode needs no prices when only the flat fee applies', () => {
    expect(computeFee(1_000n, 'eth', ETH_ONLY, null)).toBe(1_000_000n);
  });

  test('eth fee is rounded down to 3 significant digits', () => {
    // 1360.512977 SESH claimed, 0.00002 ETH flat + 0.1% converted = 33_605_129_770_000 wei
    // (0.00003360512977 ETH) -> 33_600_000_000_000 wei (0.0000336 ETH)
    const config: FeeConfig = {
      address: CONFIG.address,
      defaultMode: 'eth',
      seshFlat: 5_000_000_000n,
      ethFlat: 20_000_000_000_000n,
      bps: 10n,
    };
    expect(computeFee(1_360_512_977_000n, 'eth', config, PRICES)).toBe(33_600_000_000_000n);
  });

  test('sesh fee is rounded down to 3 significant digits', () => {
    // 5 SESH flat + 0.1% of 1360.512977 SESH = 6_360_512_977 atomic -> 6_360_000_000
    const config: FeeConfig = {
      address: CONFIG.address,
      defaultMode: 'sesh',
      seshFlat: 5_000_000_000n,
      ethFlat: 20_000_000_000_000n,
      bps: 10n,
    };
    expect(computeFee(1_360_512_977_000n, 'sesh', config)).toBe(6_360_000_000n);
  });

  test('bps rounds down', () => {
    const config = { ...SESH_ONLY, seshFlat: 0n };
    // 0.5% of 99 = 0.495 -> rounds to 0 -> no fee
    expect(computeFee(99n, 'sesh', config)).toBeNull();
  });

  test('returns null when the computed fee is zero', () => {
    expect(computeFee(1_000n, 'sesh', ETH_ONLY)).toBeNull();
  });
});

// #endregion
// #region - isFeeModeAvailable

describe('isFeeModeAvailable', () => {
  test('available when a positive fee is configured', () => {
    expect(isFeeModeAvailable('sesh', CONFIG)).toBe(true);
    expect(isFeeModeAvailable('eth', CONFIG, PRICES)).toBe(true);
  });

  test('eth is available via bps with both prices', () => {
    expect(isFeeModeAvailable('eth', SESH_ONLY, PRICES)).toBe(true);
  });

  test('eth via bps is unavailable without both prices', () => {
    expect(isFeeModeAvailable('eth', SESH_ONLY)).toBe(false);
    expect(isFeeModeAvailable('eth', SESH_ONLY, null)).toBe(false);
    expect(isFeeModeAvailable('eth', SESH_ONLY, { seshUsd: 0.02, ethUsd: null })).toBe(false);
  });

  test('unavailable when no positive fee is configured', () => {
    expect(isFeeModeAvailable('sesh', ETH_ONLY)).toBe(false);
    expect(isFeeModeAvailable('sesh', null)).toBe(false);
    expect(isFeeModeAvailable('eth', null)).toBe(false);
  });
});

// #endregion
// #region - buildFeeCall

describe('buildFeeCall', () => {
  test('builds an eth transfer call without data', () => {
    expect(buildFeeCall(1_000_000n, ARBITRUM_CHAIN_ID, 'eth', CONFIG)).toEqual({
      to: CONFIG.address,
      value: 1_000_000n,
    });
  });

  test('builds a sesh transfer call', () => {
    const call = buildFeeCall(1_234n, ARBITRUM_CHAIN_ID, 'sesh', CONFIG);

    expect(call).toEqual({
      to: '0x10Ea9E5303670331Bdddfa66A4cEA47dae4fcF3b',
      data: encodeFunctionData({
        abi: SENTAbi,
        functionName: 'transfer',
        args: [CONFIG.address, 1_234n],
      }),
    });
  });

  test('returns null for null config', () => {
    expect(buildFeeCall(1n, ARBITRUM_CHAIN_ID, 'sesh', null)).toBeNull();
  });
});

// #endregion
// #region - withFee

describe('withFee', () => {
  test('appends the fee call last', () => {
    const calls = withFee([CALL_A, CALL_B], 1_234n, ARBITRUM_CHAIN_ID, 'sesh', CONFIG);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toBe(CALL_A);
    expect(calls[1]).toBe(CALL_B);
    expect(calls[2]).toEqual(buildFeeCall(1_234n, ARBITRUM_CHAIN_ID, 'sesh', CONFIG));
  });

  test('returns the calls unchanged for null or zero fee', () => {
    expect(withFee([CALL_A], null, ARBITRUM_CHAIN_ID, 'sesh', CONFIG)).toEqual([CALL_A]);
    expect(withFee([CALL_A], 0n, ARBITRUM_CHAIN_ID, 'sesh', CONFIG)).toEqual([CALL_A]);
  });

  test('returns the calls unchanged for null config', () => {
    expect(withFee([CALL_A], 1n, ARBITRUM_CHAIN_ID, 'sesh', null)).toEqual([CALL_A]);
  });
});

// #endregion
// #region - isFlowFeeEnabled

describe('isFlowFeeEnabled', () => {
  test('matches a listed flow', () => {
    expect(isFlowFeeEnabled('claim', 'claim')).toBe(true);
    expect(isFlowFeeEnabled('claim', 'claim,exit')).toBe(true);
  });

  test('is case insensitive and trims whitespace', () => {
    expect(isFlowFeeEnabled('claim', ' Claim , Exit ')).toBe(true);
  });

  test('does not match an unlisted flow', () => {
    expect(isFlowFeeEnabled('claim', 'exit')).toBe(false);
    expect(isFlowFeeEnabled('claim', undefined)).toBe(false);
  });
});

// #endregion
