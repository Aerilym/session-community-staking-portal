'use client';

import { useSeshPrice } from '@/app/mystakes/modules/PriceModule';
import type { AddressModuleProps } from '@/app/mystakes/modules/types';
import { SeshAmountWithUsd } from '@/components/FiatUsd';
import { ModuleOverlayTitle } from '@/components/ModuleOverlayTitle';
import { DYNAMIC_MODULE } from '@/lib/constants';
import { NEXT_PUBLIC_TESTNET } from '@/lib/env';
import { formatSENTBigInt } from '@session/contracts/hooks/Token';
import { Module } from '@session/ui/components/Module';
import { QuestionIcon } from '@session/ui/icons/QuestionIcon';
import { Tooltip } from '@session/ui/ui/tooltip';
import { useERC20Balance } from '@session/wallet/hooks/useERC20Balance';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'viem/chains';

const SESH_TOKEN_NAME = 'Session Token';

const ARBITRUM_CHAIN_ID = NEXT_PUBLIC_TESTNET ? arbitrumSepolia.id : arbitrum.id;
const ETHEREUM_CHAIN_ID = NEXT_PUBLIC_TESTNET ? sepolia.id : mainnet.id;

export function useSeshChainBalances({ addressOverride }: { addressOverride?: Address }) {
  const { address: connectedAddress, tokens } = useWallet();
  const address = addressOverride ?? connectedAddress;

  const seshTokenAddresses = useMemo(() => {
    const map = new Map<number, Address>();
    for (const token of tokens ?? []) {
      if ('tokenAddress' in token && token.name === SESH_TOKEN_NAME) {
        map.set(token.network.id, token.tokenAddress);
      }
    }
    return map;
  }, [tokens]);

  const arbitrumTokenAddress = seshTokenAddresses.get(ARBITRUM_CHAIN_ID);
  const ethereumTokenAddress = seshTokenAddresses.get(ETHEREUM_CHAIN_ID);

  const arbitrum = useERC20Balance({
    chainId: ARBITRUM_CHAIN_ID,
    tokenAddress: arbitrumTokenAddress,
    targetAddress: address,
    query: { enabled: !!address && !!arbitrumTokenAddress },
  });

  const ethereum = useERC20Balance({
    chainId: ETHEREUM_CHAIN_ID,
    tokenAddress: ethereumTokenAddress,
    targetAddress: address,
    query: { enabled: !!address && !!ethereumTokenAddress },
  });

  return {
    arbitrumBalance: arbitrum.data?.value ?? null,
    ethereumBalance: ethereum.data?.value ?? null,
  };
}

export default function WalletBalanceModule({ addressOverride }: AddressModuleProps) {
  const dict = useTranslations('modules.walletBalance');
  const titleFormat = useTranslations('modules.title');

  const { arbitrumBalance, ethereumBalance } = useSeshChainBalances({ addressOverride });
  const price = useSeshPrice();

  return (
    <Module size="lg" outerClassName="mt-4">
      <ModuleOverlayTitle longText={titleFormat('format', { title: dict('title') })} />
      <div className="flex w-full flex-row flex-wrap justify-around gap-2">
        <BalanceStat
          label={dict('arbitrum')}
          tooltipContent={dict('arbitrumTooltip')}
          value={
            arbitrumBalance !== null ? (
              <SeshAmountWithUsd
                amount={arbitrumBalance}
                formatted={formatSENTBigInt(arbitrumBalance, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
                price={price}
              />
            ) : null
          }
        />
        <BalanceStat
          label={dict('ethereum')}
          tooltipContent={dict('ethereumTooltip')}
          value={
            ethereumBalance !== null ? (
              <SeshAmountWithUsd
                amount={ethereumBalance}
                formatted={formatSENTBigInt(ethereumBalance, DYNAMIC_MODULE.SENT_ROUNDED_DECIMALS)}
                price={price}
              />
            ) : null
          }
        />
      </div>
    </Module>
  );
}

function BalanceStat({
  label,
  value,
  tooltipContent,
}: { label: string; value: ReactNode; tooltipContent: string }) {
  return (
    <div className="flex flex-col items-start justify-center text-start">
      <span className="inline-flex flex-row gap-1 text-muted-foreground text-sm">
        {label}
        <InfoTooltip>{tooltipContent}</InfoTooltip>
      </span>
      <span className="text-2xl">{value ?? '—'}</span>
    </div>
  );
}

function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip tooltipContent={children} putContentInPortal>
      <div className="cursor-pointer self-center">
        <QuestionIcon className="h-3 w-3 fill-muted-foreground" />
      </div>
    </Tooltip>
  );
}
