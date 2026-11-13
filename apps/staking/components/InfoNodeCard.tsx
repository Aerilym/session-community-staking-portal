'use client';

import { NodeCard, RowLabel } from '@/components/NodeCard';
import type { ButtonDataTestId } from '@/testing/data-test-ids';
import { TextSeparator } from '@session/ui/components/Separator';
import {
  StatusIndicator,
  type StatusIndicatorVariants,
} from '@session/ui/components/StatusIndicator';
import { cn } from '@session/ui/lib/utils';
import { Button, type ButtonProps, ButtonSkeleton } from '@session/ui/ui/button';
import { Skeleton } from '@session/ui/ui/skeleton';
import type { Ed25519PublicKey } from '@session/util-crypto/keys';
import Link from 'next/link';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { StakeCardSnKey } from './StakedNode/Info/StakeCardSnKey';

export type InfoNodeCardProps = HTMLAttributes<HTMLDivElement> & {
  pubKey: Ed25519PublicKey;
  buttonSiblings?: ReactNode;
  isActive?: boolean;
  isOperator?: boolean;
  forceSmall?: boolean;
  button?: {
    text: string;
    link: string;
    dataTestId: ButtonDataTestId;
    ariaLabel: string;
    size?: ButtonProps['size'];
  };
  warnings?: ReactNode;
  headerSiblings?: ReactNode;
  statusIndicatorColour?: StatusIndicatorVariants['status'];
};

export const InfoNodeCard = forwardRef<HTMLDivElement, InfoNodeCardProps>(
  (
    {
      statusIndicatorColour,
      buttonSiblings,
      headerSiblings,
      isActive,
      isOperator,
      className,
      forceSmall,
      pubKey,
      button,
      warnings,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <NodeCard
        ref={ref}
        {...props}
        className={cn(
          'justify-between gap-2 border border-transparent min-[550px]:flex-nowrap',
          forceSmall ? '' : 'md:gap-2',
          isActive && 'border-session-green',
          className
        )}
      >
        <div className="flex flex-row">
          {warnings ? (
            <div className="me-2 flex w-max flex-row items-center gap-2 align-middle">
              {warnings}
            </div>
          ) : null}
          <div className={cn('inline-flex flex-row flex-wrap', className)}>
            <div
              className={cn(
                'inline-flex flex-wrap items-baseline gap-x-1 align-middle md:gap-x-1.5',
                forceSmall ? 'text-xs md:text-xs' : 'text-sm md:text-base'
              )}
            >
              <div className="flex items-center gap-1">
                {statusIndicatorColour ? (
                  <StatusIndicator className="h-2.5 w-2.5" status={statusIndicatorColour} />
                ) : null}
                <StakeCardSnKey
                  key="snKey"
                  pubkey={pubKey}
                  tooltipSide={'top'}
                  isOperator={isOperator}
                  className="me-0"
                />
              </div>
              {headerSiblings}
            </div>
            <div
              className={cn(
                'inline-flex flex-wrap gap-x-2 text-center align-middle font-normal sm:text-start md:flex-row',
                forceSmall ? 'text-xs md:text-xs' : 'text-sm md:text-base'
              )}
            >
              {children}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-row items-center gap-2 align-middle min-[550px]:w-auto">
          {buttonSiblings}
          {button ? (
            <Link href={button.link} prefetch className="w-full min-[550px]:w-auto">
              <Button
                variant={isActive ? 'default' : 'outline'}
                size={button.size ? button.size : forceSmall ? 'sm' : 'md'}
                rounded="md"
                aria-label={button.ariaLabel}
                data-testid={button.dataTestId}
                className="w-full min-[550px]:w-auto"
              >
                {button.text}
              </Button>
            </Link>
          ) : null}
        </div>
      </NodeCard>
    );
  }
);

export function InfoNodeCardSkeleton() {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-3 rounded-xl border-2 border-muted p-6">
      <div className="-bottom-1/2 flex w-full flex-col gap-3">
        <div className="flex w-full items-center gap-3 align-middle">
          <div className="-mr-2 scale-75 p-0 sm:mr-0 md:scale-100 md:p-0.5">
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="inline-flex gap-2">
            <Skeleton className="h-6 w-40 sm:w-60" />
          </div>
        </div>
        <Skeleton className="h-4 w-9/12" />
      </div>
      <ButtonSkeleton variant="outline" rounded="md" className="h-8 w-16" />
    </div>
  );
}

export const NodeItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={className}>{children}</span>
);

export const NodeItemSeparator = ({ className }: { className?: string }) => (
  <TextSeparator className={className} />
);

export const NodeItemLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <span className={cn('font-normal', className)}> {children}</span>;

export const NodeItemValue = ({ children }: { children: ReactNode }) => (
  <span className="text-nowrap font-semibold"> {children}</span>
);

export type NodeInfoCardTextProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export function NodeInfoCardText({ label, className, children }: NodeInfoCardTextProps) {
  return (
    <NodeItem
      className={cn(
        'inline-flex flex-wrap xs:flex-nowrap gap-1 whitespace-nowrap text-gradient-white',
        className
      )}
    >
      <RowLabel>{label}</RowLabel>
      {children}
    </NodeItem>
  );
}
