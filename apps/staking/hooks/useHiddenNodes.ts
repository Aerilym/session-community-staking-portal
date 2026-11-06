import { PREFERENCE } from '@/lib/constants';
import {
  getHiddenNodeIdsForAddress,
  parseHiddenNodeIdsByAddress,
  toggleHiddenNodeIdForAddress,
} from '@/lib/hiddenNodes';
import type { EthereumAddress } from '@session/util-crypto/keys';
import { useCallback, useMemo, useState } from 'react';
import { usePref } from 'usepref';

/**
 * Hook to manage the list of hidden nodes for a single wallet address, keyed by
 * the node's contract_id in the main staking contract. The contract_id is
 * unique per generation: when a node is deregistered and re-registered it
 * receives a new contract_id. Hidden nodes are stored per address, so
 * switching wallets does not hide the node in the other wallet.
 */
export function useHiddenNodes(address?: EthereumAddress) {
  const { getItem, setItem } = usePref();

  const [hiddenNodeIdsByAddress, setHiddenNodeIdsByAddress] = useState(() =>
    parseHiddenNodeIdsByAddress(getItem(PREFERENCE.HIDDEN_NODE_IDS))
  );

  const storageKey = address?.toLowerCase();

  const hiddenNodeIdSet = useMemo(
    () => new Set(storageKey ? getHiddenNodeIdsForAddress(hiddenNodeIdsByAddress, storageKey) : []),
    [hiddenNodeIdsByAddress, storageKey]
  );

  const toggleNodeHidden = useCallback(
    (nodeId: number) => {
      if (!storageKey) return;
      const next = toggleHiddenNodeIdForAddress(hiddenNodeIdsByAddress, storageKey, nodeId);
      setItem(PREFERENCE.HIDDEN_NODE_IDS, next);
      setHiddenNodeIdsByAddress(next);
    },
    [hiddenNodeIdsByAddress, storageKey, setItem]
  );

  return { hiddenNodeIdSet, toggleNodeHidden };
}
