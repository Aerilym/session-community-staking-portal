import type { EditableFields } from '@/app/stake/[address]/StakeInfo';
import { ActionModuleRow, ActionModuleSectionHeader } from '@/components/ActionModule';
import { NodeContributorList } from '@/components/NodeCard';
import { ReservedStakesTable } from '@/components/ReservedStakesTable';
import type { ReservedContributorStruct } from '@/hooks/useCreateOpenNodeRegistration';
import { SESSION_NODE_FULL_STAKE_AMOUNT } from '@/lib/constants';
import { formatPercentage } from '@/lib/locale-client';
import { getTotalStaked } from '@/lib/maths';
import { getFillPercentage } from '@/lib/operator-insights';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { TOKEN } from '@session/contracts';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { CONTRIBUTION_CONTRACT_STATUS } from '@session/staking-api-js/enums';
import type {
  ContributionContract,
  ContributionContractContributor,
} from '@session/staking-api-js/schema';
import { EditButton } from '@session/ui/components/EditButton';
import type { EthereumAddress } from '@session/util-crypto/keys';
import { PubkeyWithEns } from '@session/wallet/components/PubkeyWithEns';
import { useTranslations } from 'next-intl';

export function StakeSection({
  contract,
  totalStaked,
  contributor,
  reservedContributors,
  activeAddress,
  isSubmitting,
  editableFields,
}: {
  contract: ContributionContract;
  totalStaked?: bigint;
  contributor?: ContributionContractContributor;
  reservedContributors: Array<ReservedContributorStruct>;
  activeAddress?: EthereumAddress;
  isSubmitting: boolean;
  editableFields?: EditableFields;
}) {
  const dictionaryRegistrationShared = useTranslations('actionModules.registration.shared');
  const dictShared = useTranslations('actionModules.shared');
  const actionModuleDictionary = useTranslations('actionModules');
  const dictGeneral = useTranslations('general');

  const isFinalized = contract.status === CONTRIBUTION_CONTRACT_STATUS.Finalized;
  const fillPercentage = getFillPercentage(contract);
  const hasReservedContributors = reservedContributors.length > 1;

  return (
    <>
      <ActionModuleSectionHeader>{dictShared('sectionStake')}</ActionModuleSectionHeader>
      <ActionModuleRow
        label={actionModuleDictionary('node.contributors')}
        tooltip={actionModuleDictionary('node.contributorsTooltip')}
      >
        <NodeContributorList
          contributors={contract.contributors}
          operatorAddress={contract.operator_address}
          userAddress={activeAddress}
          forceExpand
          showEmptySlots
        />
      </ActionModuleRow>
      {contributor ? (
        <ActionModuleRow
          label={dictShared('yourStake')}
          tooltip={dictShared('yourStakeDescription')}
        >
          {formatSENTBigInt(contributor.amount)}
          <EditButton
            aria-label={dictShared('buttonEditField.aria', { field: dictShared('yourStake') })}
            data-testid={ButtonDataTestId.Stake_Edit_Stake_Amount}
            disabled={
              isSubmitting ||
              isFinalized ||
              editableFields?.stakeAmount?.disabled ||
              !editableFields?.stakeAmount?.editOnClick
            }
            onClick={editableFields?.stakeAmount?.editOnClick}
          />
        </ActionModuleRow>
      ) : null}
      <ActionModuleRow
        label={dictShared('totalStaked')}
        tooltip={dictShared('totalStakedDescription')}
      >
        {`${formatSENTBigInt(totalStaked ?? getTotalStaked(contract.contributors), TOKEN.DECIMALS, true)} / ${formatSENTBigInt(SESSION_NODE_FULL_STAKE_AMOUNT)}`}
        <span className="ms-2 font-normal text-muted-foreground">
          {formatPercentage(fillPercentage / 100, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </span>
      </ActionModuleRow>
      {contributor ? (
        <ActionModuleRow
          label={dictShared('rewardsAddress')}
          tooltip={dictShared('rewardsAddressDescription')}
        >
          <PubkeyWithEns
            pubKey={contributor.beneficiary_address ?? contributor.address ?? dictGeneral('none')}
            force="collapse"
            alwaysShowCopyButton
            leadingChars={8}
            trailingChars={4}
            className="font-semibold"
          />
          <EditButton
            disabled={
              isSubmitting ||
              isFinalized ||
              editableFields?.rewardsAddress?.disabled ||
              !editableFields?.rewardsAddress?.editOnClick
            }
            onClick={editableFields?.rewardsAddress?.editOnClick}
            aria-label={dictionaryRegistrationShared('buttonEditField.aria')}
            data-testid={ButtonDataTestId.Stake_Edit_Rewards_Address}
          />
        </ActionModuleRow>
      ) : null}
      {/* reservedContributors length 1 means only the operator, so we treat it as no reserved slots*/}
      {hasReservedContributors ? (
        <ActionModuleRow
          label={dictShared('reserveSlots')}
          tooltip={dictShared('reserveSlotsDescription')}
          parentClassName="flex flex-col gap-2 justify-start items-start w-full"
          containerClassName="w-full"
        >
          <ReservedStakesTable reservedStakes={reservedContributors} className="my-2 w-full" />
        </ActionModuleRow>
      ) : null}
    </>
  );
}
