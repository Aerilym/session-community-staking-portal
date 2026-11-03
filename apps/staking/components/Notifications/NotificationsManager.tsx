'use client';

import { EnableNotificationsDialog } from '@/components/Notifications/EnableNotificationsDialog';
import { PREFERENCE, prefDetails } from '@/lib/constants';
import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { useRemoteFeatureFlagQuery } from '@/lib/feature-flags-client';
import {
  arePushNotificationsSupported,
  isAddressSubscribedOnDevice,
  registerNotificationsServiceWorker,
  subscribeAddressToNotifications,
  unsubscribeAddressFromNotifications,
} from '@/lib/push';
import { usePreferenceValue } from '@/providers/preferences-provider';
import { toast } from '@session/ui/lib/toast';
import { useWallet } from '@session/wallet/hooks/useWallet';
import { useTranslations } from 'next-intl';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePreferences } from 'usepref';

interface NotificationsPromptContext {
  /**
   * Opens the enable-notifications dialog for the given address. Used for explicit
   * user-initiated subscribes (e.g. from the node notifications wallet sheet tab) and
   * intentionally bypasses the "dismissed" suppression.
   */
  openPrompt: (address: string) => void;
}

const Context = createContext<NotificationsPromptContext | undefined>(undefined);

export function useNotificationsPrompt() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useNotificationsPrompt must be used inside NotificationsDialogProvider');
  }
  return context;
}

function parseDismissedWallets(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((address): address is string => typeof address === 'string');
  } catch {
    return [];
  }
}

/**
 * Globally mounted provider that:
 *
 * - registers the service worker (PWA + push),
 * - prompts to enable notifications whenever an unsubscribed wallet connects
 *   (while the global notifications preference is enabled), unless the user
 *   dismissed the prompt for that wallet,
 * - unsubscribes this device from all notifications when the global
 *   preference is turned off,
 * - exposes {@link useNotificationsPrompt} for explicit subscribes.
 */
export function NotificationsDialogProvider({ children }: { children: ReactNode }) {
  const dict = useTranslations('notifications.dialog');
  const { address: connectedAddress } = useWallet();
  const { setItem } = usePreferences();

  const { enabled: notificationsDisabled, isLoading: flagsLoading } = useRemoteFeatureFlagQuery(
    REMOTE_FEATURE_FLAG.DISABLE_NODE_NOTIFICATIONS
  );

  const notificationsEnabled =
    usePreferenceValue<boolean>(PREFERENCE.NOTIFICATIONS_ENABLED) ??
    (prefDetails[PREFERENCE.NOTIFICATIONS_ENABLED].defaultValue as boolean);

  const dismissedWallets = parseDismissedWallets(
    usePreferenceValue<string>(PREFERENCE.NOTIFICATION_PROMPT_DISMISSED)
  );
  const dismissedKey = dismissedWallets.join(',');

  const [promptAddress, setPromptAddress] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const promptedForRef = useRef<string | undefined>(undefined);
  const prevEnabledRef = useRef<boolean | undefined>(undefined);

  // Register the service worker on mount.
  useEffect(() => {
    if (!arePushNotificationsSupported()) return;
    void registerNotificationsServiceWorker();
  }, []);

  // Turning the global preference off unsubscribes this device from everything.
  // Turning it back on allows the connect prompt to re-check the current wallet.
  useEffect(() => {
    const prev = prevEnabledRef.current;
    prevEnabledRef.current = notificationsEnabled;

    if (prev === undefined || prev === notificationsEnabled) return;

    if (prev && !notificationsEnabled) {
      void unsubscribeAddressFromNotifications()
        .then(() => {
          toast.success(dict('disabledToast'));
        })
        .catch((error) => {
          console.error('Failed to unsubscribe from notifications', error);
          toast.error(dict('error'));
        });
    } else if (!prev && notificationsEnabled) {
      promptedForRef.current = undefined;
    }
  }, [notificationsEnabled, dict]);

  // Prompt every time an unsubscribed wallet connects, unless the user dismissed
  // the prompt for that wallet.
  useEffect(() => {
    if (!connectedAddress) {
      promptedForRef.current = undefined;
      setPromptAddress(undefined);
      return;
    }

    if (!notificationsEnabled || notificationsDisabled || flagsLoading) return;
    if (!arePushNotificationsSupported()) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
    if (promptedForRef.current === connectedAddress) return;

    const lowerCased = connectedAddress.toLowerCase();
    if (dismissedWallets.includes(lowerCased)) return;

    promptedForRef.current = connectedAddress;

    let cancelled = false;
    let finished = false;
    void (async () => {
      try {
        await registerNotificationsServiceWorker();
        const subscribed = await isAddressSubscribedOnDevice(connectedAddress);
        if (cancelled || subscribed === true) return;
        setPromptAddress(connectedAddress);
      } catch (error) {
        console.error('Failed to check push subscription state', error);
      } finally {
        finished = true;
      }
    })();

    return () => {
      cancelled = true;
      // If the check was cut short (e.g. React StrictMode double-invoke), allow a re-run.
      if (!finished) promptedForRef.current = undefined;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies(dismissedKey): derived from dismissedWallets
  }, [connectedAddress, notificationsEnabled, notificationsDisabled, flagsLoading, dismissedKey]);

  const openPrompt = useCallback((address: string) => {
    setPromptAddress(address);
  }, []);

  async function handleEnable() {
    if (!promptAddress) return;
    setBusy(true);
    try {
      await subscribeAddressToNotifications(promptAddress);
      // Enable is an explicit opt-in: clear any dismissal for this wallet.
      removeFromDismissed(promptAddress);
      toast.success(dict('success'));
      setPromptAddress(undefined);
    } catch (error) {
      console.error('Failed to enable notifications', error);
      if (error instanceof Error && error.message === 'permission-denied') {
        toast.error(dict('permissionDenied'));
      } else {
        toast.error(dict('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    if (promptAddress) {
      // Suppress future automatic prompts for this wallet on this device.
      setItem(
        PREFERENCE.NOTIFICATION_PROMPT_DISMISSED,
        JSON.stringify([...new Set([...dismissedWallets, promptAddress.toLowerCase()])])
      );
    }
    setPromptAddress(undefined);
  }

  function removeFromDismissed(address: string) {
    setItem(
      PREFERENCE.NOTIFICATION_PROMPT_DISMISSED,
      JSON.stringify(dismissedWallets.filter((wallet) => wallet !== address.toLowerCase()))
    );
  }

  return (
    <Context.Provider value={{ openPrompt }}>
      {children}
      <EnableNotificationsDialog
        address={promptAddress}
        open={promptAddress !== undefined}
        busy={busy}
        onEnable={() => void handleEnable()}
        onDismiss={handleDismiss}
      />
    </Context.Provider>
  );
}
