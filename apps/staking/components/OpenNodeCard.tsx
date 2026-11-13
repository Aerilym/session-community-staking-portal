'use client';

import {
  getContributedContributor,
  getContributionRangeForWallet,
  getReservedContributorNonContributed,
} from '@/app/stake/[address]/StakeInfo';
import {
  InfoNodeCard,
  NodeInfoCardText,
  NodeItem,
  NodeItemSeparator,
  NodeItemValue,
} from '@/components/InfoNodeCard';
import { useNodeHistory } from '@/hooks/useNodeHistory';
import { SESSION_NODE_FULL_STAKE_AMOUNT } from '@/lib/constants';
import { formatDurationFromDays, formatPercentage } from '@/lib/locale-client';
import { getTotalStaked } from '@/lib/maths';
import { summarizeNodeHistory } from '@/lib/node-history';
import { getFeeDeltaVsMedian, getFillPercentage } from '@/lib/operator-insights';
import type { OperatorScoreSummary } from '@/lib/operator-score-schema';
import { STAKE_CONTRACT_STATE, parseStakeContractState } from '@/lib/stake-state';
import { useUser } from '@/providers/user-provider';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import type { ContributionContract } from '@session/staking-api-js/schema';
import { ContactIcon } from '@session/ui/icons/ContactIcon';
import { SessionTokenIcon } from '@session/ui/icons/SessionTokenIcon';
import { cn } from '@session/ui/lib/utils';
import { AlertTooltip, Tooltip } from '@session/ui/ui/tooltip';
import { areEthereumAddressesEqual } from '@session/util-crypto/string';
import { PubkeyWithEns } from '@session/wallet/components/PubkeyWithEns';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { type HTMLAttributes, forwardRef, useMemo } from 'react';

export const StakedToIndicator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    tokenAmount: bigint;
    hideTextOnMobile?: boolean;
  }
>(({ className, hideTextOnMobile, tokenAmount, ...props }, ref) => {
  const dictionary = useTranslations('nodeCard.open');

  return (
    <>
      <Tooltip
        tooltipContent={dictionary('stakedToTooltip', {
          tokenAmount: formatSENTBigInt(tokenAmount),
        })}
      >
        <div
          ref={ref}
          className={cn(
            'flex flex-row items-center gap-1 align-middle font-normal text-session-green text-sm md:text-base',
            className
          )}
          {...props}
        >
          <SessionTokenIcon className="h-3.5 w-3.5 fill-session-green" />
          {hideTextOnMobile ? (
            <span className="hidden md:block">{dictionary('stakedTo')}</span>
          ) : (
            dictionary('stakedTo')
          )}
        </div>
      </Tooltip>
    </>
  );
});

const OpenNodeCard = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    contract: ContributionContract;
    forceSmall?: boolean;
    showAlreadyRunningWarning?: boolean;
    /** Median operator fee of multicontributor network nodes, in percent times 100 (10,000 = 100%), from seshtoken.info */
    medianOperatorFee?: number | null;
    operatorScore?: OperatorScoreSummary | null;
  }
