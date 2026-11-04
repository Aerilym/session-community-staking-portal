import 'server-only';

import logger from '@/lib/logger';
import webpush from 'web-push';
import type { PushSubscriptionRow } from './db';
import {
  NOTIFICATIONS_VAPID_PRIVATE_KEY,
  NOTIFICATIONS_VAPID_PUBLIC_KEY,
  NOTIFICATIONS_VAPID_SUBJECT,
  notificationsVapidConfigured,
} from './env';
import {
  deleteSubscriptionById,
  getSubscriptionByEndpoint,
  getSubscriptionsForAddress,
} from './store';

export interface NotificationPayload {
  title: string;
  body: string;
  /** Notification tag used to replace previous notifications of the same kind. */
  tag?: string;
  /** In-app URL opened when the notification is clicked. */
  url?: string;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!NOTIFICATIONS_VAPID_PUBLIC_KEY || !NOTIFICATIONS_VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys are not configured, cannot send push notifications');
  }
  webpush.setVapidDetails(
    NOTIFICATIONS_VAPID_SUBJECT,
    NOTIFICATIONS_VAPID_PUBLIC_KEY,
    NOTIFICATIONS_VAPID_PRIVATE_KEY
  );
  configured = true;
}

/** Request timeout and retention time (seconds) for push sends. */
const SEND_TIMEOUT_MS = 10_000;
const SEND_TTL_SECONDS = 60 * 60 * 24;

async function sendToSubscription(subscription: PushSubscriptionRow, payload: NotificationPayload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { timeout: SEND_TIMEOUT_MS, TTL: SEND_TTL_SECONDS }
    );
    return true;
  } catch (error) {
    const statusCode =
      typeof error === 'object' && error && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      deleteSubscriptionById(subscription.id);
      logger.info(`Removed expired push subscription ${subscription.id}`);
      return false;
    }

    logger.error(error, `Failed to send push notification to subscription ${subscription.id}`);
    return false;
  }
}

/**
 * Sends a push notification to every subscription watching the given address.
 * Subscriptions that the push service reports as gone (404/410) are removed.
 */
export async function sendNotificationToAddress(address: string, payload: NotificationPayload) {
  if (!notificationsVapidConfigured) return;

  ensureConfigured();

  const subscriptions = getSubscriptionsForAddress(address);
  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map((subscription) => sendToSubscription(subscription, payload))
  );
}

/**
 * Sends a push notification to the subscription registered for the given endpoint
 * (i.e. to a single device). Returns `false` when the endpoint is unknown or the
 * push service reports it as gone.
 */
export async function sendNotificationToEndpoint(
  endpoint: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!notificationsVapidConfigured) return false;

  ensureConfigured();

  const subscription = getSubscriptionByEndpoint(endpoint);
  if (!subscription) return false;

  return await sendToSubscription(subscription, payload);
}
