import type { ClaimDict } from '@/app/mystakes/modules/ClaimTokensModule';
import { useEthPrice, useSeshPrice } from '@/app/mystakes/modules/PriceModule';
import { ClaimAmountField } from '@/app/mystakes/modules/claim/ClaimAmountField';
import { ActionModuleAccordionRow } from '@/components/ActionModule';
import { ActionModuleFeeAccordionRow } from '@/components/ActionModuleFeeAccordionRow';
import { FiatUsd } from '@/components/FiatUsd';
import { WalletInteractionButtonWithLocales } from '@/components/WalletInteractionButtonWithLocales';
import { WizardSectionDescription } from '@/components/Wizard';
import useClaimRewards from '@/hooks/useClaimRewards';
import { useNetworkBalances } from '@/hooks/useNetworkBalances';
import { useNetworkFeeFormula } from '@/hooks/useNetworkFeeFormula';
import {
  DYNAMIC_MODULE,
  HANDRAIL_THRESHOLD,
  HANDRAIL_THRESHOLDS,
  PREFERENCE,
  SIGNIFICANT_FIGURES,
  URL,
} from '@/lib/constants';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import { useDecimalDelimiter } from '@/lib/locale-client';
import { useActiveVestingContractAddress } from '@/providers/vesting-provider';
import { ButtonDataTestId, InputDataTestId } from '@/testing/data-test-ids';
import {
  type FeeMode,
  SENT_DECIMALS,
  ethWeiToUsd,
  getFeeConfig,
  seshAtomicToUsd,
} from '@session/contracts';
import { useGetRecipients } from '@session/contracts/hooks/ServiceNodeRewards';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import type { BlsRewardsSignatureResponse } from '@session/staking-api-js/schema';
import { LoadingText } from '@session/ui/components/loading-text';
import { FuelIcon } from '@session/ui/icons/FuelIcon';
import { HandCoinsIcon } from '@session/ui/icons/HandCoinsIcon';
import { SparklesIcon } from '@session/ui/icons/SparklesIcon';
import { TriangleAlertIcon } from '@session/ui/icons/TriangleAlertIcon';
import { toast } from '@session/ui/lib/toast';
import { PROGRESS_STATUS, Progress } from '@session/ui/motion/progress';
import { AlertDialogFooter } from '@session/ui/ui/alert-dialog';
import { Button } from '@session/ui/ui/button';
import { Checkbox } from '@session/ui/ui/checkbox';
import { stringToBigInt } from '@session/util-crypto/maths';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePreferences } from 'usepref';
import { formatUnits } from 'viem';
import type { Address } from 'viem';

type ClaimTab = 'single-click' | 'coming-soon' | 'legacy';

function resolveFeeMode(payInSesh: boolean | null): FeeMode | null {
  if (payInSesh === null) return null;
  return payInSesh ? 'sesh' : 'eth';
}

function nullableIf<T>(condition: boolean, value: T): T | null {
  return condition ? value : null;
}

