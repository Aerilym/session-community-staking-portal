'use client';

import {
  ButtonModule,
  type ButtonModuleProps,
  ModuleContent,
  ModuleText,
} from '@session/ui/components/Module';
import { HandCoinsIcon } from '@session/ui/icons/HandCoinsIcon';
import { cn } from '@session/ui/lib/utils';
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from '@session/ui/ui/alert-dialog';
import type { ReactNode } from 'react';

export type ModuleButtonDialogTriggerProps = ButtonModuleProps & {
  label?: string;
  dialogTitle?: string;
  textClassName?: string;
  IconComp?: typeof HandCoinsIcon;
  /** True to colour the icon via stroke (lucide style icons), false to colour via fill. Defaults true for the stroke based default icon. */
  iconStrokeForFill?: boolean;
  dialogContent?: ReactNode;
  /** Classes applied to the positioned dialog container, e.g. to override the default centering. */
  dialogContainerClassName?: string;
  /** Optional action rendered at the start of the dialog header row. */
  dialogHeaderAction?: ReactNode;
};

export default function ModuleButtonDialogTrigger({
  label,
  dialogTitle,
  textClassName,
  IconComp,
  iconStrokeForFill,
  disabled,
  dialogContent,
  dialogContainerClassName,
  dialogHeaderAction,
  size,
  'data-testid': dataTestId,
  children,
}: ModuleButtonDialogTriggerProps) {
  const Icon = IconComp ?? HandCoinsIcon;
  // NOTE: the default icon is stroke based, colour it via stroke unless an
  // explicit icon chooses fill
  const useStrokeClasses = IconComp === undefined ? true : !!iconStrokeForFill;
  const iconFillClassName = disabled
    ? useStrokeClasses
      ? 'stroke-session-text'
      : 'fill-session-text'
    : useStrokeClasses
      ? 'stroke-session-green group-hover:stroke-session-black'
      : 'fill-session-green group-hover:fill-session-black';
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <ButtonModule
          data-testid={dataTestId}
          className={cn(
            'group items-center transition-all duration-300 motion-reduce:transition-none',
            size === 'lg' ? 'col-span-2' : ''
          )}
          disabled={disabled}
        >
          <ModuleContent className="flex h-full select-none flex-row items-center gap-2 p-0 align-middle font-medium">
            <ModuleText
              className={cn(
                'inline-flex items-center gap-1.5 py-3 align-middle transition-all duration-300 motion-reduce:transition-none',
                disabled
                  ? 'opacity-50'
                  : 'text-session-green transition-all duration-300 group-hover:text-session-black motion-reduce:transition-none'
              )}
            >
              <Icon
                className={cn(
                  'mb-1 h-7 w-7 transition-all duration-300 motion-reduce:transition-none',
                  disabled && 'opacity-50',
                  iconFillClassName
                )}
              />
              <span className={cn('whitespace-normal text-2xl', textClassName)}>{label}</span>
            </ModuleText>
          </ModuleContent>
          {children}
        </ButtonModule>
      </AlertDialogTrigger>
      <AlertDialogContent
        dialogTitle={dialogTitle}
        containerClassName={dialogContainerClassName}
        headerAction={dialogHeaderAction}
      >
        {dialogContent}
      </AlertDialogContent>
    </AlertDialog>
  );
}
