import { isBLSPublicKey, isEd25519PublicKey, isEthereumAddress } from '@session/util-crypto/keys';
import { ScanSearchIcon, SearchCode, SearchCodeIcon } from 'lucide-react';
import { type AnchorHTMLAttributes, forwardRef } from 'react';
import { type BaseDataTestId, ButtonDataTestId, type TestingProps } from '../data-test-ids';
import { LinkOutIcon } from '../icons/LinkOutIcon';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

const NEXT_PUBLIC_SESH_TOKEN_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SESH_TOKEN_EXPLORER_URL ?? 'https://seshtoken.info';

/**
 * Determines the explorer path for a value based on its format:
 * an Ethereum address links to its address page, an Ed25519 or BLS
 * public key links to its node page, and anything else falls back to
 * an explorer search for the value.
 *
 * @param value The value to resolve (e.g. a node public key or wallet address).
 */
export function resolveExplorerPath(value: string) {
  if (isEthereumAddress(value)) {
    return `/address/${encodeURIComponent(value)}`;
  }
  if (isEd25519PublicKey(value) || isBLSPublicKey(value)) {
    return `/node/${encodeURIComponent(value)}`;
  }
  return `/search?q=${encodeURIComponent(value)}`;
}

/**
 * Resolves the SESH token explorer URL for a given value.
 *
 * @param value The value to resolve (e.g. a node public key or wallet address).
 * @param explorerBaseUrl The base URL of the explorer. Defaults to the SESH token explorer.
 */
export function resolveExplorerUrl(
  value: string,
  explorerBaseUrl: string = NEXT_PUBLIC_SESH_TOKEN_EXPLORER_URL
) {
  return `${explorerBaseUrl}${resolveExplorerPath(value)}`;
}

export interface OpenInExplorerButtonProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'type' | 'href' | 'target' | 'rel'>,
    Omit<TestingProps<BaseDataTestId.Button>, 'data-testid'> {
  /** The value to open in the explorer (e.g. a node public key or wallet address). */
  value: string;
  /** The base URL of the explorer. Defaults to the SESH token explorer. */
  explorerBaseUrl?: string;
  /** The data test id applied to the button. */
  testId?: ButtonDataTestId;
}

/**
 * Opens the given value in the SESH token explorer in a new tab. The explorer
 * page is determined by the format of the value (address, node key or search).
 */
const OpenInExplorerButton = forwardRef<HTMLAnchorElement, OpenInExplorerButtonProps>(
  (
    { value, explorerBaseUrl, testId = ButtonDataTestId.Open_In_Explorer, className, ...props },
    ref
  ) => {
    const href = resolveExplorerUrl(value, explorerBaseUrl);

    return (
      <Button
        asChild
        variant="ghost"
        rounded="md"
        size="collapse"
        className={cn('p-0', className)}
        data-testid={testId}
      >
        <a
          {...props}
          ref={ref}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={props['aria-label'] ?? 'Open in explorer'}
        >
          <ScanSearchIcon className="h-5 w-5 text-muted-foreground" />
        </a>
      </Button>
    );
  }
);
OpenInExplorerButton.displayName = 'OpenInExplorerButton';

export { OpenInExplorerButton };
