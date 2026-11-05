'use client';

import {
  type BatchCall,
  type FeeMode,
  addresses,
  computeFee,
  encodeBlsSignature,
  getContractErrorName,
  getFeeConfig,
  isFlowFeeEnabled,
  isValidChainId,
  withFee,
} from '@session/contracts';
import { ServiceNodeRewardsAbi } from '@session/contracts/abis';
import {
  type UpdateRewardsBalanceArgs,
  useClaimRewardsQuery,
  useGetRecipients,
  useUpdateRewardsBalanceQuery,
} from '@session/contracts/hooks/ServiceNodeRewards';
import { useSENTBalanceQuery } from '@session/contracts/hooks/Token';
import { useEstimateContractFee } from '@session/contracts/hooks/useEstimateContractFee';
import {
  useSendCallsBatch,
  useSendCallsCompatibility,
} from '@session/contracts/hooks/useSendCallsBatch';
import { PROGRESS_STATUS } from '@session/ui/motion/progress';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { encodeFunctionData } from 'viem';

import {
  formatAndHandleLocalizedContractErrorMessages,
  parseContractStatusToProgressStatus,
} from '@/lib/contracts';
import logger from '@/lib/logger';
import { useActiveVestingContractAddress } from '@/providers/vesting-provider';

export type ClaimRewardsMode = 'batched' | 'legacy';

export type UseClaimRewardsProps = {
  /** The default arguments for the hook. @see {@link UpdateRewardsBalanceArgs} */
  defaultArgs?: UpdateRewardsBalanceArgs;
  /** Force the legacy two-transaction flow (e.g. remote kill-switch or vesting). */
  forceLegacy?: boolean;
  /** The user's per-dialog legacy mode choice. */
  legacyMode?: boolean;
  /** The user's per-dialog fee asset choice, defaults to the configured fee mode. */
  feeMode?: FeeMode;
  /** The user-selected claim amount in atomic units, claims the full balance when null/undefined. */
  claimAmount?: bigint | null;
  /**
   * Fallback claimable amount (e.g. from the staking backend) used for the
   * service fee display before the claim signature arrives.
   */
  fallbackClaimableAmount?: bigint | null;
};

export type UseClaimRewards = {
  /** Execute the claim rewards flow in a single approval (batched) or as two transactions (legacy). */
  updateBalanceAndClaimRewards: (args: UpdateRewardsBalanceArgs) => void;
  claimFee: bigint | null;
  claimGasPrice: bigint | null;
  claimGasAmountEstimate: bigint | null;
  updateBalanceFee: bigint | null;
  updateBalanceGasPrice: bigint | null;
  updateBalanceGasAmountEstimate: bigint | null;
  updateRewardsBalanceStatus: PROGRESS_STATUS;
  claimRewardsStatus: PROGRESS_STATUS;
  enabled: boolean;
  skipUpdateBalance: boolean;
  updateRewardsBalanceErrorMessage: string | null;
  claimRewardsErrorMessage: string | null;
  /** The effective mode the flow will execute with. */
  mode: ClaimRewardsMode;
  /** The service fee that will be charged in the batched flow, in atomic SESH/ETH units. */
  feeAmount: bigint | null;
  /** The payable fee options per asset, ordered SESH then ETH. */
  feeOptions: Array<{ mode: FeeMode; fee: bigint }>;
  /** The asset the fee will be paid in after resolving the user's choice against availability. */
  effectiveFeeMode: FeeMode;
  /** The service fee split into its flat and proportional components. */
  feeBreakdown: { flat: bigint; bps: bigint } | null;
  /** Gas units consumed by the fee payment call, null when no fee applies. */
  feeTransferGasAmount: bigint | null;
  /** Wallet EIP-5792 support from `wallet_getCapabilities`: true/false once resolved, null while undetermined. */
  isBatchSupported: boolean | null;
  /** Whether the wallet reports atomic batch execution on the connected chain, null when unknown. */
  isAtomicBatchSupported: boolean | null;
  /**
   * True after a batched attempt failed as unsupported and the flow switched
   * to legacy mode without starting it — the user re-triggers the claim to
   * begin the two-transaction flow.
   */
  fellBackToLegacy: boolean;
};

/**
 * Hook to claim rewards.
 *
 * Batched mode (default): executes the claim rewards flow as a single EIP-5792
 * `wallet_sendCalls` approval, optionally appending a service fee call:
 * 1. Updates the rewards balance
 * 2. Claims the rewards
 * 3. Transfers the service fee (when configured)
 *
 * Wallet EIP-5792 support is pre-checked via `wallet_getCapabilities`; when
 * the wallet is known not to support it the flow starts in legacy mode
 * upfront. If support was overstated and the batch fails as unsupported, the
 * flow switches to legacy mode but does NOT auto-start — the user re-triggers
 * the claim to begin the two-transaction flow.
 *
 * Legacy mode: updates the rewards balance, waits for the transaction to
 * confirm, then claims the rewards as two separate transactions with no fee.
 *
 * @param props - The props for the hook. @see {@link UseClaimRewardsProps}
 * @returns The claim rewards hook. @see {@link UseClaimRewards}
 */