export function ClaimTokens({
  address,
  claimData,
  dictionary,
  refetchBalance,
  advancedMode,
}: {
  address: Address;
  /** The BLS rewards signature data, undefined while it is fetched in the background. */
  claimData?: BlsRewardsSignatureResponse | null;
  dictionary: ClaimDict;
  refetchBalance?: () => void;
  /** Shows the custom claim amount input and the claimable-without-update figure. */
  advancedMode?: boolean;
}) {
  const dictionaryFee = useTranslations('fee');
  const [overrideFormattedUnclaimed, setOverrideFormattedUnclaimed] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClaimTab>('single-click');
  const { refetch, unclaimed, claimableRewards, claimableStakes } = useNetworkBalances({
    addressOverride: address,
  });

  const price = useSeshPrice();
  const ethPrice = useEthPrice();

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
  const feeMode = resolveFeeMode(payInSesh);
  const togglePayInSesh = (checked: boolean) => {
    setPayInSesh(checked);
    setItem(PREFERENCE.CLAIM_FEE_PAY_IN_SESH, checked);
  };

  const formattedUnclaimed = formatSENTBigInt(unclaimed, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS);
  const unclaimedRewardsAmount = overrideFormattedUnclaimed ?? formattedUnclaimed;

  const decimalDelimiter = useDecimalDelimiter();
  // NOTE: null means untouched — the input defaults to the full claimable amount
  const [claimAmountInput, setClaimAmountInput] = useState<string | null>(null);

  const { claimAmount, isClaimAmountInvalid } = useMemo(() => {
    if (unclaimed === null || claimAmountInput === null) {
      return { claimAmount: null, isClaimAmountInvalid: false };
    }
    if (claimAmountInput === '') {
      return { claimAmount: null, isClaimAmountInvalid: true };
    }
    try {
      const parsed = stringToBigInt(claimAmountInput, SENT_DECIMALS, decimalDelimiter);
      if (parsed <= 0n || parsed > unclaimed) {
        return { claimAmount: null, isClaimAmountInvalid: true };
      }
      // NOTE: the full amount is expressed as claim-all (no-arg overload)
      return { claimAmount: parsed === unclaimed ? null : parsed, isClaimAmountInvalid: false };
    } catch {
      return { claimAmount: null, isClaimAmountInvalid: true };
    }
  }, [claimAmountInput, decimalDelimiter, unclaimed]);

  const claimRewardsArgs = useMemo(
    () =>
      claimData
        ? {
            address,
            rewards: claimData.rewards.amount,
            blsSignature: claimData.rewards.signature,
            excludedSigners: claimData.rewards.non_signer_indices,
          }
        : undefined,
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
    isBatchSupported,
    fellBackToLegacy,
  } = useClaimRewards({
    defaultArgs: claimRewardsArgs,
    forceLegacy: isBatchedClaimDisabled,
    legacyMode: activeTab === 'legacy',
    feeMode: feeMode ?? undefined,
    claimAmount,
    fallbackClaimableAmount: unclaimed,
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

  // NOTE: guide the user to the legacy tab when the wallet is known
  // unsupported or a batched attempt failed as unsupported — the notices
  // above the flow explain why
  useEffect(() => {
    if ((batchedAvailable && isBatchSupported === false) || fellBackToLegacy) {
      setActiveTab('legacy');
    }
  }, [batchedAvailable, isBatchSupported, fellBackToLegacy]);

  const handleClick = () => {
    if (!claimRewardsArgs) return;
    setOverrideFormattedUnclaimed(
      formatSENTBigInt(claimAmount ?? unclaimed, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)
    );
    updateBalanceAndClaimRewards(claimRewardsArgs);
  };

  const isSignaturePending = !claimRewardsArgs;

  const isButtonDisabled =
    isClaimAmountInvalid ||
    isSignaturePending ||
    computeClaimButtonDisabled(skipUpdateBalance, updateRewardsBalanceStatus, claimRewardsStatus);

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
        <ClaimAmountAccordion
          dictionary={dictionary}
          unclaimed={unclaimed}
          amountFormatted={unclaimedRewardsAmount}
          claimableRewards={claimableRewards}
          claimableStakes={claimableStakes}
          price={price}
        />
        <ClaimAdvancedControls
          visible={advancedMode === true && activeTab !== 'coming-soon'}
          address={address}
          maxClaim={unclaimed}
          value={claimAmountInput}
          onChange={setClaimAmountInput}
          disabled={enabled}
          dictionary={dictionary}
        />
        {batchedAvailable ? (
          <ClaimModeTabs
            activeTab={activeTab}
            disabled={enabled}
            onTabChange={setActiveTab}
            dictionary={dictionary}
            isBatchSupported={isBatchSupported}
          />
        ) : null}
        <ClaimModeNotices
          dictionary={dictionary}
          batchedAvailable={batchedAvailable}
          isBatchSupported={isBatchSupported}
          fellBackToLegacy={fellBackToLegacy}
        />
        {activeTab === 'coming-soon' ? (
          <ClaimComingSoon dictionary={dictionary} />
        ) : (
          <>
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
              feeEstimateTransfer={nullableIf(feeTransferGasAmount !== null, feeEstimateTransfer)}
              feeTransferFeeRaw={feeTransferFeeRaw}
              feeFormulaTransfer={nullableIf(feeTransferGasAmount !== null, feeFormulaTransfer)}
              gasPrice={gasPrice}
              ethPrice={ethPrice}
            />
            {feeAmount !== null && feeBreakdown !== null ? (
              <ClaimServiceFeeRow
                dictionary={dictionary}
                feeAmount={feeAmount}
                feeBreakdown={feeBreakdown}
                unclaimed={claimAmount ?? unclaimed}
                networkFeeRaw={totalFeeRaw}
                bps={feeConfig?.bps ?? 0n}
                feeOptions={feeOptions}
                effectiveFeeMode={effectiveFeeMode}
                price={price}
                ethPrice={ethPrice}
                locked={enabled}
                onToggleSesh={togglePayInSesh}
              />
            ) : null}
          </>
        )}
      </div>
      <ClaimTrySingleClick
        visible={activeTab === 'legacy'}
        batchedAvailable={batchedAvailable}
        isBatchSupported={isBatchSupported}
        fellBackToLegacy={fellBackToLegacy}
        dictionary={dictionary}
        onSwitch={() => setActiveTab('single-click')}
      />
      {isSignaturePending ? <ClaimSignaturePending dictionary={dictionary} /> : null}
      <AlertDialogFooter className="mt-4 flex flex-col gap-6 sm:flex-col">
        {activeTab !== 'coming-soon' ? (
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

function feeToUsd(
  fee: bigint | null,
  mode: FeeMode,
  price: number | null,
  ethPrice: number | null
): number | null {
  if (fee === null) return null;
  return mode === 'eth' ? ethWeiToUsd(fee, ethPrice) : seshAtomicToUsd(fee, price);
}

function EthAmountWithUsd({
  formatted,
  wei,
  price,
}: {
  formatted: string | null;
  wei: bigint | null;
  price: number | null;
}) {
  if (formatted === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {formatted}
      <FiatUsd usd={wei === null ? null : ethWeiToUsd(wei, price)} />
    </span>
  );
}

function SeshAmountWithUsd({
  atomic,
  price,
}: {
  atomic: bigint | null;
  price: number | null;
}) {
  if (atomic === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {formatSENTBigInt(atomic, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
      <FiatUsd usd={seshAtomicToUsd(atomic, price)} />
    </span>
  );
}

function ClaimAmountAccordion({
  dictionary,
  unclaimed,
  amountFormatted,
  claimableRewards,
  claimableStakes,
  price,
}: {
  dictionary: ClaimDict;
  unclaimed: bigint | null;
  amountFormatted: string;
  claimableRewards: bigint | null;
  claimableStakes: bigint | null;
  price: number | null;
}) {
  return (
    <ActionModuleAccordionRow
      label={
        <>
          <HandCoinsIcon className="h-3.5 w-3.5" />
          {dictionary('dialog.amountClaimable')}
        </>
      }
      tooltip={dictionary('dialog.amountClaimableTooltip')}
      accordionContent={
        <div className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span>{dictionary('dialog.rewardsClaimable')}</span>
            <SeshAmountWithUsd atomic={claimableRewards} price={price} />
          </span>
          <span className="flex justify-between">
            <span>{dictionary('dialog.stakesClaimable')}</span>
            <SeshAmountWithUsd atomic={claimableStakes} price={price} />
          </span>
        </div>
      }
    >
      <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
        {amountFormatted}
        <FiatUsd usd={unclaimed === null ? null : seshAtomicToUsd(unclaimed, price)} />
      </span>
    </ActionModuleAccordionRow>
  );
}

function FeeAmount({
  fee,
  mode,
  price,
  ethPrice,
}: {
  fee: bigint | null;
  mode: FeeMode;
  price: number | null;
  ethPrice: number | null;
}) {
  const formatted = formatClaimFee(fee, mode);
  if (formatted === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {formatted}
      <FiatUsd usd={feeToUsd(fee, mode, price, ethPrice)} />
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
  ethPrice,
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
  ethPrice: number | null;
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
          fee: (
            <EthAmountWithUsd
              formatted={feeEstimateUpdate}
              wei={updateBalanceFeeRaw}
              price={ethPrice}
            />
          ),
          tooltip: feeFormulaUpdate,
          hasExemption: skipUpdateBalance,
          exemptionReason: dictionary('dialog.updateBalanceCostExemptionReason'),
        },
        {
          label: dictionary('dialog.claimRewardsCost'),
          fee: <EthAmountWithUsd formatted={feeEstimateClaim} wei={claimFeeRaw} price={ethPrice} />,
          tooltip: feeFormulaClaim,
        },
        ...(feeEstimateTransfer !== null || feeFormulaTransfer !== null
          ? [
              {
                label: dictionary('dialog.serviceFeeTransferCost'),
                fee: (
                  <EthAmountWithUsd
                    formatted={feeEstimateTransfer}
                    wei={feeTransferFeeRaw}
                    price={ethPrice}
                  />
                ),
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
      totalFee={<EthAmountWithUsd formatted={feeEstimate} wei={totalFeeRaw} price={ethPrice} />}
    />
  );
}

function ClaimServiceFeeRow({
  dictionary,
  feeAmount,
  feeBreakdown,
  unclaimed,
  networkFeeRaw,
  bps,
  feeOptions,
  effectiveFeeMode,
  price,
  ethPrice,
  locked,
  onToggleSesh,
}: {
  dictionary: ClaimDict;
  feeAmount: bigint | null;
  feeBreakdown: { flat: bigint; bps: bigint } | null;
  unclaimed: bigint | null;
  networkFeeRaw: bigint | null;
  bps: bigint;
  feeOptions: Array<{ mode: FeeMode; fee: bigint }>;
  effectiveFeeMode: FeeMode;
  price: number | null;
  ethPrice: number | null;
  locked: boolean;
  onToggleSesh: (payInSesh: boolean) => void;
}) {
  const percent = `${Number(bps) / 100}`;
  const seshAvailable = feeOptions.some((option) => option.mode === 'sesh');

  const feeToClaimRatio = computeClaimFeeToValueRatio({
    claimAmount: unclaimed,
    feeAmount,
    feeMode: effectiveFeeMode,
    networkFee: networkFeeRaw,
    price,
    ethPrice,
  });

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
              <FeeAmount
                fee={feeBreakdown?.flat ?? null}
                mode={effectiveFeeMode}
                price={price}
                ethPrice={ethPrice}
              />
            </span>
            <span className="flex justify-between">
              <span>{dictionary('dialog.serviceFeeBps', { percent })}</span>
              <FeeAmount
                fee={feeBreakdown?.bps ?? null}
                mode={effectiveFeeMode}
                price={price}
                ethPrice={ethPrice}
              />
            </span>
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
          <FeeAmount fee={feeAmount} mode={effectiveFeeMode} price={price} ethPrice={ethPrice} />
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
            price={price}
            ethPrice={ethPrice}
          />
        </span>
      ) : null}
      {feeToClaimRatio !== null &&
      feeToClaimRatio >= HANDRAIL_THRESHOLD.CLAIM_FEE_TO_VALUE_RATIO ? (
        <ClaimModeNotice
          message={dictionary('dialog.feeValueWarning', {
            percent: Math.round(feeToClaimRatio * 100),
          })}
        />
      ) : null}
    </>
  );
}

function computeClaimFeeToValueRatio({
  claimAmount,
  feeAmount,
  feeMode,
  networkFee,
  price,
  ethPrice,
}: {
  claimAmount: bigint | null;
  feeAmount: bigint | null;
  feeMode: FeeMode;
  networkFee: bigint | null;
  price: number | null;
  ethPrice: number | null;
}): number | null {
  if (claimAmount === null || feeAmount === null) return null;

  const claimUsd = seshAtomicToUsd(claimAmount, price);
  const serviceFeeUsd = feeToUsd(feeAmount, feeMode, price, ethPrice);
  if (claimUsd === null || claimUsd <= 0 || serviceFeeUsd === null) return null;

  const networkFeeUsd = networkFee === null ? 0 : ethWeiToUsd(networkFee, ethPrice);
  if (networkFeeUsd === null) return null;

  return (serviceFeeUsd + networkFeeUsd) / claimUsd;
}

function ClaimModeNotices({
  dictionary,
  batchedAvailable,
  isBatchSupported,
  fellBackToLegacy,
}: {
  dictionary: ClaimDict;
  batchedAvailable: boolean;
  isBatchSupported: boolean | null;
  fellBackToLegacy: boolean;
}) {
  if (!batchedAvailable) return null;
  return (
    <>
      {isBatchSupported === false ? (
        <ClaimModeNotice message={dictionary('dialog.batchedUnsupportedNotice')} />
      ) : null}
      {fellBackToLegacy ? (
        <ClaimModeNotice message={dictionary('dialog.batchedFallbackNotice')} />
      ) : null}
    </>
  );
}

function ClaimModeNotice({ message }: { message: string }) {
  return (
    <output className="flex items-start gap-2 text-warning text-xs">
      <TriangleAlertIcon className="h-4 w-4 shrink-0" />
      <p>{message}</p>
    </output>
  );
}

function ClaimModeTabs({
  activeTab,
  disabled,
  onTabChange,
  dictionary,
  isBatchSupported,
}: {
  activeTab: ClaimTab;
  disabled: boolean;
  onTabChange: (tab: ClaimTab) => void;
  dictionary: ClaimDict;
  isBatchSupported: boolean | null;
}) {
  const tabs: Array<{ id: ClaimTab; label: string; dataTestId: ButtonDataTestId }> = [
    {
      id: 'single-click',
      label: dictionary('dialog.tabs.singleClick'),
      dataTestId: ButtonDataTestId.Claim_Tokens_Tab_Single_Click,
    },
    {
      id: 'coming-soon',
      label: dictionary('dialog.tabs.comingSoon'),
      dataTestId: ButtonDataTestId.Claim_Tokens_Tab_Coming_Soon,
    },
    {
      id: 'legacy',
      label: dictionary('dialog.tabs.legacy'),
      dataTestId: ButtonDataTestId.Claim_Tokens_Tab_Legacy,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={dictionary('dialog.tabs.ariaLabel')}
      className="grid grid-cols-3 gap-2"
    >
      {tabs.map(({ id, label, dataTestId }) => (
        <Button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          variant={activeTab === id ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          disabled={disabled || (id === 'single-click' && isBatchSupported === false)}
          data-testid={dataTestId}
          onClick={() => onTabChange(id)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function ClaimComingSoon({ dictionary }: { dictionary: ClaimDict }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <SparklesIcon className="h-8 w-8 text-session-green" />
      <p className="text-md">{dictionary('dialog.comingSoonTitle')}</p>
      <p className="text-muted-foreground text-sm">{dictionary('dialog.comingSoonDescription')}</p>
    </div>
  );
}

function ClaimTrySingleClick({
  visible,
  batchedAvailable,
  isBatchSupported,
  fellBackToLegacy,
  dictionary,
  onSwitch,
}: {
  visible: boolean;
  batchedAvailable: boolean;
  isBatchSupported: boolean | null;
  fellBackToLegacy: boolean;
  dictionary: ClaimDict;
  onSwitch: () => void;
}) {
  // NOTE: only encourage wallets that can actually batch — never after a
  // failed single-click attempt fell back to this tab
  if (!visible || !batchedAvailable || isBatchSupported === false || fellBackToLegacy) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-1 gap-y-2 text-muted-foreground text-xs">
      {dictionary('dialog.trySingleClick')}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        data-testid={ButtonDataTestId.Claim_Tokens_Try_Single_Click}
        onClick={onSwitch}
      >
        {dictionary('dialog.trySingleClickLink')}
      </Button>
    </p>
  );
}

/**
 * Advanced mode controls: the custom claim amount input plus the on-chain
 * delta claimable without calling updateRewardsBalance. The balance update
 * always applies the full network-signed amount, so a split claim
 * (e.g. stakes then rewards) only ever pays for one update.
 */
function ClaimAdvancedControls({
  visible,
  address,
  maxClaim,
  value,
  onChange,
  disabled,
  dictionary,
}: {
  visible: boolean;
  address: Address;
  maxClaim: bigint | null;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
  dictionary: ClaimDict;
}) {
  const { rewards, claimed } = useGetRecipients({ address });

  if (!visible || maxClaim === null) return null;

  const claimableWithoutUpdate =
    rewards !== undefined && claimed !== undefined ? rewards - claimed : null;

  return (
    <div className="flex flex-col gap-2">
      <ClaimAmountField
        value={value}
        onChange={onChange}
        maxClaim={maxClaim}
        disabled={disabled}
        dataTestId={InputDataTestId.Claim_Tokens_Amount}
        dataTestIds={{
          buttonMax: ButtonDataTestId.Claim_Tokens_Amount_Max,
          buttonCancel: ButtonDataTestId.Claim_Tokens_Amount_Cancel,
        }}
      />
      {claimableWithoutUpdate !== null ? (
        <span className="text-muted-foreground text-xs">
          {dictionary('dialog.claimableWithoutUpdate', {
            amount: formatSENTBigInt(claimableWithoutUpdate, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS),
          })}
        </span>
      ) : null}
    </div>
  );
}

function ClaimSignaturePending({ dictionary }: { dictionary: ClaimDict }) {
  return (
    <output className="flex items-center gap-2 text-muted-foreground text-xs">
      {dictionary('dialog.signaturePending')}
      <LoadingText />
    </output>
  );
}
