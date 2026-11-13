import { useEthPrice } from '@/app/mystakes/modules/PriceModule';
import { ActionModuleFeeAccordionRow } from '@/components/ActionModuleFeeAccordionRow';
import { FiatUsd } from '@/components/FiatUsd';
import { WizardSectionDescription } from '@/components/Wizard';
import { useNetworkFeeFormula } from '@/hooks/useNetworkFeeFormula';
import { HANDRAIL_THRESHOLDS, SIGNIFICANT_FIGURES, URL } from '@/lib/constants';
import { ethWeiToUsd } from '@session/contracts';
import { useContributeFundsFeeEstimate } from '@session/contracts/hooks/ServiceNodeContribution';
import {
  formatSENTBigInt,
  useAllowanceQuery,
  useProxyApprovalFeeEstimate,
} from '@session/contracts/hooks/Token';
import type { ContributionContract } from '@session/staking-api-js/schema';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { Address } from 'viem';

function EthFeeWithUsd({
  fee,
  wei,
  ethPrice,
}: {
  fee: string | null;
  wei: bigint | null;
  ethPrice: number | null;
}): ReactNode {
  if (fee === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-nowrap align-middle">
      {fee}
      <FiatUsd usd={wei === null ? null : ethWeiToUsd(wei, ethPrice)} />
    </span>
  );
}

export function ContributeFundsFeeActionModuleRow({
  contract,
  stakeAmount,
  minStake,
  maxStake,
}: {
  contract: ContributionContract;
  stakeAmount: bigint;
  minStake: bigint;
  maxStake: bigint;
}) {
  const { address } = useWallet();
  const ethPrice = useEthPrice();
  const dictFee = useTranslations('fee');
  const dictSubmit = useTranslations('actionModules.registration.submitMulti');
  const dictShared = useTranslations('actionModules.shared');

  const { allowance } = useAllowanceQuery({
    contractAddress: contract.address,
    gcTime: Number.POSITIVE_INFINITY,
  });

  const needsApproval = !allowance || allowance < stakeAmount;

  const {
    fee: feeProxyApproval,
    gasAmount: gasAmountProxyApproval,
    gasPrice: gasPriceProxyApproval,
  } = useProxyApprovalFeeEstimate({
    contractAddress: contract.address,
    amount: maxStake,
  });

  const {
    fee: feeContributeFunds,
    gasPrice: gasPriceContributeFunds,
    gasAmount: gasAmountContributeFunds,
  } = useContributeFundsFeeEstimate({
    amount: minStake,
    // This is fine, its to get the fee estimate
    beneficiary: address as Address,
  });

  const { feeFormatted: feeFormattedProxyApproval, formula: formulaProxyApproval } =
    useNetworkFeeFormula({
      fee: feeProxyApproval,
      gasAmount: gasAmountProxyApproval,
      gasPrice: gasPriceProxyApproval,
      maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_BREAKDOWN,
    });

  const { feeFormatted: feeFormattedContributeFunds, formula: formulaContributeFunds } =
    useNetworkFeeFormula({
      fee: feeContributeFunds,
      gasAmount: gasAmountContributeFunds,
      gasPrice: gasPriceContributeFunds,
      maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_BREAKDOWN,
    });

  const gasPrice = gasPriceContributeFunds;

  const hasTotalEstimate = !!(feeProxyApproval || feeContributeFunds);
  const totalFeeWei = hasTotalEstimate
    ? (feeProxyApproval ?? 0n) + (feeContributeFunds ?? 0n)
    : null;

  const { feeFormatted: feeEstimate } = useNetworkFeeFormula({
    fee: hasTotalEstimate ? totalFeeWei : null,
    gasAmount:
      gasAmountProxyApproval || gasAmountContributeFunds
        ? (gasAmountProxyApproval ?? 0n) + (gasAmountContributeFunds ?? 0n)
        : null,
    gasPrice,
    maximumSignificantDigits: SIGNIFICANT_FIGURES.GAS_FEE_TOTAL,
  });

  const gasHighShowTooltip = !!(gasPrice && gasPrice > HANDRAIL_THRESHOLDS.GAS_PRICE);

  return (
    <ActionModuleFeeAccordionRow
      label={dictFee('networkFee')}
      tooltip={
        <WizardSectionDescription
          className="text-base md:text-base"
          description={dictFee.rich('networkFeeTooltip', {
            linkOut: '',
          })}
          href={URL.GAS_INFO}
        />
      }
      fees={[
        {
          label: dictShared('proxyApprovalCost'),
          fee: (
            <EthFeeWithUsd
              fee={feeFormattedProxyApproval}
              wei={feeProxyApproval}
              ethPrice={ethPrice}
            />
          ),
          tooltip: formulaProxyApproval,
          hasExemption: !needsApproval,
          exemptionReason: dictShared('proxyApprovalNotNeededTooltip', {
            amount: formatSENTBigInt(allowance, 0),
          }),
        },
        {
          label: dictSubmit('contributeFundsCost'),
          fee: (
            <EthFeeWithUsd
              fee={feeFormattedContributeFunds}
              wei={feeContributeFunds}
              ethPrice={ethPrice}
            />
          ),
          tooltip: formulaContributeFunds,
        },
      ]}
      showDivider
      totalFee={
        needsApproval ? (
          <EthFeeWithUsd fee={feeEstimate} wei={totalFeeWei} ethPrice={ethPrice} />
        ) : (
          <EthFeeWithUsd
            fee={feeFormattedContributeFunds}
            wei={feeContributeFunds}
            ethPrice={ethPrice}
          />
        )
      }
      hasMissingEstimatesTooltipContent={dictFee('missingFees')}
      gasHighShowTooltip={gasHighShowTooltip}
      gasHighTooltip={
        <WizardSectionDescription
          className="text-base md:text-base"
          description={dictFee.rich('gasHigh', {
            linkOut: '',
          })}
          href={URL.GAS_INFO}
        />
      }
    />
  );
}
