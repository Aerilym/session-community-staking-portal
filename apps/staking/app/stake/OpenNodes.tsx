'use client';

import {
  getContributedContributor,
  getReservedContributorNonContributed,
} from '@/app/stake/[address]/StakeInfo';
import { ErrorMessage } from '@/components/ErrorMessage';
import { NodesListSkeleton } from '@/components/NodesListModule';
import { OpenNodeCard } from '@/components/OpenNodeCard';
import { useDisplayStatusBar } from '@/components/StatusBar';
import { useOpenContributorContracts } from '@/hooks/useOpenContributorContracts';
import { useOperatorScores } from '@/hooks/useOperatorScores';
import { PREFERENCE, SOCIALS, URL } from '@/lib/constants';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import { externalLink } from '@/lib/locale-defaults';
import { getContributionRangeFromContributors } from '@/lib/maths';
import { useAllowTestingErrorToThrow } from '@/lib/testing';
import { useUser } from '@/providers/user-provider';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { ModuleGridInfoContent } from '@session/ui/components/ModuleGrid';
import { Social } from '@session/ui/components/SocialLinkList';
import { areEthereumAddressesEqual } from '@session/util-crypto/string';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { type ReactNode, useMemo } from 'react';
import { usePreferences } from 'usepref';

export default function OpenNodes() {
  useAllowTestingErrorToThrow();
  const dictionary = useTranslations('modules.openNodes');
  const { contracts, network, isFetching, refetch, isError, isLoading } =
    useOpenContributorContracts();
  useDisplayStatusBar({ network, isFetching, refetch });
  const {
    stakes: { hiddenContractsWithStakes, awaitingOperatorContracts },
    activeAddress,
  } = useUser();

  const { enabled: isStakingDisabled } = useRemoteFeatureFlagQuery(
    REMOTE_FEATURE_FLAG.DISABLE_NODE_STAKING_MULTI
  );

  const { getItem } = usePreferences();
  const showAwaitingOperator = getItem<boolean>(PREFERENCE.OPEN_NODES_SHOW_AWAITING_OPERATOR);

  const openContractBlsKeys = useMemo(() => {
    return new Set(contracts.map(({ pubkey_bls }) => pubkey_bls));
  }, [contracts]);

  const hiddenContractsToShow = useMemo(
    () =>
      hiddenContractsWithStakes.filter(({ pubkey_bls }) => !openContractBlsKeys.has(pubkey_bls)),
    [hiddenContractsWithStakes, openContractBlsKeys]
  );

  const contractsToShow = useMemo(() => {
    return contracts.filter((contract) => {
      const { minStake: minStakeCalculated, maxStake: maxStakeCalculated } =
        getContributionRangeFromContributors(contract.contributors);
      const contributor = getContributedContributor(contract, activeAddress);
      const reserved = getReservedContributorNonContributed(contract, activeAddress);

      return contributor || reserved || minStakeCalculated > 0n || maxStakeCalculated > 0n;
    });
  }, [contracts, activeAddress]);

  const displayedContracts = useMemo(
    () => [
      ...(showAwaitingOperator ? awaitingOperatorContracts : []),
      ...hiddenContractsToShow,
      ...contractsToShow,
    ],
    [showAwaitingOperator, awaitingOperatorContracts, hiddenContractsToShow, contractsToShow]
  );

  const { operatorScores, medianOperatorFee } = useOperatorScores();

  return isStakingDisabled ? (
    <StakingDisabled />
  ) : isError ? (
    <ErrorMessage
      refetch={refetch}
      message={dictionary.rich('error')}
      buttonText={dictionary('errorButton')}
      buttonDataTestId={ButtonDataTestId.Open_Nodes_Error_Retry}
    />
  ) : isLoading ? (
    <NodesListSkeleton />
  ) : hiddenContractsToShow.length ||
    contractsToShow.length ||
    (showAwaitingOperator && awaitingOperatorContracts.length) ? (
    <>
      {displayedContracts.map((contract) => (
        <OpenNodeCard
          key={contract.address}
          contract={contract}
          medianOperatorFee={medianOperatorFee}
          operatorScore={operatorScores.get(contract.operator_address.toLowerCase())}
          showAlreadyRunningWarning={hiddenContractsToShow.some(({ address }) =>
            areEthereumAddressesEqual(address, contract.address)
          )}
        />
      ))}
    </>
  ) : (
    <NoNodes />
  );
}

function NoNodes() {
  const dictionary = useTranslations('modules.openNodes');
  return (
    <ModuleGridInfoContent>
      <p>{dictionary('noNodesP1')}</p>
      <p>{dictionary.rich('noNodesP2', { link: externalLink(URL.SESSION_NODE_DOCS) })}</p>
    </ModuleGridInfoContent>
  );
}

function StakingDisabled() {
  const dictionary = useTranslations('modules.openNodes');
  return (
    <ModuleGridInfoContent>
      <p>
        {dictionary.rich('stakingDisabled', {
          link: (children: ReactNode) => (
            <Link
              className="font-medium underline"
              href={SOCIALS[Social.Discord].link}
              referrerPolicy="no-referrer"
              target="_blank"
            >
              {children}
            </Link>
          ),
        })}
      </p>
    </ModuleGridInfoContent>
  );
}
