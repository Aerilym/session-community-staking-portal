import type { ClaimDict } from '@/app/mystakes/modules/ClaimTokensModule';
import { ClaimTokens } from '@/app/mystakes/modules/claim/ClaimTokens';
import { ClaimTokensOverLimit } from '@/app/mystakes/modules/claim/ClaimTokensOverLimit';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useNetworkBalances } from '@/hooks/useNetworkBalances';
import { QUERY } from '@/lib/constants';
import { getRewardsClaimSignature } from '@/lib/queries/getRewardsClaimSignature';
import { useStakingBackendQueryWithParams } from '@/lib/staking-api-client';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import type { Address } from 'viem';

export function ClaimTokensDialog({
  address,
  dictionary,
  refetchBalance,
  advancedMode,
}: {
  address: Address;
  dictionary: ClaimDict;
  refetchBalance?: () => void;
  advancedMode?: boolean;
}) {
  const { canClaim, isClaimOverLimit, refetch } = useNetworkBalances({ addressOverride: address });

  const { data: claimData, isError } = useStakingBackendQueryWithParams(
    getRewardsClaimSignature,
    { address },
    {
      enabled: !!address && canClaim && !isClaimOverLimit,
      staleTime: QUERY.STALE_TIME_CLAIM_REWARDS,
    }
  );

  return (
    <>
      {isError ? (
        <ErrorMessage
          refetch={refetch}
          message={dictionary.rich('error')}
          buttonText={dictionary('errorButton')}
          buttonDataTestId={ButtonDataTestId.Claim_Tokens_Error_Retry}
        />
      ) : isClaimOverLimit ? (
        <ClaimTokensOverLimit address={address} />
      ) : (
        // NOTE: the tabbed UI renders immediately while the claim signature is
        // fetched in the background
        <ClaimTokens
          claimData={claimData}
          address={address}
          dictionary={dictionary}
          refetchBalance={refetchBalance}
          advancedMode={advancedMode}
        />
      )}
    </>
  );
}
