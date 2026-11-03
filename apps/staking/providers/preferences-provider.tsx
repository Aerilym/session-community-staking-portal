'use client';

import {
  type PREFERENCE,
  preferenceStorageDefaultItems,
  preferenceStorageKey,
} from '@/lib/constants';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { usePreferences } from 'usepref';
import { PreferencesProvider as PreferencesProviderUsePref } from 'usepref/providers/preferences-provider';
import { PreferenceStorage } from 'usepref/storage/preference-storage';

const PREFERENCE_CHANGE_EVENT = 'session-preference-change';

/**
 * NOTE: usepref has no built-in reactivity — `setItem` does not re-render components that read
 * `getItem`. This subclass dispatches a window event on every write so {@link usePreferenceValue}
 * can subscribe to changes.
 */
class NotifyingPreferenceStorage extends PreferenceStorage {
  private readonly notify: () => void;

  constructor(
    options: ConstructorParameters<typeof PreferenceStorage>[0] & { notify: () => void }
  ) {
    super(options);
    this.notify = options.notify;
  }

  override setItem(key: string, value: string | number | boolean) {
    const result = super.setItem(key, value);
    if (result) this.notify();
    return result;
  }
}

let browserPreferencesStorage: PreferenceStorage | undefined;

function createPreferencesStorage() {
  if (typeof window === 'undefined') {
    return new PreferenceStorage({
      key: preferenceStorageKey,
      defaultItems: preferenceStorageDefaultItems,
    });
  }

  return new NotifyingPreferenceStorage({
    key: preferenceStorageKey,
    defaultItems: preferenceStorageDefaultItems,
    notify: () => {
      window.dispatchEvent(new CustomEvent(PREFERENCE_CHANGE_EVENT));
    },
  });
}

export function getPreferencesStorage() {
  if (!browserPreferencesStorage) browserPreferencesStorage = createPreferencesStorage();
  return browserPreferencesStorage;
}

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const PreferencesStorage = getPreferencesStorage();

  return (
    <PreferencesProviderUsePref preferenceStorage={PreferencesStorage}>
      {children}
    </PreferencesProviderUsePref>
  );
}

export function useDevicePref<T = boolean>(pref: PREFERENCE) {
  const { getItem } = usePreferences();
  return !getItem<T>(pref);
}

/**
 * Reactive version of `usePreferences().getItem`. Re-renders the calling component whenever a
 * preference is written (from anywhere in the app, e.g. the wallet sheet settings tab).
 */
export function usePreferenceValue<T = boolean>(key: PREFERENCE): T | null {
  const { getItem } = usePreferences();

  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(PREFERENCE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(PREFERENCE_CHANGE_EVENT, onChange);
  }, []);

  const getSnapshot = useCallback(() => getItem<T>(key), [getItem, key]);

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    // Server/SSR snapshot: preferences are a browser-only concern
    () => null
  );
}
