'use client';

import { useWallet } from '@session/wallet/hooks/useWallet';
import { useMemo } from 'react';
import { http, type Chain, type PublicClient, createPublicClient } from 'viem';

const initPublicClient = (chain: Chain): PublicClient =>
  createPublicClient({
    chain,
    transport: http(),
  });

export function usePublicWeb3Client(): PublicClient | null {
  const { chain } = useWallet();
  return useMemo(() => (chain ? initPublicClient(chain) : null), [chain]);
}