export default function useClaimRewards({
  defaultArgs,
  forceLegacy = false,
  legacyMode = false,
  feeMode,
  claimAmount,
  fallbackClaimableAmount,
}: UseClaimRewardsProps): UseClaimRewards {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [skipUpdateBalance, setSkipUpdateBalance] = useState<boolean>(false);
  const [fellBackToLegacy, setFellBackToLegacy] = useState<boolean>(false);

  const stageDictKey = 'modules.claim.stage' as const;
  const dict = useTranslations(stageDictKey);
  const dictGeneral = useTranslations('general');

  const vestingContractAddress = useActiveVestingContractAddress();
  const { address, chainId } = useWallet();

  const { isSupported: isBatchSupported, isAtomic: isAtomicBatchSupported } =
    useSendCallsCompatibility();

  const mode: ClaimRewardsMode =
    forceLegacy ||
    legacyMode ||
    fellBackToLegacy ||
    isBatchSupported === false ||
    vestingContractAddress
      ? 'legacy'
      : 'batched';

  const {
    updateRewardsBalance,
    fee: updateBalanceFee,
    gasPrice: updateBalanceGasPrice,
    gasAmount: updateBalanceGasAmountEstimate,
    contractCallStatus: updateBalanceContractCallStatus,
    transactionStatus: updateBalanceTransactionStatus,
    estimateFeeError: updateBalanceEstimateFeeError,
    simulateError: updateBalanceSimulateError,
    writeError: updateBalanceWriteError,
    transactionError: updateBalanceTransactionError,
  } = useUpdateRewardsBalanceQuery(defaultArgs);

  const {
    claimRewards,
    fee: claimFee,
    gasPrice: claimGasPrice,
    gasAmount: claimGasAmountEstimate,
    contractCallStatus: claimContractCallStatus,
    simulateError: claimSimulateError,
    writeError: claimWriteError,
    transactionError: claimTransactionError,
  } = useClaimRewardsQuery({
    vestingContractAddress,
    // NOTE: vesting always claims its full balance, partial claims apply to
    // the standard flow only
    amount: vestingContractAddress ? null : claimAmount,
  });

  const legacyUpdateRewardsBalanceStatus = useMemo(
    () => parseContractStatusToProgressStatus(updateBalanceContractCallStatus),
    [updateBalanceContractCallStatus]
  );

  const legacyClaimRewardsStatus = useMemo(
    () => parseContractStatusToProgressStatus(claimContractCallStatus),
    [claimContractCallStatus]
  );

  // #region - Fee

  const feeConfig = getFeeConfig();
  const feeCandidateEnabled = mode === 'batched' && !!feeConfig && isFlowFeeEnabled('claim');

  // NOTE: the BLS signature covers lifetime cumulative rewards, the
  // proportional fee must only apply to the amount being claimed now
  const { claimed } = useGetRecipients({ address: feeCandidateEnabled ? address : undefined });
  const feeCandidates = useMemo(() => {
    if (!feeCandidateEnabled || !feeConfig) return null;
    // NOTE: the fee base follows the amount actually being claimed — the full
    // unclaimed delta for claim-all, or the user-selected partial amount. The
    // precise on-chain delta is used when available, otherwise the backend's
    // claimable amount stands in so the fee can display before the claim
    // signature arrives
    const fullDelta =
      defaultArgs && claimed !== undefined
        ? defaultArgs.rewards - claimed
        : (fallbackClaimableAmount ?? null);
    if (fullDelta === null) return null;
    const base = claimAmount ?? fullDelta;
    return {
      sesh: computeFee(base > 0n ? base : 0n, 'sesh', feeConfig),
      eth: computeFee(base > 0n ? base : 0n, 'eth', feeConfig),
    };
  }, [claimAmount, claimed, defaultArgs, fallbackClaimableAmount, feeCandidateEnabled, feeConfig]);

  const { balance: sentBalance } = useSENTBalanceQuery({
    address: feeCandidates?.sesh != null ? address : undefined,
  });

  const feeOptions = useMemo<Array<{ mode: FeeMode; fee: bigint }>>(() => {
    if (!feeCandidates) return [];

    const options: Array<{ mode: FeeMode; fee: bigint }> = [];

    if (feeCandidates.sesh !== null) {
      if (sentBalance !== undefined && feeCandidates.sesh > sentBalance) {
        logger.warn('Claim service fee exceeds wallet token balance, skipping the SESH fee');
      } else {
        options.push({ mode: 'sesh', fee: feeCandidates.sesh });
      }
    }
    if (feeCandidates.eth !== null) {
      options.push({ mode: 'eth', fee: feeCandidates.eth });
    }

    return options;
  }, [feeCandidates, sentBalance]);

  const effectiveFeeMode = useMemo<FeeMode>(() => {
    const selected = feeMode ?? feeConfig?.defaultMode ?? 'eth';
    if (feeOptions.some((option) => option.mode === selected)) return selected;
    return feeOptions[0]?.mode ?? selected;
  }, [feeConfig?.defaultMode, feeMode, feeOptions]);

  const feeAmount = useMemo(
    () => feeOptions.find((option) => option.mode === effectiveFeeMode)?.fee ?? null,
    [effectiveFeeMode, feeOptions]
  );

  const feeBreakdown = useMemo(() => {
    if (feeAmount === null || !feeConfig) return null;
    const flat = effectiveFeeMode === 'eth' ? feeConfig.ethFlat : feeConfig.seshFlat;
    return { flat, bps: feeAmount - flat };
  }, [effectiveFeeMode, feeAmount, feeConfig]);

  // Gas units consumed by the fee payment call itself, so the displayed
  // network fee covers every call in the batch
  const seshFeeTransferArgs = useMemo(() => {
    if (feeAmount === null || effectiveFeeMode !== 'sesh' || !feeConfig) return null;
    return [feeConfig.address, feeAmount] as const;
  }, [effectiveFeeMode, feeAmount, feeConfig]);

  const { gasAmount: seshFeeTransferGasAmount } = useEstimateContractFee({
    contract: 'Token',
    functionName: 'transfer',
    args: seshFeeTransferArgs ?? undefined,
  });

  // NOTE: an ETH value transfer has a constant intrinsic gas cost
  const ETH_TRANSFER_GAS = 21_000n;

  const feeTransferGasAmount =
    feeAmount === null
      ? null
      : effectiveFeeMode === 'eth'
        ? ETH_TRANSFER_GAS
        : seshFeeTransferGasAmount;

  // #endregion
  // #region - Batched flow

  const {
    status: batchStatus,
    isAwaitingWallet,
    sendBatch,
    receipts: batchReceipts,
    error: batchError,
    isUnsupported,
  } = useSendCallsBatch();

  const claimArgsRef = useRef<UpdateRewardsBalanceArgs | null>(null);

  const sendBatchedClaim = (args: UpdateRewardsBalanceArgs) => {
    if (!isValidChainId(chainId)) {
      logger.error('Invalid chain id for batched claim, switch to the legacy flow');
      setFellBackToLegacy(true);
      setEnabled(false);
      claimArgsRef.current = null;
      return;
    }

    const target = addresses.ServiceNodeRewards[chainId];
    const calls: Array<BatchCall> = [];

    if (!skipUpdateBalance) {
      calls.push({
        to: target,
        data: encodeFunctionData({
          abi: ServiceNodeRewardsAbi,
          functionName: 'updateRewardsBalance',
          args: [
            args.address,
            args.rewards,
            encodeBlsSignature(args.blsSignature),
            args.excludedSigners,
          ],
        }),
      });
    }

    calls.push({
      to: target,
      data: encodeFunctionData({
        abi: ServiceNodeRewardsAbi,
        functionName: 'claimRewards',
        // NOTE: the partial-claim overload when an amount is selected, the
        // claim-all overload otherwise
        ...(claimAmount != null ? { args: [claimAmount] as [bigint] } : {}),
      }),
    });

    sendBatch(withFee(calls, feeAmount, chainId, effectiveFeeMode, feeConfig));
  };

  // #endregion

  const updateBalanceAndClaimRewards = (args: UpdateRewardsBalanceArgs) => {
    setEnabled(true);
    claimArgsRef.current = args;
    if (mode === 'batched') {
      sendBatchedClaim(args);
    } else if (!skipUpdateBalance) {
      updateRewardsBalance(args);
    }
  };

  // #region - Batched statuses

  const batchedUpdateRewardsBalanceStatus = useMemo(() => {
    if (!enabled) return PROGRESS_STATUS.IDLE;
    if (skipUpdateBalance) return PROGRESS_STATUS.SUCCESS;
    if (batchStatus === 'confirmed') {
      return batchReceipts?.[0]?.status === 'reverted'
        ? PROGRESS_STATUS.ERROR
        : PROGRESS_STATUS.SUCCESS;
    }
    if (batchStatus === 'failed') return PROGRESS_STATUS.ERROR;
    return PROGRESS_STATUS.PENDING;
  }, [batchReceipts, batchStatus, enabled, skipUpdateBalance]);

  const batchedClaimRewardsStatus = useMemo(() => {
    if (!enabled) return PROGRESS_STATUS.IDLE;
    if (isAwaitingWallet) return PROGRESS_STATUS.IDLE;
    if (batchStatus === 'confirmed') {
      const claimReceiptIndex = skipUpdateBalance ? 0 : 1;
      return batchReceipts?.[claimReceiptIndex]?.status === 'reverted'
        ? PROGRESS_STATUS.ERROR
        : PROGRESS_STATUS.SUCCESS;
    }
    if (batchStatus === 'failed') return PROGRESS_STATUS.ERROR;
    return PROGRESS_STATUS.PENDING;
  }, [batchReceipts, batchStatus, enabled, isAwaitingWallet, skipUpdateBalance]);

  const batchedErrorMessage = useMemo(() => {
    if (!batchError) return null;
    const reason =
      (batchError as { shortMessage?: string }).shortMessage ?? batchError.message ?? 'unknown';
    return dict('claim.errorTemplate', { reason });
  }, [batchError, dict]);

  // #endregion
  // #region - Error messages

  const updateRewardsBalanceErrorMessage = useMemo(
    () =>
      formatAndHandleLocalizedContractErrorMessages({
        errorGroupDictKey: 'balance',
        dict,
        dictGeneral,
        simulateError: updateBalanceSimulateError,
        writeError: updateBalanceWriteError,
        transactionError: updateBalanceTransactionError,
      }),
    [
      updateBalanceSimulateError,
      updateBalanceWriteError,
      updateBalanceTransactionError,
      dict,
      dictGeneral,
    ]
  );

  const claimRewardsErrorMessage = useMemo(
    () =>
      formatAndHandleLocalizedContractErrorMessages({
        errorGroupDictKey: 'claim',
        dict,
        dictGeneral,
        simulateError: claimSimulateError,
        writeError: claimWriteError,
        transactionError: claimTransactionError,
      }),
    [claimSimulateError, claimWriteError, claimTransactionError, dict, dictGeneral]
  );

  // #endregion

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on success
  useEffect(() => {
    if (
      mode === 'legacy' &&
      enabled &&
      (skipUpdateBalance || updateBalanceTransactionStatus === 'success')
    ) {
      claimRewards();
    }
  }, [mode, enabled, skipUpdateBalance, updateBalanceTransactionStatus]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on unsupported wallet
  useEffect(() => {
    if (mode === 'batched' && isUnsupported && claimArgsRef.current) {
      logger.debug(
        'Wallet does not support EIP-5792 batching, switching to the legacy flow without starting it'
      );
      setFellBackToLegacy(true);
      // NOTE: do not auto-start the legacy flow — the user re-triggers the
      // claim to consent to the two-transaction flow
      setEnabled(false);
      claimArgsRef.current = null;
    }
  }, [isUnsupported]);

  useEffect(() => {
    // If the gas estimation fails with the RecipientRewardsTooLow error, we can skip the update balance step
    if (
      updateBalanceEstimateFeeError &&
      getContractErrorName(updateBalanceEstimateFeeError) === 'RecipientRewardsTooLow'
    ) {
      setSkipUpdateBalance(true);
    }
  }, [updateBalanceEstimateFeeError]);

  const updateRewardsBalanceStatus =
    mode === 'batched' ? batchedUpdateRewardsBalanceStatus : legacyUpdateRewardsBalanceStatus;
  const claimRewardsStatus =
    mode === 'batched' ? batchedClaimRewardsStatus : legacyClaimRewardsStatus;

  const updateBalanceErrorDisplay =
    mode === 'batched'
      ? (batchedErrorMessage ?? updateRewardsBalanceErrorMessage)
      : updateRewardsBalanceErrorMessage;
  const claimErrorDisplay =
    mode === 'batched'
      ? (batchedErrorMessage ?? claimRewardsErrorMessage)
      : claimRewardsErrorMessage;

  return {
    updateBalanceAndClaimRewards,
    claimFee,
    claimGasPrice,
    claimGasAmountEstimate,
    updateBalanceFee,
    updateBalanceGasPrice,
    updateBalanceGasAmountEstimate,
    updateRewardsBalanceStatus,
    claimRewardsStatus,
    enabled,
    skipUpdateBalance,
    updateRewardsBalanceErrorMessage: updateBalanceErrorDisplay,
    claimRewardsErrorMessage: claimErrorDisplay,
    mode,
    feeAmount,
    feeOptions,
    effectiveFeeMode,
    feeBreakdown,
    feeTransferGasAmount,
    isBatchSupported,
    isAtomicBatchSupported,
    fellBackToLegacy,
  };
}
