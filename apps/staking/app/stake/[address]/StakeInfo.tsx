import { NodeHistorySection } from '@/app/stake/[address]/sections/NodeHistorySection';
import { NodeSection } from '@/app/stake/[address]/sections/NodeSection';
import { OperatorSection } from '@/app/stake/[address]/sections/OperatorSection';
import { StakeSection } from '@/app/stake/[address]/sections/StakeSection';
import type { ReservedContributorStruct } from '@/hooks/useCreateOpenNodeRegistration';
import { useNodeHistory } from '@/hooks/useNodeHistory';
import { useOperatorScores } from '@/hooks/useOperatorScores';
import { getContributionRangeFromContributorsIgnoreAddress } from '@/lib/maths';
import { useUser } from '@/providers/user-provider';
import type { ContributionContract } from '@session/staking-api-js/schema';
import type { EthereumAddress } from '@session/util-crypto/keys';
import { bigIntMax } from '@session/util-crypto/maths';
import { areEthereumAddressesEqual } from '@session/util-crypto/string';
import { type ReactNode, forwardRef, useMemo } from 'react';
import { isAddress } from 'viem';

export function getReservedSlots(contract: ContributionContract): Array<ReservedContributorStruct> {
  return contract.contributors
    .filter(({ address, reserved }) => reserved && isAddress(address))
    .map(({ address, reserved }) => {
      return {
        addr: address,
        amount: reserved,
      };
    })
    .sort((a, b) => {
      const isAOperator = areEthereumAddressesEqual(a.addr, contract.operator_address);
      const isBOperator = areEthereumAddressesEqual(b.addr, contract.operator_address);
      return isAOperator ? -1 : isBOperator ? 1 : 0;
    });
}

export function getContributedContributor(
  contract: ContributionContract,
  address?: EthereumAddress
) {
  if (!address) return undefined;
  return contract.contributors.find(
    ({ address: contributorAddress, amount }) =>
      amount > 0n && areEthereumAddressesEqual(contributorAddress, address)
  );
}

export function getReservedContributor(contract: ContributionContract, address?: EthereumAddress) {
  if (!address) return undefined;
  return contract.contributors.find(
    ({ address: contributorAddress, reserved }) =>
      reserved > 0n && areEthereumAddressesEqual(contributorAddress, address)
  );
}

export function getReservedContributorNonContributed(
  contract: ContributionContract,
  address?: EthereumAddress
) {
  if (!address) return undefined;
  return contract.contributors.find(
    ({ address: contributorAddress, reserved, amount }) =>
      reserved > 0n && amount === 0n && areEthereumAddressesEqual(contributorAddress, address)
  );
}

export const getContributionRangeForWallet = (
  contract: ContributionContract,
  address?: EthereumAddress
) => {
  const reservedContributor = getReservedContributor(contract, address);

  const { minStake: minStakeCalculated, maxStake } =
    getContributionRangeFromContributorsIgnoreAddress(contract.contributors, address);

  const minStake = bigIntMax(reservedContributor?.reserved, minStakeCalculated);

  return {
    minStake,
    maxStake,
  };
};

export type EditableField = 'stakeAmount' | 'rewardsAddress' | 'operatorFee' | 'autoActivate';

export type FieldProps = {
  editOnClick?: () => void;
  disabled?: boolean;
  disabledTooltipContent?: string;
};

export type EditableFields = Partial<Record<EditableField, FieldProps>>;

export type StakeInfoProps = {
  contract: ContributionContract;
  totalStaked?: bigint;
  isSubmitting: boolean;
  editableFields?: EditableFields;
  children?: ReactNode;
};

export const StakeInfo = forwardRef<HTMLDivElement, StakeInfoProps>(
  ({ contract, totalStaked, editableFields, isSubmitting, children, ...props }, ref) => {
    const { activeAddress } = useUser();

    const { operatorScores, medianOperatorFee, nOperators } = useOperatorScores();
    const operatorScore = operatorScores.get(contract.operator_address.toLowerCase()) ?? null;

    const { data: nodeHistory } = useNodeHistory(contract.service_node_pubkey);

    const isOperator = useMemo(
      () => areEthereumAddressesEqual(contract.operator_address, activeAddress),
      [contract.operator_address, activeAddress]
    );
    const contributor = useMemo(
      () => getContributedContributor(contract, activeAddress),
      [contract, activeAddress]
    );
    const reservedContributors = useMemo(() => getReservedSlots(contract), [contract]);

    const stakeSection = (
      <StakeSection
        contract={contract}
        totalStaked={totalStaked}
        contributor={contributor}
        reservedContributors={reservedContributors}
        activeAddress={activeAddress}
        isSubmitting={isSubmitting}
        editableFields={editableFields}
      />
    );
    return (
      <div className="flex w-full flex-col gap-2" {...props} ref={ref}>
        {contributor ? stakeSection : null}
        <NodeSection
          contract={contract}
          isOperator={isOperator}
          isSubmitting={isSubmitting}
          editableFields={editableFields}
        />
        <OperatorSection
          contract={contract}
          operatorScore={operatorScore}
          medianOperatorFee={medianOperatorFee}
          nOperators={nOperators}
          isOperator={isOperator}
          isSubmitting={isSubmitting}
          editableFields={editableFields}
        />
        {nodeHistory ? (
          <NodeHistorySection history={nodeHistory} pubKey={contract.service_node_pubkey} />
        ) : null}
        {!contributor ? stakeSection : null}
        {children}
      </div>
    );
  }
);
