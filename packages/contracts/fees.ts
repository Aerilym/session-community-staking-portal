import type { Address, Hex } from 'viem';
import { encodeFunctionData } from 'viem';
import { SENTAbi } from './abis';
import { SENT_DECIMALS, addresses, isValidChainId } from './constants';

/**
 * A single call in an EIP-5792 (wallet_sendCalls) batch.
 */
export type BatchCall = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

/**
 * The asset the service fee is paid in.
 */
export type FeeMode = 'sesh' | 'eth';

/**
 * USD prices used to convert proportional SESH fees into ETH, as rational
 * numbers to keep bigint arithmetic exact. Replace with an oracle.
 */
export const SESH_USD = { numerator: 2n, denominator: 100n } as const; // $0.02
export const ETH_USD = { numerator: 2000n, denominator: 1n } as const; // $2000

const WEI_PER_ETH = 10n ** 18n;
const ATOMIC_PER_SESH = 10n ** BigInt(SENT_DECIMALS);

/**
 * Converts an atomic SESH amount into wei at the constant USD prices.
 */
export function seshAtomicToEthWei(seshAtomic: bigint): bigint {
  return (
    (seshAtomic * WEI_PER_ETH * SESH_USD.numerator * ETH_USD.denominator) /
    (ATOMIC_PER_SESH * SESH_USD.denominator * ETH_USD.numerator)
  );
}

/**
 * Converts an atomic SESH amount into USD at the constant prices.
 */
export function seshAtomicToUsd(seshAtomic: bigint): number {
  return (
    (Number(seshAtomic) / Number(ATOMIC_PER_SESH)) *
    (Number(SESH_USD.numerator) / Number(SESH_USD.denominator))
  );
}

/**
 * Converts a wei amount into USD at the constant prices.
 */
export function ethWeiToUsd(ethWei: bigint): number {
  return (
    (Number(ethWei) / Number(WEI_PER_ETH)) *
    (Number(ETH_USD.numerator) / Number(ETH_USD.denominator))
  );
}

/**
 * Number of significant digits the computed fee is rounded down to (e.g.
 * 0.00003360512977 ETH becomes 0.0000336 ETH).
 */
export const FEE_SIGNIFICANT_DIGITS = 3;

/**
 * Truncates a positive bigint down to the given number of significant digits
 * (e.g. 33_605_129_770_000n with 3 digits becomes 33_600_000_000_000n).
 */
export function roundDownToSignificantDigits(value: bigint, digits: number): bigint {
  if (value <= 0n || digits <= 0) return value;
  const excess = value.toString().length - digits;
  if (excess <= 0) return value;
  const divisor = 10n ** BigInt(excess);
  return (value / divisor) * divisor;
}

const TRAILING_ZEROS_REGEX = /(\.\d*?)0+$/;
const TRAILING_DOT_REGEX = /\.$/;

/**
 * Formats a USD amount for display, trimming trailing zeros
 * (e.g. 10.23 -> "10.23", 0.1 -> "0.1", 10 -> "10").
 */
export function formatUsd(usd: number): string {
  if (Number.isNaN(usd)) return '0';
  if (usd > 0 && usd < 0.01) return '<0.01';
  return usd.toFixed(2).replace(TRAILING_ZEROS_REGEX, '$1').replace(TRAILING_DOT_REGEX, '');
}

export type FeeConfig = {
  /** The address that collects the fees. */
  address: Address;
  /** The asset selected by default in the UI. */
  defaultMode: FeeMode;
  /** Flat fee for SESH payments, in atomic SESH. */
  seshFlat: bigint;
  /** Flat fee for ETH payments, in wei. */
  ethFlat: bigint;
  /**
   * Proportional fee in basis points of the amount being claimed
   * (1 bp = 0.01%). For ETH payments the SESH amount is converted to ETH at
   * the constant USD prices. @see {@link SESH_USD} @see {@link ETH_USD}
   */
  bps: bigint;
};

/**
 * Flows that can have a service fee attached. Extensible as more flows adopt batching.
 */
export const FEE_FLOWS = ['claim'] as const;

export type FeeFlow = (typeof FEE_FLOWS)[number];

function parseBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Reads the fee configuration from the environment.
 *
 * - `NEXT_PUBLIC_FEE_ADDRESS`: the fee collector address (required to enable fees)
 * - `NEXT_PUBLIC_FEE_MODE`: the default asset, `'eth'` (default) or `'sesh'`
 * - `NEXT_PUBLIC_FEE_FLAT_WEI`: flat fee in atomic SESH
 * - `NEXT_PUBLIC_FEE_ETH_WEI`: flat fee in wei (enables paying the fee in ETH)
 * - `NEXT_PUBLIC_FEE_BPS`: proportional fee in basis points of the amount
 *   being claimed (converted to ETH at the constant USD prices for ETH
 *   payments)
 *
 * @returns The fee configuration, or null when fees are not configured.
 */
