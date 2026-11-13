import type { EditableFields } from '@/app/stake/[address]/StakeInfo';
import { ActionModuleRow, ActionModuleSectionHeader } from '@/components/ActionModule';
import { URL } from '@/lib/constants';
import { formatDate, formatPercentage } from '@/lib/locale-client';
import { getFeeDeltaVsMedian } from '@/lib/operator-insights';
import type { OperatorScoreSummary } from '@/lib/operator-score-schema';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { CONTRIBUTION_CONTRACT_STATUS } from '@session/staking-api-js/enums';
import type { ContributionContract } from '@session/staking-api-js/schema';
import { EditButton } from '@session/ui/components/EditButton';
import { LinkOutIcon } from '@session/ui/icons/LinkOutIcon';
import { cn } from '@session/ui/lib/utils';
import { Tooltip } from '@session/ui/ui/tooltip';
import { PubkeyWithEns } from '@session/wallet/components/PubkeyWithEns';
import { useTranslations } from 'next-intl';

type DecentralizationTier = {
  tier: 'good' | 'ok' | 'fair' | 'poor' | 'bad';
  className: string;
};

/**
 * Classifies an operator's unique-IP-per-node ratio into the tiers defined by
 * the seshtoken.info operator score (see OPERATOR_SCORE.md, Node / IP ratio).
 * Boundaries are inclusive (>=).
 */
