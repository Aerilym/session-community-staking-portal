import { NodeCard } from '@/components/NodeCard';
import { ButtonSkeleton } from '@session/ui/ui/button';
import { Skeleton } from '@session/ui/ui/skeleton';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import type { Address } from 'viem';

type StakeCardProps = HTMLAttributes<HTMLDivElement> & {
  toggleId: string;
  'data-testid': string;
  operatorAddress?: Address;
  isDetailedView?: boolean;
};

const StakeCard = forwardRef<HTMLDivElement, StakeCardProps>(
  ({ className, toggleId, operatorAddress, isDetailedView, children, ...props }, ref) => {
    return (
      <NodeCard ref={ref} {...props} className={className} data-testid={props['data-testid']}>
        {!isDetailedView ? (
          <input id={toggleId} type="checkbox" className="peer hidden appearance-none" />
        ) : null}
        {children}
      </NodeCard>
    );
  }
);
StakeCard.displayName = 'StakeCard';

export function StakeCardSkeleton() {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-3 rounded-lg border-2 border-muted p-3.5">
      <div className="-bottom-1/2 flex w-full flex-row gap-3">
        <div className="flex items-center gap-3 align-middle">
          <div className="-mr-2 scale-75 p-0 sm:mr-0 md:scale-100 md:p-0.5">
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-9/12" />
      </div>
      <ButtonSkeleton variant="outline" rounded="md" className="h-6 w-16" />
    </div>
  );
}

export type OrderableComponents =
  | 'status'
  | 'contributors'
  | 'notification'
  | 'snKey'
  | 'version'
  | 'unlockTimer'
  | 'updateSmall'
  | 'rewardTimer'
  | 'uptimeTimer'
  | 'operatorAddress'
  | 'beneficiaryAddress'
  | 'stake'
  | 'fee'
  | 'actionButton'
  | 'expandButton';

export enum VIEW_MODE {
  SIMPLE = 0,
  DETAILED = 1,
}

export const getOrderingForMode = (mode: VIEW_MODE): Array<OrderableComponents> => {
  switch (mode) {
    case VIEW_MODE.DETAILED:
      return [
        'status',
        'snKey',
        'stake',
        'fee',
        'beneficiaryAddress',
        'operatorAddress',
        'version',
        'unlockTimer',
        'updateSmall',
        'rewardTimer',
        'uptimeTimer',
        'contributors',
        'notification',
        'actionButton',
      ];
    default:
      return [
        'status',
        'snKey',
        'contributors',
        'notification',
        'expandButton',
        'unlockTimer',
        'updateSmall',
        'rewardTimer',
        'uptimeTimer',
        'version',
        'beneficiaryAddress',
        'stake',
        'operatorAddress',
        'fee',
        'actionButton',
      ];
  }
};

export type ComponentData = {
  id: OrderableComponents;
  component: ReactNode;
};

export const renderOrderedComponents = (
  isDetailedView: boolean,
  componentData: Array<ComponentData>
) => {
  const ordering = getOrderingForMode(isDetailedView ? VIEW_MODE.DETAILED : VIEW_MODE.SIMPLE);
  return ordering.map((id) => {
    const item = componentData.find((comp) => comp.id === id);
    if (item) {
      return item.component;
    }
    return null;
  });
};

export { StakeCard };
