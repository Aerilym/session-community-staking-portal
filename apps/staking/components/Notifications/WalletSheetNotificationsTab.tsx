'use client';

import { useNotificationsPrompt } from '@/components/Notifications/NotificationsManager';
import { PREFERENCE, prefDetails } from '@/lib/constants';
import {
  getDeviceWatchedAddresses,
  sendTestNotification,
  unsubscribeAddressFromNotifications,
} from '@/lib/push';
import { usePreferenceValue } from '@/providers/preferences-provider';
import { ButtonDataTestId } from '@/testing/data-test-ids';
import { toast } from '@session/ui/lib/toast';
import { Button } from '@session/ui/ui/button';
import { PubkeyWithEns } from '@session/wallet/components/PubkeyWithEns';
import {
  type WalletSheetNonPrimaryTabProps,
  type WalletSheetTabDetails,
  useWalletSheetUILibrary,
} from '@session/wallet/components/WalletUserSheet';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { usePreferences } from 'usepref';

type NotificationsTabProps = WalletSheetNonPrimaryTabProps;

export function NotificationsTab({ handleBackButtonClick }: NotificationsTabProps) {
  const dict = useTranslations('notifications.tab');
  const UI = useWalletSheetUILibrary();
  const { setItem } = usePreferences();
  const { address: connectedAddress, setUserSheetOpen } = useWallet();
  const { openPrompt } = useNotificationsPrompt();
  const preferenceValue = usePreferenceValue<boolean>(PREFERENCE.NOTIFICATIONS_ENABLED);

  const [addresses, setAddresses] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = preferenceValue ?? prefDetails[PREFERENCE.NOTIFICATIONS_ENABLED].defaultValue;

  const refresh = useCallback(async () => {
    try {
      const watched = await getDeviceWatchedAddresses();
      setAddresses(watched ?? []);
    } catch (error) {
      console.error('Failed to load watched addresses', error);
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUnsubscribe(address: string) {
    setBusy(true);
    try {
      await unsubscribeAddressFromNotifications(address);
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(dict('error'));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribeAll() {
    setBusy(true);
    try {
      await unsubscribeAddressFromNotifications();
      await refresh();
      // Also disable the preference so the user is not re-prompted on the next
      // wallet connect. The NotificationsManager shows the confirmation toast
      // when it observes this preference change.
      setItem(PREFERENCE.NOTIFICATIONS_ENABLED, false);
    } catch (error) {
      console.error(error);
      toast.error(dict('error'));
    } finally {
      setBusy(false);
    }
  }

  async function handleTestNotification() {
    setBusy(true);
    try {
      await sendTestNotification();
      toast.success(dict('testSent'));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'no-subscription') {
          toast.error(dict('testNoSubscription'));
          return;
        }
        if (error.message === 'test-too-many') {
          toast.error(dict('testTooMany'));
          return;
        }
      }
      console.error(error);
      toast.error(dict('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <UI.SheetHeader className="flex flex-row items-center gap-2 align-middle">
        <UI.BackButton onClick={handleBackButtonClick} />
        <UI.SheetTitle>{dict('title')}</UI.SheetTitle>
      </UI.SheetHeader>
      <UI.SheetDescription>{dict('description')}</UI.SheetDescription>
      <p className="text-muted-foreground text-xs leading-relaxed">{dict('privacyHint')}</p>
      {/* When enabled the switch is hidden on purpose: unsubscribing is done
            with the "Unsubscribe All" button below (which also disables the preference). */}
      {!enabled ? (
        <div className="flex flex-row items-center justify-between gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{dict('toggleLabel')}</span>
            <span className="text-muted-foreground text-xs">{dict('toggleDescription')}</span>
          </div>
          <UI.Switch
            aria-label={dict('toggleLabel')}
            checked={enabled}
            onCheckedChange={(checked) => setItem(PREFERENCE.NOTIFICATIONS_ENABLED, checked)}
          />
        </div>
      ) : null}
      {enabled ? (
        <div className="flex flex-col gap-2">
          <Button
            aria-label={dict('testButton')}
            data-testid={ButtonDataTestId.Test_Notifications}
            variant="outline"
            disabled={busy}
            onClick={() => void handleTestNotification()}
          >
            {dict('testButton')}
          </Button>
          {connectedAddress &&
          addresses !== null &&
          !addresses.includes(connectedAddress.toLowerCase()) ? (
            <Button
              aria-label={dict('subscribeCurrentWallet')}
              data-testid={ButtonDataTestId.Subscribe_Notifications_Current_Wallet}
              variant="outline"
              disabled={busy}
              onClick={() => {
                // The enable dialog renders below the wallet sheet's z-index, so
                // close the sheet to reveal it.
                setUserSheetOpen(false);
                openPrompt(connectedAddress);
              }}
            >
              {dict('subscribeCurrentWallet')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {!enabled ? (
          <p className="text-muted-foreground text-sm">{dict('disabledHint')}</p>
        ) : (
          <>
            {addresses === null ? (
              <p className="text-muted-foreground text-sm">{dict('loading')}</p>
            ) : addresses.length === 0 ? (
              <p className="text-muted-foreground text-sm">{dict('empty')}</p>
            ) : (
              <>
                {addresses.map((address) => (
                  <div
                    key={address}
                    className="flex flex-row items-center justify-between gap-2 rounded-md border py-1 ps-4 pe-1"
                  >
                    <PubkeyWithEns pubKey={address} alwaysShowCopyButton={true} />
                    <Button
                      aria-label={dict('unsubscribeWallet')}
                      data-testid={ButtonDataTestId.Unsubscribe_Notifications_Wallet}
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleUnsubscribe(address)}
                    >
                      {dict('unsubscribe')}
                    </Button>
                  </div>
                ))}
              </>
            )}
            {/* Always available while enabled: with the switch hidden this button is the
                tab's disable control, even when no addresses are currently watched. */}
            <Button
              aria-label={dict('unsubscribeAll')}
              data-testid={ButtonDataTestId.Unsubscribe_Notifications_All}
              variant="outline"
              disabled={busy}
              onClick={() => void handleUnsubscribeAll()}
            >
              {dict('unsubscribeAll')}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

export const walletSheetNotificationsTab: WalletSheetTabDetails = {
  id: 'notifications' as WalletSheetTabDetails['id'],
  tab: (props: NotificationsTabProps) => <NotificationsTab {...props} />,
};
