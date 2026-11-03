import { NodeCard } from '@/components/NodeCard';
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
