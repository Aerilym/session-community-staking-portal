'use client';

import { useWallet } from '@session/wallet/hooks/useWallet';
import { useCallback, useMemo } from 'react';
import { numberToHex } from 'viem';
import { useCallsStatus, useSendCalls } from 'wagmi/experimental';
import { getCapabilitiesQueryOptions, useQuery } from 'wagmi/query';
import type { BatchCall } from '../fees';

export type BatchCallStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export type BatchReceipt = {
  status: 'success' | 'reverted';
  transactionHash: string | null;
};

export type SendCallsBatchProps = {
  /** The status of the batch. */
  status: BatchCallStatus;
  /** True whilst the wallet request is awaiting the user or submitting. */
  isAwaitingWallet: boolean;
  /** Send a batch of calls to the wallet via EIP-5792 `wallet_sendCalls`. */
  sendBatch: (calls: Array<BatchCall>) => void;
  /** Per-call receipts once the batch has confirmed, ordered as the calls were. */
  receipts: Array<BatchReceipt> | null;
  /** The error from sending or tracking the batch, if any. */
  error: Error | null;
  /** True when the wallet cannot execute EIP-5792 batches for this account (unsupported or batch execution failed, e.g. a rejected EIP-7702 account upgrade). */
  isUnsupported: boolean;
  /** Reset the batch state. */
  resetBatch: () => void;
};

/**
 * Executes a batch of calls as a single EIP-5792 `wallet_sendCalls` request.
 * The wallet executes the calls atomically (smart accounts) or sequentially
 * (EOA wallets) behind a single user approval.
 *
 * @param chainIdOverride - The chain to execute the batch on, defaults to the connected chain.
 * @returns The send calls batch hook. @see {@link SendCallsBatchProps}
 */
export function useSendCallsBatch(chainIdOverride?: number): SendCallsBatchProps {
  const { config, chainId } = useWallet();

  const {
    sendCalls,
    isPending: isAwaitingWallet,
    isError: isSendError,
    error: sendError,
    reset: resetSendCalls,
    data: sendResult,
  } = useSendCalls({ config });

  // NOTE: viem >= 2.57 returns `{ id }` from wallet_sendCalls (which may also
  // be the plain string id on wallets still on EIP-5792 version 1.0)
  const id = typeof sendResult === 'string' ? sendResult : sendResult?.id;

  const { data: callsStatus, error: statusError } = useCallsStatus({
    config,
    id: id ?? '',
    query: {
      // NOTE: the id must be a non-empty hex string per EIP-5792
      enabled: !!id,
      refetchInterval: (query) => (query.state.data?.status === 'success' ? false : 4_000),
    },
  });

  const sendBatch = useCallback(
    (calls: Array<BatchCall>) => {
      resetSendCalls();
      sendCalls({ chainId: chainIdOverride ?? chainId, calls });
    },
    [chainId, chainIdOverride, resetSendCalls, sendCalls]
  );

  const resetBatch = useCallback(() => {
    resetSendCalls();
  }, [resetSendCalls]);

  const isUnsupported = useMemo(
    () => isSendError && isUnsupportedMethodError(sendError),
    [isSendError, sendError]
  );

  // NOTE: viem >= 2.57 normalises the batch status to 'pending' | 'success' |
  // 'failure' (with receipts attached on success/failure)
  const receipts = useMemo<Array<BatchReceipt> | null>(() => {
    if (!callsStatus?.receipts) return null;
    return callsStatus.receipts.map((receipt) => ({
      status: receipt.status,
      transactionHash: receipt.transactionHash ?? null,
    }));
  }, [callsStatus]);

  const status = useMemo<BatchCallStatus>(() => {
    if (isSendError) return 'failed';
    if (!id) return 'idle';
    if (callsStatus?.status === 'success') {
      if (receipts?.some((receipt) => receipt.status === 'reverted')) {
        return 'failed';
      }
      return 'confirmed';
    }
    if (callsStatus?.status === 'failure') {
      return 'failed';
    }
    return 'pending';
  }, [callsStatus, id, isSendError, receipts]);
  const error = useMemo<Error | null>(() => {
    if (sendError) return sendError;
    if (statusError) return statusError;
    return null;
  }, [sendError, statusError]);

  return {
    status,
    isAwaitingWallet,
    sendBatch,
    receipts,
    error,
    isUnsupported,
    resetBatch,
  };
}

