import ActionModule from '@/components/ActionModule';
import {
  ArbitrumBlockExplorerLink,
  ArbitrumBlockExplorerLinkText,
} from '@/components/ArbitrumBlockExplorerLink';
import { NEXT_PUBLIC_BACKEND_API_URL } from '@/lib/env';
import { siteMetadata } from '@/lib/metadata';
import { createSessionStakingClient } from '@session/staking-api-js/client';
import { contributionContractResponseSchema } from '@session/staking-api-js/schema';
import { MODULE_GRID_ALIGNMENT } from '@session/ui/components/ModuleGrid';
import { LoadingText } from '@session/ui/components/loading-text';
import { isEthereumAddress } from '@session/util-crypto/keys';
import { areEthereumAddressesEqual } from '@session/util-crypto/string';
import { getTranslations } from 'next-intl/server';
import { Suspense, use } from 'react';
import { NodeStakingFormSkeleton } from './Staking';
import { StakingActionModuleTitleClient, StakingClient } from './StakingClient';

interface NodePageParams {
  params: Promise<{
    address: string;
  }>;
}

export async function generateMetadata(props: NodePageParams) {
  const dict = await getTranslations('metadata.stake');
  const { address } = await props.params;

  let title = dict('title');
  let description = dict('description');

  try {
    if (isEthereumAddress(address)) {
      const client = createSessionStakingClient({ baseUrl: NEXT_PUBLIC_BACKEND_API_URL });
      const res = await client.getContributionContracts();
      const data = contributionContractResponseSchema.parse(res.data);
      const contract = (data.contracts ?? []).find((contract) =>
        areEthereumAddressesEqual(contract.address, address)
      );
      if (contract) {
        title = `Stake to ${address}`;
        description = `Contribute SESH to the open contribution contract at ${address}, operated by ${contract.operator_address}, and earn staking rewards on the Session Network.`;
      }
    }
  } catch {
    // Metadata is best-effort; fall back to the default stake metadata.
  }

  return siteMetadata({ title, description, path: `/stake/${address}` });
}

export default function NodePage(props: NodePageParams) {
  const params = use(props.params);
  const { address } = params;

  return (
    <ActionModule
      background={3}
      title={
        <Suspense fallback={<LoadingText />}>
          <StakingActionModuleTitleClient address={address} />
        </Suspense>
      }
      contentAlignment={MODULE_GRID_ALIGNMENT.TOP}
      headerAction={
        <Suspense fallback={<ArbitrumBlockExplorerLinkText />}>
          <ArbitrumBlockExplorerLink address={address} />
        </Suspense>
      }
    >
      <Suspense fallback={<NodeStakingFormSkeleton />}>
        <StakingClient address={address} />
      </Suspense>
    </ActionModule>
  );
}
