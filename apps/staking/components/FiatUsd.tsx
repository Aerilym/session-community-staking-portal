import { formatUsd, seshAtomicToUsd } from '@session/contracts';

/**
 * A muted USD amount in parentheses, e.g. ($10.23), for display after token amounts.
 * Optionally sized relative to the surrounding font (e.g. text-[0.55em]) so it
 * scales with clamp() sized container text.
 */
export function FiatUsd({ usd, className }: { usd: number | null; className?: string }) {
  if (usd === null) return null;
  return <span className={`text-muted-foreground ${className ?? ''}`}>(${formatUsd(usd)})</span>;
}

/**
 * A SESH amount with its muted USD value in parentheses, e.g. 1234 SESH ($24.68).
 * The USD suffix is smaller than the amount so container (cqi) sized module text still fits.
 */
export function SeshAmountWithUsd({
  amount,
  formatted,
}: {
  amount: bigint | null;
  formatted: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-nowrap align-middle">
      {formatted}
      <FiatUsd usd={amount === null ? null : seshAtomicToUsd(amount)} className="text-[0.55em]" />
    </span>
  );
}
