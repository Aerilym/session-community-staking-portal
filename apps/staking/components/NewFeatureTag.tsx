import { SparklesIcon } from '@session/ui/icons/SparklesIcon';
import { cn } from '@session/ui/lib/utils';

export function NewFeatureTag({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex flex-col items-center text-session-green text-xs transition-all duration-300 group-hover:text-session-black',
        className
      )}
    >
      <div className="inline-flex items-center">
        <SparklesIcon className="h-4 w-4" />
        <span className="px-1">New Feature</span>
        <SparklesIcon className="h-4 w-4" />
      </div>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}