export function getDecentralizationTier(ipPerNode: number): DecentralizationTier {
  if (ipPerNode >= 0.8) return { tier: 'good', className: 'text-session-green' };
  if (ipPerNode >= 0.5) return { tier: 'ok', className: '' };
  if (ipPerNode >= 0.3) return { tier: 'fair', className: 'text-warning' };
  if (ipPerNode >= 0.1) return { tier: 'poor', className: 'text-warning' };
  return { tier: 'bad', className: 'text-indicator-red' };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the complexity is required
export function OperatorSection({
  contract,
  operatorScore,
  medianOperatorFee,
  nOperators,
  isOperator,
  isSubmitting,
  editableFields,
}: {
  contract: ContributionContract;
  operatorScore: OperatorScoreSummary | null;
  /** Median operator fee of multicontributor network nodes, in percent times 100 (10,000 = 100%), from seshtoken.info */
  medianOperatorFee?: number | null;
  /** Total number of rated operators on the network */
  nOperators?: number | null;
  isOperator: boolean;
  isSubmitting: boolean;
  editableFields?: EditableFields;
}) {
  const dictShared = useTranslations('actionModules.shared');
  const dictOperator = useTranslations('actionModules.operator');
  const dictGeneral = useTranslations('general');

  const isFinalized = contract.status === CONTRIBUTION_CONTRACT_STATUS.Finalized;
  const haveOtherContributorsContributed = contract.contributors.length > 1;

  const feeDelta = getFeeDeltaVsMedian(contract.fee, medianOperatorFee);
  const medianFeePercentage =
    medianOperatorFee !== null && medianOperatorFee !== undefined
      ? medianOperatorFee / 10_000
      : null;

  return (
    <>
      <ActionModuleSectionHeader>{dictShared('sectionOperator')}</ActionModuleSectionHeader>
      <ActionModuleRow
        label={dictShared('operatorAddress')}
        tooltip={dictShared('operatorAddressDescription')}
      >
        <PubkeyWithEns
          pubKey={contract.operator_address}
          force="collapse"
          alwaysShowCopyButton
          leadingChars={8}
          trailingChars={4}
          className="font-semibold"
        />
      </ActionModuleRow>
      <ActionModuleRow
        label={dictShared('operatorFee')}
        tooltip={dictShared('operatorFeeDescription')}
      >
        <span className="font-semibold">
          {contract.fee !== null ? formatPercentage(contract.fee / 10000) : dictGeneral('notFound')}
        </span>
        {feeDelta !== null && feeDelta !== 0 && medianFeePercentage !== null ? (
          <Tooltip
            tooltipContent={dictShared(
              feeDelta > 0 ? 'operatorFeeAboveMedian' : 'operatorFeeBelowMedian',
              {
                median: formatPercentage(medianFeePercentage),
              }
            )}
          >
            <span
              className={cn(
                'ms-2 font-semibold',
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
        {isOperator ? (
          <Tooltip tooltipContent="Editing this field is not yet supported">
            <EditButton
              disabled={
                // TODO: Implement operator fee field changing
                true ||
                haveOtherContributorsContributed ||
                isSubmitting ||
                isFinalized ||
                editableFields?.operatorFee?.disabled ||
                !editableFields?.operatorFee?.editOnClick
              }
              onClick={editableFields?.operatorFee?.editOnClick}
              aria-label={dictShared('buttonEditField.aria', {
                field: dictShared('operatorFee'),
              })}
              data-testid={ButtonDataTestId.Stake_Edit_Operator_Fee}
            />
          </Tooltip>
        ) : null}
      </ActionModuleRow>
      {operatorScore ? (
        <>
          <ActionModuleRow
            label={dictOperator('score')}
            tooltip={dictOperator('scoreDescription')}
            containerClassName="gap-2"
          >
            {operatorScore.score !== null && operatorScore.rank !== null ? (
              <>
                <span
                  className={cn(
                    'font-semibold',
                    operatorScore.score >= 0 ? 'text-session-green' : 'text-indicator-red'
                  )}
                >
                  {operatorScore.score > 0 ? '+' : ''}
                  {operatorScore.score}
                </span>
                <span className="font-normal">
                  {dictOperator('rank', {
                    rank: operatorScore.rank,
                    total: nOperators ?? operatorScore.rank,
                  })}
                </span>
              </>
            ) : (
              <span className="font-semibold text-muted-foreground">{dictOperator('unrated')}</span>
            )}
            <a
              href={`${URL.SESH_TOKEN_EXPLORER}/address/${contract.operator_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 align-middle text-session-green text-sm underline-offset-2"
            >
              {dictOperator('viewProfile')}
              <LinkOutIcon className="h-4 w-4" />
            </a>
          </ActionModuleRow>
          <ActionModuleRow
            label={dictOperator('experience')}
            tooltip={dictOperator('experienceDescription')}
          >
            <span className="font-semibold">
              {dictOperator('nodesOperated', { count: operatorScore.n_active_nodes })}
            </span>
            {operatorScore.first_registration_timestamp !== null ? (
              <span className="ms-2 font-normal text-muted-foreground">
                {dictOperator('since', {
                  date: formatDate(new Date(operatorScore.first_registration_timestamp * 1000), {
                    dateStyle: 'medium',
                  }),
                })}
              </span>
            ) : null}
          </ActionModuleRow>
          <ActionModuleRow
            label={dictOperator('deregistrations')}
            tooltip={dictOperator('deregistrationsDescription')}
          >
            {operatorScore.deregistrations_recent > 0 ? (
              <span className="font-semibold text-indicator-red">
                {dictOperator('deregistrationsRecent', {
                  count: operatorScore.deregistrations_recent,
                })}
              </span>
            ) : operatorScore.deregistrations_longterm > 0 ? (
              <span className="font-semibold text-warning">
                {dictOperator('deregistrationsLongterm', {
                  count: operatorScore.deregistrations_longterm,
                })}
              </span>
            ) : (
              <span className="font-semibold text-session-green">
                {dictOperator('deregistrationsNone')}
              </span>
            )}
          </ActionModuleRow>
          <ActionModuleRow
            label={dictOperator('decentralization')}
            tooltip={dictOperator('decentralizationDescription')}
            last
          >
            {operatorScore.ip_per_node !== null ? (
              <Tooltip
                tooltipContent={
                  operatorScore.n_unique_ips !== null ? (
                    <>
                      {dictOperator('decentralizationBreakdown', {
                        nodes: operatorScore.n_active_nodes,
                        ips: operatorScore.n_unique_ips,
                      })}
                      <br />
                      {dictOperator('decentralizationRating', {
                        rating: dictOperator(
                          `decentralizationTier.${getDecentralizationTier(operatorScore.ip_per_node).tier}`
                        ),
                      })}
                    </>
                  ) : null
                }
              >
                <span
                  className={cn(
                    'font-semibold',
                    getDecentralizationTier(operatorScore.ip_per_node).className
                  )}
                >
                  {formatPercentage(operatorScore.ip_per_node, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
              </Tooltip>
            ) : (
              <span className="font-semibold">{dictGeneral('notFound')}</span>
            )}
          </ActionModuleRow>
        </>
      ) : null}
      <div className="h-2" />
    </>
  );
}
