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
import TotalRewardsModule from './modules/TotalRewardsModule';

export async function generateMetadata() {
  const dict = await getTranslations('metadata.myStakes');
  return siteMetadata({
    title: dict('title'),
    description: dict('description'),
  });
}

export default function Page() {
  return (
    <ModuleGrid size="lg" className="h-full px-4 md:px-6 xl:auto-rows-auto">
      <div className="col-span-1 flex h-full flex-col gap-4 md:max-h-screen-without-header md:overflow-y-auto md:overflow-x-hidden">
        <KeyInfoModule />
        <ModuleGrid>
          <UnclaimedStakesModule />
          <UnclaimedRewardsModule />
          <ClaimTokensModule />
        </ModuleGrid>
        <ModuleGrid>
          <UnlockingStakesModule />
          <TotalRewardsModule />
          <SeshPriceModule />
        </ModuleGrid>
        <ModuleGrid>
          <ExplorerModule />
        </ModuleGrid>
      </div>
      <div className="col-span-2 mt-14 h-full pb-8 md:mt-0 md:max-h-screen-without-header">
        <ModuleGrid variant="section" colSpan={2} className="h-full">
          <ErrorBoundary errorComponent={ErrorBox}>
            <StakedNodesModule />
          </ErrorBoundary>
        </ModuleGrid>
      </div>
    </ModuleGrid>
  );
}
