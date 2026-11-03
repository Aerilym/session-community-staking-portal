'use client';

import { NEXT_PUBLIC_VAPID_PUBLIC_KEY } from '@/lib/env';

const SUBSCRIBE_URL = '/api/notifications/subscribe';
const UNSUBSCRIBE_URL = '/api/notifications/unsubscribe';
const SUBSCRIPTIONS_URL = '/api/notifications/subscriptions';
const TEST_URL = '/api/notifications/test';

export function arePushNotificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

export async function registerNotificationsServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.error('Failed to register service worker', error);
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  // NOTE: `navigator.serviceWorker.ready` never resolves when no service worker is registered,
  // so use `getRegistration` and bail out when there is none.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;

  return registration.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function createPushSubscription(): Promise<PushSubscription> {
  if (Notification.permission === 'denied') {
    throw new Error('permission-denied');
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('permission-denied');
    }
  }

  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    throw new Error('vapid-key-missing');
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });
}

/**
 * Ensures the browser is subscribed to push (requesting permission when
 * needed) and links the given address to this device's subscription.
 */
export async function subscribeAddressToNotifications(address: string): Promise<void> {
  await registerNotificationsServiceWorker();

  const subscription = await createPushSubscription();
  const { endpoint, keys } = subscription.toJSON();

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('invalid-subscription');
  }

  const response = await fetch(SUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
      address,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const endpointHost = new URL(endpoint).hostname;
    throw new Error(
      `subscribe-failed-${response.status}${detail ? `: ${detail}` : ''} (endpoint host: ${endpointHost})`
    );
  }
}

/**
 * Removes the address from this device's subscription, or the entire
 * subscription when no address is given.
 */
export async function unsubscribeAddressFromNotifications(address?: string): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription?.endpoint) return;

  const response = await fetch(UNSUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, address }),
  });

  if (!response.ok) {
    throw new Error(`unsubscribe-failed-${response.status}`);
  }
}

/**
 * Returns the addresses watched by this device, or `null` when the browser has
 * no push subscription yet.
 */
export async function getDeviceWatchedAddresses(): Promise<string[] | null> {
  const subscription = await getPushSubscription();
  if (!subscription?.endpoint) return null;

  const response = await fetch(
    `${SUBSCRIPTIONS_URL}?endpoint=${encodeURIComponent(subscription.endpoint)}`
  );

  if (!response.ok) {
    throw new Error(`subscriptions-failed-${response.status}`);
  }

  const data = (await response.json()) as { addresses: string[] };
  return data.addresses;
}

/**
 * Returns whether the address is already watched on this device, or `null`
 * when the browser has no push subscription yet.
 */
export async function isAddressSubscribedOnDevice(address: string): Promise<boolean | null> {
  const watched = await getDeviceWatchedAddresses();
  if (watched === null) return null;
  return watched.includes(address.toLowerCase());
}

/**
 * Sends a test push notification to this device's subscription so the user can
 * validate that notifications are working.
 */
export async function sendTestNotification(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription?.endpoint) {
    throw new Error('no-subscription');
  }

  const response = await fetch(TEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('test-too-many');
    }
    throw new Error(`test-failed-${response.status}`);
  }
}