>(
  (
    {
      className,
      forceSmall,
      showAlreadyRunningWarning,
      contract,
      medianOperatorFee,
      operatorScore,
      ...props
    },
    ref
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the complexity is required
  ) => {
    const dictionary = useTranslations('nodeCard.open');
    const generalNodeDictionary = useTranslations('sessionNodes.general');
    const dictGeneral = useTranslations('general');
    const titleFormat = useTranslations('modules.title');
    const pathname = usePathname();
    const { activeAddress } = useUser();

    const { isOperator, contributor, reservedContributor } = useMemo(() => {
      return {
        isOperator: areEthereumAddressesEqual(contract.operator_address, activeAddress),
        contributor: getContributedContributor(contract, activeAddress),
        reservedContributor: getReservedContributorNonContributed(contract, activeAddress),
      };
    }, [contract, activeAddress]);

    const { minStake, maxStake } = getContributionRangeForWallet(contract, activeAddress);
    const totalStaked = getTotalStaked(contract.contributors);

    const connectedWalletNonContributedReservedStakeAmount =
      (!contributor && reservedContributor?.reserved) || 0;

    const state = parseStakeContractState(contract);

    const isActive = pathname === `/stake/${contract.address}`;

    const fillPercentage = getFillPercentage(contract);
    const feeDelta = getFeeDeltaVsMedian(contract.fee, medianOperatorFee);
    const medianFeePercentage =
      medianOperatorFee !== null && medianOperatorFee !== undefined
        ? medianOperatorFee / 10_000
        : null;

    const { data: nodeHistory } = useNodeHistory(contract.service_node_pubkey);
    const nodeHistorySummary = useMemo(
      () => (nodeHistory ? summarizeNodeHistory(nodeHistory.generations) : null),
      [nodeHistory]
    );

    const alreadyRunningWarning = showAlreadyRunningWarning ? (
      <AlertTooltip
        iconClassName="h-4 w-4 md:h-10 md:w-10"
        tooltipContent={dictionary('errorStakedButAlreadyRunning')}
      />
    ) : null;

    const unfilledOperatorOrReserveStakeWarning =
      state === STAKE_CONTRACT_STATE.AWAITING_OPERATOR_CONTRIBUTION ? (
        <AlertTooltip
          iconClassName="h-10 w-10"
          tooltipContent={dictionary('youOperatorNotStaked')}
        />
      ) : connectedWalletNonContributedReservedStakeAmount ? (
        <Tooltip
          tooltipContent={dictionary('youReservedNotContributed', {
            tokenAmount: formatSENTBigInt(connectedWalletNonContributedReservedStakeAmount),
          })}
        >
          <ContactIcon className="h-10 w-10 stroke-session-green" />
        </Tooltip>
      ) : null;

    const createPrimaryDataSection = (className?: string) =>
      !contributor ? (
        <NodeInfoCardText
          className={className}
          label={titleFormat('format', { title: dictionary('range') })}
        >
          {formatSENTBigInt(reservedContributor?.reserved ?? minStake, 0, true)} –{' '}
          {formatSENTBigInt(maxStake, 0)}
        </NodeInfoCardText>
      ) : (
        <>
          <NodeInfoCardText
            className={cn('hidden md:block', className)}
            label={titleFormat('format', { title: dictionary('remainingStake') })}
          >
            {formatSENTBigInt(SESSION_NODE_FULL_STAKE_AMOUNT - totalStaked, 2)}
          </NodeInfoCardText>
          <NodeItemSeparator className={className} />
          <NodeInfoCardText
            className={className}
            label={titleFormat('format', { title: dictionary('filled') })}
          >
            {formatPercentage(fillPercentage / 100, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </NodeInfoCardText>
        </>
      );

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the complexity is required
    const createSecondaryDataSection = (className?: string, separatorClassName?: string) => (
      <>
        <NodeInfoCardText
          className={className}
          label={titleFormat('format', { title: generalNodeDictionary('operatorFeeShort') })}
        >
          {contract.fee !== null ? formatPercentage(contract.fee / 10000) : dictGeneral('notFound')}
          {feeDelta !== null && feeDelta !== 0 && medianFeePercentage !== null ? (
            <Tooltip
              tooltipContent={dictionary(feeDelta > 0 ? 'feeAboveMedian' : 'feeBelowMedian', {
                median: formatPercentage(medianFeePercentage),
              })}
            >
              <span
                className={cn(
                  'ms-1 text-nowrap font-semibold',
                  feeDelta > 0 ? 'text-indicator-red' : 'text-indicator-green'
                )}
              >
                {feeDelta > 0 ? '+' : '−'}
                {formatPercentage(Math.abs(feeDelta), {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1,
                })}
              </span>
            </Tooltip>
          ) : null}
        </NodeInfoCardText>
        <NodeItemSeparator className={separatorClassName} />
        {nodeHistory && nodeHistorySummary ? (
          nodeHistory.generations.length === 0 ? (
            <Tooltip tooltipContent={dictionary('generationsNewTooltip')}>
              <span className={cn('font-normal', className)}>{dictionary('newNodeLabel')}</span>
            </Tooltip>
          ) : (
            <Tooltip
              tooltipContent={dictionary('generationsTooltip', {
                count: nodeHistory.generations.length,
                exits: nodeHistorySummary.normalExits,
                liquidations: nodeHistorySummary.liquidations,
                deregistrations: nodeHistorySummary.deregistrations,
              })}
            >
              <span className={className}>
                <NodeInfoCardText
                  label={titleFormat('format', { title: dictionary('generationsLabel') })}
                >
                  {nodeHistory.generations.length}
                </NodeInfoCardText>
              </span>
            </Tooltip>
          )
        ) : null}
        {nodeHistorySummary && nodeHistorySummary.totalUptimeDays > 0 ? (
          <>
            <NodeItemSeparator className={separatorClassName} />
            <Tooltip tooltipContent={dictionary('uptimeTooltip')}>
              <span className={className}>
                <NodeInfoCardText
                  label={titleFormat('format', { title: dictionary('uptimeLabel') })}
                >
                  {formatDurationFromDays(nodeHistorySummary.totalUptimeDays)}
                </NodeInfoCardText>
              </span>
            </Tooltip>
          </>
        ) : null}
      </>
    );

    return (
      <InfoNodeCard
        ref={ref}
        className={className}
        pubKey={contract.service_node_pubkey}
        isOperator={isOperator}
        statusIndicatorColour={
          state === STAKE_CONTRACT_STATE.AWAITING_OPERATOR_CONTRIBUTION || showAlreadyRunningWarning
            ? 'yellow'
            : connectedWalletNonContributedReservedStakeAmount
              ? 'green'
              : 'blue'
        }
        isActive={pathname === `/stake/${contract.address}`}
        forceSmall={forceSmall}
        button={
          !isActive
            ? {
                ariaLabel: dictionary('viewButton.ariaLabel'),
                text: dictionary('viewButton.text'),
                dataTestId: ButtonDataTestId.Node_Card_View,
                link: `/stake/${contract.address}`,
              }
            : undefined
        }
        warnings={
          alreadyRunningWarning || unfilledOperatorOrReserveStakeWarning ? (
            <>
              {alreadyRunningWarning}
              {unfilledOperatorOrReserveStakeWarning}
            </>
          ) : undefined
        }
        headerSiblings={
          <>
            <>
              {createPrimaryDataSection('2xl:inline-flex hidden')}
              <NodeItemSeparator className="hidden 2xl:inline-flex" />
              {createSecondaryDataSection('2xl:inline-flex hidden', '2xl:inline-flex hidden')}
            </>
            <>
              {createPrimaryDataSection('2xl:hidden inline-flex')}
              <div
                className={cn(
                  'inline-flex flex-col flex-wrap items-baseline gap-x-1 align-middle sm:flex-row md:gap-x-1.5 2xl:hidden'
                )}
              >
                {createSecondaryDataSection(
                  '2xl:hidden inline-flex',
                  '2xl:hidden sm:inline-flex hidden'
                )}
              </div>
            </>
          </>
        }
        {...props}
      >
        {contributor ? (
          <NodeItem className="-ms-0.5 mb-0.5 flex flex-row items-center align-middle">
            <StakedToIndicator
              className="me-1.5"
              hideTextOnMobile
              tokenAmount={contributor.amount}
            />
            <NodeItemValue>{formatSENTBigInt(contributor.amount, 1)}</NodeItemValue>
          </NodeItem>
        ) : null}
        <NodeInfoCardText label={titleFormat('format', { title: dictionary('operatorLabel') })}>
          <PubkeyWithEns pubKey={contract.operator_address} side="bottom" />
        </NodeInfoCardText>
        {operatorScore ? (
          <>
            {operatorScore.score !== null && operatorScore.rank !== null ? (
              <Tooltip
                tooltipContent={dictionary('operatorScoreTooltip', {
                  rank: operatorScore.rank,
                  score: operatorScore.score,
                  nodes: operatorScore.n_active_nodes,
                })}
              >
                <span>
                  <NodeInfoCardText label={dictionary('operatorScoreLabel')}>
                    <span
                      className={
                        operatorScore.score >= 0 ? 'text-session-green' : 'text-indicator-red'
                      }
                    >
                      {operatorScore.score > 0 ? '+' : ''}
                      {operatorScore.score}
                    </span>{' '}
                    {dictionary('rankedLabel', { number: operatorScore.rank })}
                  </NodeInfoCardText>
                </span>
              </Tooltip>
            ) : (
              <Tooltip tooltipContent={dictionary('operatorUnratedTooltip')}>
                <span className="font-normal">{dictionary('operatorUnrated')}</span>
              </Tooltip>
            )}
          </>
        ) : null}
      </InfoNodeCard>
    );
  }
);
OpenNodeCard.displayName = 'OpenNodeCard';

export { OpenNodeCard };
