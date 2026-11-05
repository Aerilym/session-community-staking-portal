'use client';

import { type DecimalDelimiter, useDecimalDelimiter } from '@/lib/locale-client';
import type { ButtonDataTestId, InputDataTestId } from '@/testing/data-test-ids';
import { SENT_DECIMALS, SENT_SYMBOL } from '@session/contracts';
import { XIcon } from '@session/ui/icons/XIcon';
import { Button } from '@session/ui/ui/button';
import { Input } from '@session/ui/ui/input';
import { bigIntToString, stringToBigInt } from '@session/util-crypto/maths';
import { useTranslations } from 'next-intl';

const leadingZerosRegex = /^0+(?=\d)/;
const numericAndDelimitersRegex = /[^0-9.,]/g;

export type ClaimAmountFieldProps = {
  dataTestId: InputDataTestId;
  dataTestIds: {
    buttonMax: ButtonDataTestId;
    buttonCancel: ButtonDataTestId;
  };
  disabled?: boolean;
  /** The raw user-entered value, null represents the untouched default of the full claimable amount. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The maximum claimable amount in atomic units. */
  maxClaim: bigint;
};

/**
 * Sanitizes user input for a SESH claim amount, clamping to the claimable
 * maximum — mirrors the sanitization of the stake amount field.
 */
function formatClaimAmountText(value: string, maxClaim: bigint, decimalDelimiter: string) {
  if (value === '0') return '0';

  const thousandsSeparator = decimalDelimiter === '.' ? ',' : '.';

  let formattedValue = value.replace(numericAndDelimitersRegex, '');

  if (formattedValue.includes(thousandsSeparator)) {
    formattedValue = formattedValue.replaceAll(thousandsSeparator, '');
  }

  if (formattedValue.startsWith('0') && !formattedValue.startsWith('0.')) {
    formattedValue = formattedValue.replace(leadingZerosRegex, '');
  }

  if (formattedValue.includes(decimalDelimiter)) {
    const [first, ...rest] = formattedValue.split(decimalDelimiter);
    const decimalValue = rest.join('').slice(0, SENT_DECIMALS);
    formattedValue = `${first}${decimalDelimiter}${decimalValue}`;
  }

  if (stringToBigInt(formattedValue, SENT_DECIMALS, decimalDelimiter) > maxClaim) {
    return bigIntToString(maxClaim, SENT_DECIMALS, decimalDelimiter);
  }

  return formattedValue;
}

/**
 * Custom claim amount selector for advanced mode. Users are assumed to claim
 * the full amount otherwise — the reset button restores that default. The
 * balance update always applies the full network-signed amount regardless of
 * the amount claimed here.
 */
export function ClaimAmountField({
  dataTestId,
  dataTestIds,
  disabled,
  value,
  onChange,
  maxClaim,
}: ClaimAmountFieldProps) {
  const dictionary = useTranslations('modules.claim.dialog');
  const decimalDelimiter: DecimalDelimiter = useDecimalDelimiter();

  const maxClaimString = bigIntToString(maxClaim, SENT_DECIMALS, decimalDelimiter);
  const format = (v: string) => formatClaimAmountText(v, maxClaim, decimalDelimiter);

  return (
    <div className="flex w-full items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          placeholder={maxClaimString}
          disabled={disabled}
          className="pr-14"
          value={value ?? maxClaimString}
          inputMode="decimal"
          data-testid={dataTestId}
          onChange={(e) => onChange(format(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(format(e.clipboardData.getData('text/plain')));
          }}
        />
        <span className="-translate-y-1/2 pointer-events-none absolute end-3 top-1/2 text-session-text text-xs opacity-70">
          {SENT_SYMBOL}
        </span>
      </div>
      <Button
        size="xs"
        rounded="lg"
        variant="ghost"
        type="button"
        className="px-2"
        disabled={disabled}
        data-testid={dataTestIds.buttonMax}
        onClick={() => onChange(maxClaimString)}
      >
        {dictionary('claimAmountMax')}
      </Button>
      <Button
        size="xs"
        rounded="lg"
        variant="ghost"
        type="button"
        className="px-2"
        disabled={disabled}
        data-testid={dataTestIds.buttonCancel}
        aria-label={dictionary('claimAmountCancel')}
        onClick={() => onChange(null)}
      >
        <XIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
