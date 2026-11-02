import type { ClaimDict } from '@/app/mystakes/modules/ClaimTokensModule';
import { ActionModuleAccordionRow, ActionModuleRow } from '@/components/ActionModule';
import { ActionModuleFeeAccordionRow } from '@/components/ActionModuleFeeAccordionRow';
import { FiatUsd } from '@/components/FiatUsd';
import { WalletInteractionButtonWithLocales } from '@/components/WalletInteractionButtonWithLocales';
import { WizardSectionDescription } from '@/components/Wizard';
import useClaimRewards from '@/hooks/useClaimRewards';
import { useNetworkBalances } from '@/hooks/useNetworkBalances';
import { useNetworkFeeFormula } from '@/hooks/useNetworkFeeFormula';
import {
  DYNAMIC_MODULE,
  HANDRAIL_THRESHOLDS,
  PREFERENCE,
  SIGNIFICANT_FIGURES,
  URL,
} from '@/lib/constants';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import { useActiveVestingContractAddress } from '@/providers/vesting-provider';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { type FeeMode, ethWeiToUsd, getFeeConfig, seshAtomicToUsd } from '@session/contracts';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import type { BlsRewardsSignatureResponse } from '@session/staking-api-js/schema';
import { FuelIcon } from '@session/ui/icons/FuelIcon';
import { SparklesIcon } from '@session/ui/icons/SparklesIcon';
import { toast } from '@session/ui/lib/toast';
import { PROGRESS_STATUS, Progress } from '@session/ui/motion/progress';
import { AlertDialogFooter } from '@session/ui/ui/alert-dialog';
import { Button } from '@session/ui/ui/button';
import { Checkbox } from '@session/ui/ui/checkbox';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePreferences } from 'usepref';
import { formatUnits } from 'viem';
import type { Address } from 'viem';