export function getFeeConfig(): FeeConfig | null {
  const address = process.env.NEXT_PUBLIC_FEE_ADDRESS as Address | undefined;
  if (!address) return null;

  const defaultMode: FeeMode = process.env.NEXT_PUBLIC_FEE_MODE === 'sesh' ? 'sesh' : 'eth';
  const seshFlat = parseBigInt(process.env.NEXT_PUBLIC_FEE_FLAT_WEI);
  const ethFlat = parseBigInt(process.env.NEXT_PUBLIC_FEE_ETH_WEI);
  const bps = parseBigInt(process.env.NEXT_PUBLIC_FEE_BPS);

  if (seshFlat === 0n && ethFlat === 0n && bps === 0n) return null;

  return { address, defaultMode, seshFlat, ethFlat, bps };
}

/**
 * Checks whether a flow has fees enabled.
 *
 * @param flow - The flow to check. @see {@link FEE_FLOWS}
 * @param enabledFlows - Comma separated list of enabled flows, defaults to the
 * `NEXT_PUBLIC_FEE_ENABLED_FLOWS` environment variable.
 * @returns True when the flow has fees enabled.
 */
export function isFlowFeeEnabled(
  flow: FeeFlow,
  enabledFlows: string | undefined = process.env.NEXT_PUBLIC_FEE_ENABLED_FLOWS
): boolean {
  if (!enabledFlows) return false;
  return enabledFlows
    .split(',')
    .map((enabledFlow) => enabledFlow.trim().toLowerCase())
    .includes(flow.toLowerCase());
}

/**
 * Computes the fee to charge for a flow.
 *
 * @param amount - The amount the flow is being executed for (e.g. the amount
 * being claimed), used for the proportional component.
 * @param mode - The asset the fee is paid in.
 * @param config - The fee configuration, defaults to the environment configuration.
 * @returns The fee in the fee asset's base units, or null when no fee applies.
 */
export function computeFee(
  amount: bigint,
  mode: FeeMode,
  config: FeeConfig | null = getFeeConfig()
): bigint | null {
  if (!config) return null;

  const proportional = (amount * config.bps) / 10_000n;
  const fee =
    mode === 'eth'
      ? config.ethFlat + seshAtomicToEthWei(proportional)
      : config.seshFlat + proportional;

  const rounded = roundDownToSignificantDigits(fee, FEE_SIGNIFICANT_DIGITS);
  return rounded > 0n ? rounded : null;
}
/**
 * Checks whether a fee mode can be paid, i.e. a positive fee component is
 * configured for it (flat, or proportional which converts into either asset).
 *
 * @param mode - The asset the fee is paid in.
 * @param config - The fee configuration, defaults to the environment configuration.
 * @returns True when the mode is selectable in the UI.
 */
export function isFeeModeAvailable(
  mode: FeeMode,
  config: FeeConfig | null = getFeeConfig()
): boolean {
  if (!config) return false;
  return config.bps > 0n || (mode === 'eth' ? config.ethFlat : config.seshFlat) > 0n;
}

/**
 * Builds the fee payment call for an EIP-5792 batch.
 *
 * @param fee - The fee amount in base units.
 * @param chainId - The chain the batch is executed on.
 * @param mode - The asset the fee is paid in.
 * @param config - The fee configuration, defaults to the environment configuration.
 * @returns The fee call, or null when fees are not configured.
 */
export function buildFeeCall(
  fee: bigint,
  chainId: number,
  mode: FeeMode,
  config: FeeConfig | null = getFeeConfig()
): BatchCall | null {
  if (!config) return null;

  if (mode === 'eth') {
    // NOTE: data must be omitted (not '0x'), MetaMask rejects empty hex data
    return { to: config.address, value: fee };
  }

  if (!isValidChainId(chainId)) return null;

  return {
    to: addresses.Token[chainId],
    data: encodeFunctionData({
      abi: SENTAbi,
      functionName: 'transfer',
      args: [config.address, fee],
    }),
  };
}

/**
 * Appends the fee call to a list of EIP-5792 batch calls. The fee call is
 * always placed last so that, in sequentially executed (non-atomic) batches,
 * it is submitted after the flow's own calls.
 *
 * @param calls - The flow's calls.
 * @param fee - The fee to charge, or null to skip the fee.
 * @param chainId - The chain the batch is executed on.
 * @param mode - The asset the fee is paid in.
 * @param config - The fee configuration, defaults to the environment configuration.
 * @returns The calls with the fee call appended when applicable.
 */
export function withFee(
  calls: Array<BatchCall>,
  fee: bigint | null,
  chainId: number,
  mode: FeeMode,
  config: FeeConfig | null = getFeeConfig()
): Array<BatchCall> {
  if (!config || fee === null || fee <= 0n) return calls;

  const feeCall = buildFeeCall(fee, chainId, mode, config);
  return feeCall ? [...calls, feeCall] : calls;
}
