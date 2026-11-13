import OpenNodesModule from '@/app/stake/OpenNodesModule';
import ScreenContainer from '@/components/ScreenContainer';
import { QUERY } from '@/lib/constants';
import { operatorScoresServerPrefetch } from '@/lib/queries/getOperatorScores';
import { createQueryClient } from '@/lib/query';
import { ModuleGrid } from '@session/ui/components/ModuleGrid';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export default async function Layout({ children }: { children: ReactNode }) {
  const queryClient = createQueryClient();

  // Prefetch the operator scores dataset so hydrated data renders without a
  // client fetch. prefetchQuery never throws, so upstream failures degrade to
  // a client-side fetch instead of blocking the page.
  await queryClient.prefetchQuery({
    ...operatorScoresServerPrefetch,
    staleTime: QUERY.STALE_TIME_OPERATOR_SCORES,
  });

  return (
    <ScreenContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ModuleGrid size="lg" className="h-full px-4 pt-2 lg:auto-rows-auto lg:px-6">
          <div className="col-span-1 h-full pb-8 lg:mt-0 lg:max-h-screen-without-header">
            {children}
          </div>
          <div className="col-span-2 mt-12 flex h-full flex-col gap-14 pb-8 md:mt-0 lg:max-h-screen-without-header lg:gap-6">
            <OpenNodesModule />
          </div>
        </ModuleGrid>
      </HydrationBoundary>
    </ScreenContainer>
  );
}
