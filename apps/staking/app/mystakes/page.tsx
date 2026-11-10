import ExplorerModule from '@/app/mystakes/modules/ExplorerModule';
import KeyInfoModule from '@/app/mystakes/modules/KeyInfoModule';
import SeshPriceModule from '@/app/mystakes/modules/SeshPriceModule';
import StakedNodesModule from '@/app/mystakes/modules/StakedNodesModule';
import UnclaimedRewardsModule from '@/app/mystakes/modules/UnclaimedRewardsModule';
import UnclaimedStakesModule from '@/app/mystakes/modules/UnclaimedStakesModule';
import UnlockingStakesModule from '@/app/mystakes/modules/UnlockingStakesModule';
import { ErrorBox } from '@/components/Error/ErrorBox';
import { siteMetadata } from '@/lib/metadata';
import { ModuleGrid } from '@session/ui/components/ModuleGrid';
import { getTranslations } from 'next-intl/server';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import ClaimTokensModule from './modules/ClaimTokensModule';
import OperatorScoreModule from './modules/OperatorScoreModule';
import TotalRewardsModule from './modules/TotalRewardsModule';
import WalletBalanceModule from './modules/WalletBalanceModule';

export async function generateMetadata() {
  const dict = await getTranslations('metadata.myStakes');
  return siteMetadata({
    title: dict('title'),
    description: dict('description'),
  });
}

export default function Page() {
  return (
    <ModuleGrid size="lg" className="h-full px-4 md:px-6 lg:auto-rows-auto">
      <div className="col-span-1 flex h-full flex-col gap-3 pt-2 lg:max-h-screen-without-header lg:overflow-y-auto lg:overflow-x-hidden">
        <KeyInfoModule />
        <ModuleGrid>
          <UnclaimedStakesModule />
          <UnclaimedRewardsModule />
          <ClaimTokensModule />
        </ModuleGrid>
        <ModuleGrid>
          <WalletBalanceModule />
        </ModuleGrid>
        <ModuleGrid>
          <UnlockingStakesModule />
          <TotalRewardsModule />
          <SeshPriceModule />
          <OperatorScoreModule />
        </ModuleGrid>
        <ModuleGrid>
          <ExplorerModule />
        </ModuleGrid>
      </div>
      <div className="col-span-2 mt-14 h-full pt-2 pb-8 lg:mt-0 lg:max-h-screen-without-header">
        <ModuleGrid variant="section" colSpan={2} className="h-full">
          <ErrorBoundary errorComponent={ErrorBox}>
            <StakedNodesModule />
          </ErrorBoundary>
        </ModuleGrid>
      </div>
    </ModuleGrid>
  );
}
