import { formatUsd, seshAtomicToUsd } from '@session/contracts';
import { cn } from '@session/ui/lib/utils';

/**
 * A muted USD amount, e.g. $10.23 or ($10.23), for display with token amounts.
 * Parentheses are included by default; pass `parenthesis={false}` to omit them.
 * Optionally sized relative to the surrounding font (e.g. text-[0.55em]) so it
 * scales with clamp() sized container text.
 */
export function FiatUsd({
  usd,
  className,
  parenthesis = true,
}: {
  usd: number | null;
  className?: string;
  parenthesis?: boolean;
}) {
  if (usd === null) return null;
  const formatted = `$${formatUsd(usd)}`;
  return (
    <span className={`text-muted-foreground ${className ?? ''}`}>
      {parenthesis ? `(${formatted})` : formatted}
    </span>
  );
}

/**
 * A SESH amount with its muted USD value in parentheses, e.g. 1234 SESH ($24.68).
 * The USD suffix is smaller than the amount so container (cqi) sized module text still fits.
 * The USD value is hidden when no price is available.
 */
export function SeshAmountWithUsd({
  amount,
  formatted,
  price,
  className,
}: {
  amount: bigint | null;
  formatted: string;
  price?: number | null;
  className?: string;
}) {
  const usd = amount === null ? null : seshAtomicToUsd(amount, price ?? null);
  return (
    <span
      className={cn(
        'inline-flex flex-col items-baseline gap-0 text-nowrap align-middle',
        className
      )}
    >
      {formatted}
      <FiatUsd usd={usd} className="md:test-base text-base" />
    </span>
  );
}