export function ClaimTokens({
  address,
  claimData,
  dictionary,
  refetchBalance,
}: {
  address: Address;
  claimData: BlsRewardsSignatureResponse;
  dictionary: ClaimDict;
  refetchBalance?: () => void;
}) {
  const dictionaryFee = useTranslations('fee');
  const [overrideFormattedUnclaimed, setOverrideFormattedUnclaimed] = useState<string | null>(null);
  const [legacyMode, setLegacyMode] = useState<boolean>(false);
  const { refetch, unclaimed } = useNetworkBalances({ addressOverride: address });

  const vestingContractAddress = useActiveVestingContractAddress();

  const { enabled: isBatchedClaimDisabled } = useRemoteFeatureFlagQuery(
    REMOTE_FEATURE_FLAG.DISABLE_BATCHED_CLAIM
  );

  const batchedAvailable = !isBatchedClaimDisabled && !vestingContractAddress;

  const feeConfig = getFeeConfig();
  const { getItem, setItem } = usePreferences();
  // NOTE: tri-state, null means the user never chose and the site default applies
  const [payInSesh, setPayInSesh] = useState<boolean | null>(() =>
    getItem<boolean>(PREFERENCE.CLAIM_FEE_PAY_IN_SESH)
  );
  const feeMode: FeeMode | null = payInSesh === null ? null : payInSesh ? 'sesh' : 'eth';
  const togglePayInSesh = (checked: boolean) => {
    setPayInSesh(checked);
    setItem(PREFERENCE.CLAIM_FEE_PAY_IN_SESH, checked);
  };

  const formattedUnclaimed = formatSENTBigInt(unclaimed, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS);
  const unclaimedRewardsAmount = overrideFormattedUnclaimed ?? formattedUnclaimed;

  const claimRewardsArgs = useMemo(
    () => ({
      address,
      rewards: claimData.rewards.amount,
      blsSignature: claimData.rewards.signature,
      excludedSigners: claimData.rewards.non_signer_indices,
    }),
    [address, claimData]
  );

  const {
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
    updateRewardsBalanceErrorMessage,
    claimRewardsErrorMessage,
    mode,
    feeAmount,
    feeOptions,
    effectiveFeeMode,
    feeBreakdown,
    feeTransferGasAmount,
  } = useClaimRewards({
    defaultArgs: claimRewardsArgs,
    forceLegacy: isBatchedClaimDisabled,
    legacyMode,
    feeMode: feeMode ?? undefined,
  });

  const { feeFormatted: feeEstimateClaim, formula: feeFormulaClaim } = useNetworkFeeFormula({
    fee: claimFee,
    gasAmount: claimGasAmountEstimate,
    gasPrice: claimGasPrice,
    maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_BREAKDOWN,
  });

  const { feeFormatted: feeEstimateUpdate, formula: feeFormulaUpdate } = useNetworkFeeFormula({
    fee: updateBalanceFee,
    gasAmount: updateBalanceGasAmountEstimate,
    gasPrice: updateBalanceGasPrice,
    maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_BREAKDOWN,
  });

  const gasPrice = updateBalanceGasPrice ?? claimGasPrice;

  const { fee: totalFeeRaw, feeFormatted: feeEstimate } = useClaimTotalFeeEstimate({
    updateBalanceFee,
    claimFee,
    updateBalanceGasAmountEstimate,
    claimGasAmountEstimate,
    updateBalanceGasPrice,
    claimGasPrice,
    feeTransferGasAmount,
  });

  const {
    fee: feeTransferFeeRaw,
    feeFormatted: feeEstimateTransfer,
    formula: feeFormulaTransfer,
  } = useClaimFeeTransferEstimate(feeTransferGasAmount, gasPrice);

  const handleClick = () => {
    setOverrideFormattedUnclaimed(formattedUnclaimed);
    updateBalanceAndClaimRewards(claimRewardsArgs);
  };

  const toggleLegacyMode = () => setLegacyMode((previous) => !previous);

  const isButtonDisabled = computeClaimButtonDisabled(
    skipUpdateBalance,
    updateRewardsBalanceStatus,
    claimRewardsStatus
  );

  useClaimResultToast({
    claimRewardsStatus,
    successToastMessage: dictionary('dialog.successToast', {
      tokenAmount: unclaimedRewardsAmount,
    }),
    errorMessage: claimRewardsErrorMessage,
    refetch,
    refetchBalance,
    onError: () => setOverrideFormattedUnclaimed(null),
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <ActionModuleRow
          label={dictionary('dialog.amountClaimable')}
          tooltip={dictionary('dialog.amountClaimableTooltip')}
        >
          <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
            {unclaimedRewardsAmount}
            <FiatUsd usd={unclaimed === null ? null : seshAtomicToUsd(unclaimed)} />
          </span>
        </ActionModuleRow>
        <ClaimNetworkFeeAccordion
          dictionary={dictionary}
          dictionaryFee={dictionaryFee}
          skipUpdateBalance={skipUpdateBalance}
          feeEstimate={feeEstimate}
          totalFeeRaw={totalFeeRaw}
          feeEstimateUpdate={feeEstimateUpdate}
          updateBalanceFeeRaw={updateBalanceFee}
          feeFormulaUpdate={feeFormulaUpdate}
          feeEstimateClaim={feeEstimateClaim}
          claimFeeRaw={claimFee}
          feeFormulaClaim={feeFormulaClaim}
          feeEstimateTransfer={feeTransferGasAmount !== null ? feeEstimateTransfer : null}
          feeTransferFeeRaw={feeTransferFeeRaw}
          feeFormulaTransfer={feeTransferGasAmount !== null ? feeFormulaTransfer : null}
          gasPrice={gasPrice}
        />
        {feeAmount !== null && feeBreakdown !== null ? (
          <ClaimServiceFeeRow
            dictionary={dictionary}
            feeAmount={feeAmount}
            feeBreakdown={feeBreakdown}
            unclaimed={unclaimed}
            bps={feeConfig?.bps ?? 0n}
            feeOptions={feeOptions}
            effectiveFeeMode={effectiveFeeMode}
            locked={enabled}
            onToggleSesh={togglePayInSesh}
          />
        ) : null}
      </div>
      <AlertDialogFooter className="mt-4 flex flex-col gap-6 sm:flex-col">
        <WalletInteractionButtonWithLocales
          variant="outline"
          rounded="md"
          size="lg"
          aria-label={dictionary('dialog.buttons.submitAria', {
            tokenAmount: unclaimedRewardsAmount,
            gasAmount: feeEstimate ?? 0,
          })}
          className="w-full"
          data-testid={ButtonDataTestId.Claim_Tokens_Submit}
          disabled={isButtonDisabled}
          onClick={handleClick}
        >
          {dictionary('dialog.buttons.submit')}
        </WalletInteractionButtonWithLocales>
        {batchedAvailable && !enabled ? (
          <ClaimModeToggle dictionary={dictionary} mode={mode} onToggle={toggleLegacyMode} />
        ) : null}
        {enabled ? (
          <ClaimProgress
            mode={mode}
            dictionary={dictionary}
            tokenAmount={unclaimedRewardsAmount}
            skipUpdateBalance={skipUpdateBalance}
            updateRewardsBalanceStatus={updateRewardsBalanceStatus}
            claimRewardsStatus={claimRewardsStatus}
            updateRewardsBalanceErrorMessage={updateRewardsBalanceErrorMessage}
            claimRewardsErrorMessage={claimRewardsErrorMessage}
          />
        ) : null}
      </AlertDialogFooter>
    </>
  );
}

function computeClaimButtonDisabled(
  skipUpdateBalance: boolean,
  updateRewardsBalanceStatus: PROGRESS_STATUS,
  claimRewardsStatus: PROGRESS_STATUS
) {
  const status = skipUpdateBalance ? claimRewardsStatus : updateRewardsBalanceStatus;
  return status === PROGRESS_STATUS.SUCCESS || status === PROGRESS_STATUS.PENDING;
}

function ClaimProgress({
  mode,
  dictionary,
  tokenAmount,
  skipUpdateBalance,
  updateRewardsBalanceStatus,
  claimRewardsStatus,
  updateRewardsBalanceErrorMessage,
  claimRewardsErrorMessage,
}: {
  mode: 'batched' | 'legacy';
  dictionary: ClaimDict;
  tokenAmount: string;
  skipUpdateBalance: boolean;
  updateRewardsBalanceStatus: PROGRESS_STATUS;
  claimRewardsStatus: PROGRESS_STATUS;
  updateRewardsBalanceErrorMessage: string | null;
  claimRewardsErrorMessage: string | null;
}) {
  if (mode === 'batched') {
    return (
      <Progress
        steps={[
          {
            text: {
              [PROGRESS_STATUS.IDLE]: dictionary('stage.batch.idle'),
              [PROGRESS_STATUS.PENDING]: dictionary('stage.batch.pending', { tokenAmount }),
              [PROGRESS_STATUS.SUCCESS]: dictionary('stage.batch.success', { tokenAmount }),
              [PROGRESS_STATUS.ERROR]: claimRewardsErrorMessage ?? '',
            },
            status: claimRewardsStatus,
          },
        ]}
      />
    );
  }

  return (
    <Progress
      steps={[
        {
          text: {
            [PROGRESS_STATUS.IDLE]: dictionary('stage.balance.idle'),
            [PROGRESS_STATUS.PENDING]: dictionary('stage.balance.pending'),
            [PROGRESS_STATUS.SUCCESS]: dictionary('stage.balance.success'),
            [PROGRESS_STATUS.ERROR]: updateRewardsBalanceErrorMessage ?? '',
          },
          status: skipUpdateBalance ? PROGRESS_STATUS.SUCCESS : updateRewardsBalanceStatus,
        },
        {
          text: {
            [PROGRESS_STATUS.IDLE]: dictionary('stage.claim.idle', { tokenAmount }),
            [PROGRESS_STATUS.PENDING]: dictionary('stage.claim.pending', { tokenAmount }),
            [PROGRESS_STATUS.SUCCESS]: dictionary('stage.claim.success', { tokenAmount }),
            [PROGRESS_STATUS.ERROR]: claimRewardsErrorMessage ?? '',
          },
          status: claimRewardsStatus,
        },
      ]}
    />
  );
}

function useClaimFeeTransferEstimate(feeTransferGasAmount: bigint | null, gasPrice: bigint | null) {
  const fee =
    feeTransferGasAmount !== null && gasPrice !== null ? feeTransferGasAmount * gasPrice : null;

  return {
    fee,
    ...useNetworkFeeFormula({
      fee,
      gasAmount: feeTransferGasAmount,
      gasPrice,
      maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_BREAKDOWN,
    }),
  };
}

function useClaimTotalFeeEstimate({
  updateBalanceFee,
  claimFee,
  updateBalanceGasAmountEstimate,
  claimGasAmountEstimate,
  updateBalanceGasPrice,
  claimGasPrice,
  feeTransferGasAmount,
}: {
  updateBalanceFee: bigint | null;
  claimFee: bigint | null;
  updateBalanceGasAmountEstimate: bigint | null;
  claimGasAmountEstimate: bigint | null;
  updateBalanceGasPrice: bigint | null;
  claimGasPrice: bigint | null;
  feeTransferGasAmount: bigint | null;
}) {
  const gasPrice = updateBalanceGasPrice ?? claimGasPrice ?? null;
  const feeTransferFee =
    feeTransferGasAmount !== null && gasPrice !== null ? feeTransferGasAmount * gasPrice : null;
  const hasAnyFee = updateBalanceFee || claimFee || feeTransferFee;
  const hasAnyGas =
    updateBalanceGasAmountEstimate || claimGasAmountEstimate || feeTransferGasAmount;
  const fee = hasAnyFee
    ? (updateBalanceFee ?? 0n) + (claimFee ?? 0n) + (feeTransferFee ?? 0n)
    : null;
  return {
    fee,
    ...useNetworkFeeFormula({
      fee,
      gasAmount: hasAnyGas
        ? (updateBalanceGasAmountEstimate ?? 0n) +
          (claimGasAmountEstimate ?? 0n) +
          (feeTransferGasAmount ?? 0n)
        : null,
      gasPrice,
      maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_TOTAL,
    }),
  };
}

function useClaimResultToast({
  claimRewardsStatus,
  successToastMessage,
  errorMessage,
  refetch,
  refetchBalance,
  onError,
}: {
  claimRewardsStatus: PROGRESS_STATUS;
  successToastMessage: string;
  errorMessage: string | null;
  refetch: () => Promise<unknown>;
  refetchBalance?: () => void;
  onError: () => void;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on status changes
  useEffect(() => {
    if (claimRewardsStatus === PROGRESS_STATUS.SUCCESS) {
      toast.success(successToastMessage);
      void refetch();
      void refetchBalance?.();
    } else if (claimRewardsStatus === PROGRESS_STATUS.ERROR) {
      toast.error(errorMessage ?? '');
      onError();
    }
  }, [claimRewardsStatus]);
}

function formatClaimFee(fee: bigint | null, mode: FeeMode) {
  if (fee === null) return null;
  return mode === 'eth'
    ? `${formatUnits(fee, 18)} ETH`
    : formatSENTBigInt(fee, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS);
}

function feeToUsd(fee: bigint | null, mode: FeeMode): number | null {
  if (fee === null) return null;
  return mode === 'eth' ? ethWeiToUsd(fee) : seshAtomicToUsd(fee);
}

function EthAmountWithUsd({ formatted, wei }: { formatted: string | null; wei: bigint | null }) {
  if (formatted === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {formatted}
      <FiatUsd usd={wei === null ? null : ethWeiToUsd(wei)} />
    </span>
  );
}

function FeeAmount({ fee, mode }: { fee: bigint | null; mode: FeeMode }) {
  const formatted = formatClaimFee(fee, mode);
  if (formatted === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {formatted}
      <FiatUsd usd={feeToUsd(fee, mode)} />
    </span>
  );
}

function ClaimNetworkFeeAccordion({
  dictionary,
  dictionaryFee,
  skipUpdateBalance,
  feeEstimate,
  totalFeeRaw,
  feeEstimateUpdate,
  updateBalanceFeeRaw,
  feeFormulaUpdate,
  feeEstimateClaim,
  claimFeeRaw,
  feeFormulaClaim,
  feeEstimateTransfer,
  feeTransferFeeRaw,
  feeFormulaTransfer,
  gasPrice,
}: {
  dictionary: ClaimDict;
  dictionaryFee: ReturnType<typeof useTranslations<'fee'>>;
  skipUpdateBalance: boolean;
  feeEstimate: string | null;
  totalFeeRaw: bigint | null;
  feeEstimateUpdate: string | null;
  updateBalanceFeeRaw: bigint | null;
  feeFormulaUpdate: ReactNode | null;
  feeEstimateClaim: string | null;
  claimFeeRaw: bigint | null;
  feeFormulaClaim: ReactNode | null;
  feeEstimateTransfer: string | null;
  feeTransferFeeRaw: bigint | null;
  feeFormulaTransfer: ReactNode | null;
  gasPrice: bigint | null | undefined;
}) {
  const gasHighShowTooltip = !!(gasPrice && gasPrice > HANDRAIL_THRESHOLDS.GAS_PRICE);

  return (
    <ActionModuleFeeAccordionRow
      label={
        <>
          <FuelIcon className="h-3.5 w-3.5" />
          {dictionaryFee('networkFee')}
        </>
      }
      hideGasIcon={true}
      tooltip={
        <WizardSectionDescription
          className="text-base md:text-base"
          description={dictionaryFee.rich('networkFeeTooltip', {
            linkOut: '',
          })}
          href={URL.GAS_INFO}
        />
      }
      fees={[
        {
          label: dictionary('dialog.updateBalanceCost'),
          fee: <EthAmountWithUsd formatted={feeEstimateUpdate} wei={updateBalanceFeeRaw} />,
          tooltip: feeFormulaUpdate,
          hasExemption: skipUpdateBalance,
          exemptionReason: dictionary('dialog.updateBalanceCostExemptionReason'),
        },
        {
          label: dictionary('dialog.claimRewardsCost'),
          fee: <EthAmountWithUsd formatted={feeEstimateClaim} wei={claimFeeRaw} />,
          tooltip: feeFormulaClaim,
        },
        ...(feeEstimateTransfer !== null || feeFormulaTransfer !== null
          ? [
              {
                label: dictionary('dialog.serviceFeeTransferCost'),
                fee: <EthAmountWithUsd formatted={feeEstimateTransfer} wei={feeTransferFeeRaw} />,
                tooltip: feeFormulaTransfer,
              },
            ]
          : []),
      ]}
      hasMissingEstimatesTooltipContent={dictionaryFee('missingFees')}
      gasHighTooltip={
        <WizardSectionDescription
          className="text-base md:text-base"
          description={dictionaryFee.rich('gasHigh', {
            linkOut: '',
          })}
          href={URL.GAS_INFO}
        />
      }
      gasHighShowTooltip={gasHighShowTooltip}
      totalFee={<EthAmountWithUsd formatted={feeEstimate} wei={totalFeeRaw} />}
    />
  );
}

function ClaimServiceFeeRow({
  dictionary,
  feeAmount,
  feeBreakdown,
  unclaimed,
  bps,
  feeOptions,
  effectiveFeeMode,
  locked,
  onToggleSesh,
}: {
  dictionary: ClaimDict;
  feeAmount: bigint | null;
  feeBreakdown: { flat: bigint; bps: bigint } | null;
  unclaimed: bigint | null;
  bps: bigint;
  feeOptions: Array<{ mode: FeeMode; fee: bigint }>;
  effectiveFeeMode: FeeMode;
  locked: boolean;
  onToggleSesh: (payInSesh: boolean) => void;
}) {
  const percent = `${Number(bps) / 100}`;
  const seshAvailable = feeOptions.some((option) => option.mode === 'sesh');

  return (
    <>
      <ActionModuleAccordionRow
        label={
          <>
            <SparklesIcon className="h-3.5 w-3.5" />
            {dictionary('dialog.serviceFee')}
          </>
        }
        tooltip={dictionary('dialog.serviceFeeTooltip')}
        accordionContent={
          <div className="flex flex-col gap-1">
            <span className="flex justify-between">
              <span>{dictionary('dialog.serviceFeeFlat')}</span>
              <FeeAmount fee={feeBreakdown?.flat ?? null} mode={effectiveFeeMode} />
            </span>
            <span className="flex justify-between">
              <span>{dictionary('dialog.serviceFeeBps', { percent })}</span>
              <FeeAmount fee={feeBreakdown?.bps ?? null} mode={effectiveFeeMode} />
            </span>
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
          <FeeAmount fee={feeAmount} mode={effectiveFeeMode} />
        </span>
      </ActionModuleAccordionRow>
      {seshAvailable ? (
        <span className="inline-flex items-center gap-2 align-middle">
          <Checkbox
            id="claim-fee-pay-in-sesh"
            checked={effectiveFeeMode === 'sesh'}
            disabled={locked}
            data-testid={`${ButtonDataTestId.Claim_Tokens_Fee_Mode_Toggle}-sesh`}
            onCheckedChange={(checked) => onToggleSesh(checked === true)}
          />
          <label htmlFor="claim-fee-pay-in-sesh" className="text-nowrap">
            {dictionary('dialog.serviceFeePayInSesh')}
          </label>
        </span>
      ) : null}
      {feeAmount !== null && unclaimed !== null ? (
        <span className="inline-flex items-center gap-2 text-nowrap align-middle">
          {dictionary('dialog.netAfterFee')}:
          <FeeAmount
            fee={
              effectiveFeeMode === 'sesh' && unclaimed > feeAmount
                ? unclaimed - feeAmount
                : unclaimed
            }
            mode="sesh"
          />
        </span>
      ) : null}
    </>
  );
}

function ClaimModeToggle({
  dictionary,
  mode,
  onToggle,
}: {
  dictionary: ClaimDict;
  mode: 'batched' | 'legacy';
  onToggle: () => void;
}) {
  return (
    <Button
      variant="link"
      size="sm"
      className="w-full text-xs"
      data-testid={ButtonDataTestId.Claim_Tokens_Legacy_Toggle}
      onClick={onToggle}
    >
      {mode === 'batched' ? dictionary('dialog.legacyToggle') : dictionary('dialog.batchedToggle')}
    </Button>
  );
}
