/**
 * Adds a node id to a list of hidden node ids.
 * @param ids - The current list of hidden node ids.
 * @param nodeId - The node id (the node's contract_id in the main staking contract) to hide.
 * @returns A new list of hidden node ids, unchanged if the id was already hidden.
 */
export function addHiddenNodeId(ids: ReadonlyArray<number>, nodeId: number): Array<number> {
  return ids.includes(nodeId) ? [...ids] : [...ids, nodeId];
}

/**
 * Removes a node id from a list of hidden node ids.
 * @param ids - The current list of hidden node ids.
 * @param nodeId - The node id (the node's contract_id in the main staking contract) to unhide.
 * @returns A new list of hidden node ids, unchanged if the id was not hidden.
 */
export function removeHiddenNodeId(ids: ReadonlyArray<number>, nodeId: number): Array<number> {
  return ids.filter((id) => id !== nodeId);
}

/**
 * Sanitizes an unknown stored value into a map of wallet address to hidden node ids.
 * @param value - The raw value read from preferences.
 * @returns A map of lowercased wallet addresses to lists of hidden node ids.
 */
export function parseHiddenNodeIdsByAddress(value: unknown): Record<string, Array<number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, Array<number>> = {};
  for (const [address, ids] of Object.entries(value)) {
    if (Array.isArray(ids)) {
      result[address] = ids.filter((id) => typeof id === 'number');
    }
  }
  return result;
}

/**
 * Gets the hidden node ids for a wallet address.
 * @param hiddenNodeIdsByAddress - Map of wallet address to hidden node ids.
 * @param address - The wallet address (keyed lowercased).
 * @returns The list of hidden node ids for the address.
 */
export function getHiddenNodeIdsForAddress(
  hiddenNodeIdsByAddress: Readonly<Record<string, ReadonlyArray<number>>>,
  address: string
): Array<number> {
  const ids = hiddenNodeIdsByAddress[address];
  return Array.isArray(ids) ? [...ids] : [];
}

/**
 * Toggles a node id in the hidden node ids of a single wallet address, leaving
 * other wallets' hidden nodes untouched.
 * @param hiddenNodeIdsByAddress - Map of wallet address to hidden node ids.
 * @param address - The wallet address (keyed lowercased).
 * @param nodeId - The node id (the node's contract_id in the main staking contract) to toggle.
 * @returns A new map with the node id toggled for the address only.
 */
export function toggleHiddenNodeIdForAddress(
  hiddenNodeIdsByAddress: Readonly<Record<string, ReadonlyArray<number>>>,
  address: string,
  nodeId: number
): Record<string, Array<number>> {
  const current = getHiddenNodeIdsForAddress(hiddenNodeIdsByAddress, address);
  const next = current.includes(nodeId)
    ? removeHiddenNodeId(current, nodeId)
    : addHiddenNodeId(current, nodeId);
  const result: Record<string, Array<number>> = {};
  for (const [key, ids] of Object.entries(hiddenNodeIdsByAddress)) {
    result[key] = [...ids];
  }
  result[address] = next;
  return result;
}
