'use client';

import { ClaimTokensDialog } from '@/app/mystakes/modules/claim/ClaimTokensDialog';
import type { AddressModuleProps } from '@/app/mystakes/modules/types';
import ModuleButtonDialogTrigger from '@/components/ModuleButtonDialogTrigger';
import { NewFeatureTag } from '@/components/NewFeatureTag';
import { useNetworkBalances } from '@/hooks/useNetworkBalances';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { CogIcon } from '@session/ui/icons/CogIcon';
import type { PresentIcon } from '@session/ui/icons/PresentIcon';
import { Button } from '@session/ui/ui/button';
import { useWalletTokenBalance } from '@session/wallet/components/WalletButton';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export type ClaimDict = ReturnType<typeof useTranslations<'modules.claim'>>;

export type ClaimTokensModuleProps = AddressModuleProps & {
  dictionary?: ClaimDict;
  textClassName?: string;
  iconOverride?: typeof PresentIcon;
  iconStrokeForFill?: boolean;
  refetchBalance?: () => void;
};

export default function ClaimTokensModule({
  addressOverride,
  dictionary,
  iconOverride,
  iconStrokeForFill,
  textClassName,
  refetchBalance,
}: ClaimTokensModuleProps) {
  const { address: connectedAddress } = useWallet();
  const { refetch } = useWalletTokenBalance();
  const fallbackDict = useTranslations('modules.claim');
  const dict = dictionary ?? fallbackDict;
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);

  const { canClaim } = useNetworkBalances({ addressOverride });

  const { enabled: isClaimRewardsDisabled, isLoading: isRemoteFlagLoading } =
    useRemoteFeatureFlagQuery(REMOTE_FEATURE_FLAG.DISABLE_CLAIM_REWARDS);

  const address = addressOverride ?? connectedAddress;
  const disabled = !address || !canClaim || isRemoteFlagLoading || isClaimRewardsDisabled;

  return (
    <ModuleButtonDialogTrigger
      dialogContent={
        address ? (
          <ClaimTokensDialog
            address={address}
            dictionary={dict}
            refetchBalance={refetchBalance ?? refetch}
            advancedMode={advancedMode}
          />
        ) : null
      }
      dialogTitle={dict('title')}
      label={dict('title')}
      size="lg"
      dialogContainerClassName="sm:top-1/3 sm:translate-y-0 sm:max-h-[66dvh]"
      dialogHeaderAction={
        <Button
          variant="ghost"
          size="sm"
          className="-ms-4 gap-1.5 px-2 text-xs"
          aria-pressed={advancedMode}
          data-testid={ButtonDataTestId.Claim_Tokens_Advanced_Toggle}
          onClick={() => setAdvancedMode((previous) => !previous)}
        >
          <CogIcon className={advancedMode ? 'h-3.5 w-3.5 stroke-session-green' : 'h-3.5 w-3.5'} />
          {dict('dialog.advancedMode')}
        </Button>
      }
      data-testid={ButtonDataTestId.Claim_Tokens_Open_Dialog}
      disabled={disabled}
      IconComp={iconOverride}
      textClassName={textClassName}
      iconStrokeForFill={iconStrokeForFill}
    >
      <NewFeatureTag
        className="absolute end-0 top-2 translate-y-1/2 rotate-[20deg]"
        subtitle="One-click claim"
      />
    </ModuleButtonDialogTrigger>
  );
}
