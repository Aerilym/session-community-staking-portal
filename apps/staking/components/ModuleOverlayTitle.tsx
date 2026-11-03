import { ModuleTitleDynamic } from '@session/ui/components/Module';

/**
 * A module title overlaid on the top outline of the card. The title band of
 * the module gradient is held flat at --session-black (see the module gradient
 * definition), so a static background interrupts the outline seamlessly
 * against both the page above and the card below.
 */
export function ModuleOverlayTitle({
  longText,
  shortText,
}: {
  longText: string;
  shortText?: string;
}) {
  return (
    <ModuleTitleDynamic
      className="-translate-y-1/2 overflow-none absolute start-3 top-0 z-1 rounded-2xl border-module px-1 font-normal text-base"
      longText={longText}
      shortText={shortText}
      // NOTE: the split lands on the outline, the bottom colour must be kept in
      // sync with --session-module-gradient
      style={{
        backgroundImage: 'linear-gradient(to bottom, var(--session-black) 50%, #090e0e 50%)',
      }}
    />
  );
}
