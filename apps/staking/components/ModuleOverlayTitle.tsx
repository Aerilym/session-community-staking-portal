import { ModuleTitleDynamic } from '@session/ui/components/Module';
import type { ReactNode } from 'react';

/**
 * A module title overlaid on the top outline of the card. The title band of
 * the module gradient is held flat at --session-black (see the module gradient
 * definition), so a static background interrupts the outline seamlessly
 * against both the page above and the card below.
 */
export function ModuleOverlayTitle({
  longText,
  shortText,
  children,
}: {
  longText: string;
  shortText?: string;
  children?: ReactNode;
}) {
  return (
    <ModuleTitleDynamic
      className="-translate-y-1/2 absolute start-3 top-0 z-1 inline-flex items-center gap-1 px-1"
      longText={longText}
      shortText={shortText}
      // NOTE: the split lands on the outline, the bottom colour must be kept in
      // sync with --session-module-gradient
      style={{
        backgroundImage: 'linear-gradient(to bottom, var(--session-black) 50%, #090e0e 50%)',
      }}
    >
      {children}
    </ModuleTitleDynamic>
  );
}
