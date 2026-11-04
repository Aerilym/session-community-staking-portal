'use client';

import { walletSheetNotificationsTab } from '@/components/Notifications/WalletSheetNotificationsTab';
import { walletSheetVestingTab } from '@/components/Vesting/WalletSheetVestingTab';
import { PREFERENCE, customSettings } from '@/lib/constants';
import { NEXT_PUBLIC_VAPID_PUBLIC_KEY } from '@/lib/env';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import { useVesting } from '@/providers/vesting-provider';
import WalletUserSheetUI from '@session/wallet/components/WalletUserSheet';
import { useTranslations } from 'next-intl';

export function WalletUserSheet() {
  const { contracts } = useVesting();
  const notifDict = useTranslations('notifications');

  const { enabled: notificationsDisabled } = useRemoteFeatureFlagQuery(
    REMOTE_FEATURE_FLAG.DISABLE_NODE_NOTIFICATIONS
  );

  const showNotifications = Boolean(NEXT_PUBLIC_VAPID_PUBLIC_KEY) && !notificationsDisabled;

  return (
    <WalletUserSheetUI
      customTabs={
        showNotifications
          ? [walletSheetVestingTab, walletSheetNotificationsTab]
          : [walletSheetVestingTab]
      }
      customSettings={customSettings.filter(
        ({ key }) => key !== PREFERENCE.NOTIFICATIONS_ENABLED || showNotifications
      )}
      mainTabConfig={{
        customButtons: [
          ...(contracts.length ? [{ id: 'vesting', label: 'Vesting Contracts' }] : []),
          ...(showNotifications
            ? [{ id: 'notifications', label: notifDict('mainTabButton') }]
            : []),
        ],
      }}
    />
  );
}