export type SendCallsCompatibility = {
  /**
   * True when the wallet explicitly supports the EIP-5792 Wallet Call API on
   * the connected chain (capabilities response includes the chain), false
   * when the wallet explicitly does not (unsupported-method error, or a
   * successful response omitting the connected chain — e.g. MetaMask with
   * hardware accounts that cannot sign EIP-7702 authorizations). Null while
   * the wallet has not answered `wallet_getCapabilities` — treat null as
   * "attempt the batch and fall back on failure".
   */
  isSupported: boolean | null;
  /** True when the wallet reports atomic batch execution on the connected chain, false when not, null when unknown. */
  isAtomic: boolean | null;
};

/**
 * Pre-checks EIP-5792 support via `wallet_getCapabilities` so consumers can
 * pick the right flow upfront instead of discovering support by failing.
 *
 * Per EIP-5792, a wallet that errors with an unsupported-method response does
 * not support the Wallet Call API at all; a successful response that omits the
 * connected chain is likewise a negative (MetaMask omits the chain for
 * accounts that cannot sign EIP-7702 authorizations, e.g. hardware accounts,
 * and only supports atomic — never sequential — batches). A response including
 * the chain implies `wallet_sendCalls` support (atomic or sequential). The
 * atomic flag is informational — sequential execution is still a single user
 * approval.
 *
 * @returns The send calls compatibility. @see {@link SendCallsCompatibility}
 */
export function useSendCallsCompatibility(): SendCallsCompatibility {
  const { config, address, chainId } = useWallet();

  // NOTE: provider-less query — this app does not render a WagmiProvider, so
  // the config is passed explicitly instead of using wagmi's context-based
  // useCapabilities hook
  const { data, error, isLoading } = useQuery({
    ...getCapabilitiesQueryOptions(config, { account: address }),
    enabled: !!address,
  });

  return useMemo(() => {
    if (!address || !chainId || isLoading) return { isSupported: null, isAtomic: null };
    if (error) {
      return {
        isSupported: isUnsupportedMethodError(error) ? false : null,
        isAtomic: null,
      };
    }
    if (!data) return { isSupported: null, isAtomic: null };

    // NOTE: wallets key capabilities by hex chain id per EIP-5792, but guard
    // against number-keyed or stringified responses
    const capabilities = data as Record<string, { atomic?: { status?: string } } | undefined>;
    const entry =
      capabilities[numberToHex(chainId)] ?? capabilities[chainId] ?? capabilities[String(chainId)];
    if (!entry) {
      // The wallet answered but omitted the connected chain — an explicit
      // negative per EIP-5792. Notably MetaMask omits the chain entry when
      // atomic batching is not supported for the account (e.g. hardware
      // accounts that cannot sign EIP-7702 authorizations), so start in
      // legacy mode instead of failing at send time
      return { isSupported: false, isAtomic: null };
    }

    return {
      isSupported: true,
      isAtomic:
        entry.atomic === undefined
          ? null
          : entry.atomic.status === 'supported' || entry.atomic.status === 'ready',
    };
  }, [address, chainId, data, error, isLoading]);
}

/**
 * Detects whether an error means the wallet cannot execute an EIP-5792 batch
 * for this account, so the caller can fall back to sequential transactions:
 * - The wallet not supporting EIP-5792 at all, variously surfaced as JSON-RPC
 *   error -32601 (method not found), 4902 (unsupported method) or a viem
 *   error name.
 * - The wallet failing to execute the batch atomically, e.g. MetaMask
 *   upgrading the EOA via EIP-7702 for `wallet_sendCalls` version 2 batches
 *   and the account or chain refusing the upgrade
 *   ("EIP-7702 upgrade not supported on account").
 */
const EIP_7702_REGEX = /eip-?7702/i;

function isUnsupportedMethodError(error: unknown): boolean {
  let current: unknown = error;
  while (current) {
    const { code, name, message, shortMessage, details, cause } = current as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    if (code === -32601 || code === 4902) return true;
    if (
      typeof name === 'string' &&
      (name.includes('UnsupportedMethod') || name.includes('MethodNotSupported'))
    ) {
      return true;
    }
    const text = [message, shortMessage, details]
      .filter((part): part is string => typeof part === 'string')
      .join(' ');
    if (EIP_7702_REGEX.test(text)) return true;
    current = cause;
  }
  return false;
}
