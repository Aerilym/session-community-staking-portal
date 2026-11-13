import type { EditableFields } from '@/app/stake/[address]/StakeInfo';
import { ActionModuleRow, ActionModuleSectionHeader } from '@/components/ActionModule';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { CONTRIBUTION_CONTRACT_STATUS } from '@session/staking-api-js/enums';
import type { ContributionContract } from '@session/staking-api-js/schema';
import { EditButton } from '@session/ui/components/EditButton';
import { PubKey } from '@session/ui/components/PubKey';
import { Tooltip } from '@session/ui/ui/tooltip';
import { useTranslations } from 'next-intl';

export function NodeSection({
  contract,
  isOperator,
  isSubmitting,
  editableFields,
}: {
  contract: ContributionContract;
  isOperator: boolean;
  isSubmitting: boolean;
  editableFields?: EditableFields;
}) {
  const dictShared = useTranslations('actionModules.shared');
  const sessionNodeDictionary = useTranslations('sessionNodes.general');
  const dictGeneral = useTranslations('general');

  const isFinalized = contract.status === CONTRIBUTION_CONTRACT_STATUS.Finalized;

  return (
    <>
      <ActionModuleSectionHeader>{dictShared('sectionNode')}</ActionModuleSectionHeader>
      <ActionModuleRow
        label={sessionNodeDictionary('publicKeyShort')}
        tooltip={sessionNodeDictionary('publicKeyDescription')}
      >
        <PubKey
          pubKey={contract.service_node_pubkey}
          force="collapse"
          alwaysShowCopyButton
          leadingChars={8}
          trailingChars={4}
        />
      </ActionModuleRow>
      <ActionModuleRow
        label={sessionNodeDictionary('blsKey')}
        tooltip={sessionNodeDictionary('blsKeyDescription')}
      >
        <PubKey
          pubKey={contract.pubkey_bls ?? dictGeneral('notFound')}
          force="collapse"
          alwaysShowCopyButton
          leadingChars={8}
          trailingChars={4}
        />
      </ActionModuleRow>
      <ActionModuleRow
        label={dictShared('autoActivate')}
        tooltip={dictShared('autoActivateDescription')}
        last
      >
        <span className="font-semibold">
          {dictShared(!contract.manual_finalize ? 'enabled' : 'disabled')}
        </span>
        {isOperator ? (
          <Tooltip tooltipContent="Editing this field is not yet supported">
            <EditButton
              aria-label={dictShared('buttonEditField.aria', {
                field: dictShared('autoActivate'),
              })}
              data-testid={ButtonDataTestId.Stake_Edit_Auto_Activate}
              disabled={
                // TODO: Implement auto activation field changing
                true ||
                isSubmitting ||
                isFinalized ||
                editableFields?.autoActivate?.disabled ||
                !editableFields?.autoActivate?.editOnClick
              }
              onClick={editableFields?.autoActivate?.editOnClick}
            />
          </Tooltip>
        ) : null}
      </ActionModuleRow>
      <div className="h-2" />
    </>
  );
}
