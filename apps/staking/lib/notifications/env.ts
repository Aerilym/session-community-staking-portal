import 'server-only';

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Public VAPID key, shared with the browser via NEXT_PUBLIC prefixing. */
export const NOTIFICATIONS_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Private VAPID key, server-only. */
export const NOTIFICATIONS_VAPID_PRIVATE_KEY = process.env.NOTIFICATIONS_VAPID_PRIVATE_KEY;

/** VAPID subject, e.g. `mailto:admin@example.com`. */
export const NOTIFICATIONS_VAPID_SUBJECT =
  process.env.NOTIFICATIONS_VAPID_SUBJECT || 'mailto:notifications@getsession.org';

/** Absolute or app-relative path to the notifications sqlite database. */
export const NOTIFICATIONS_DB_PATH = process.env.NOTIFICATIONS_DB_PATH || 'db/notifications.sqlite';

/** Subscriptions not seen for this many days are expired and their data deleted. */
export const NOTIFICATIONS_SUBSCRIPTION_EXPIRY_DAYS = parsePositiveInt(
  process.env.NOTIFICATIONS_SUBSCRIPTION_EXPIRY_DAYS,
  90
);

/** Seconds between worker polls of the staking backend. */
export const NOTIFICATIONS_POLL_INTERVAL_SECONDS = parsePositiveInt(
  process.env.NOTIFICATIONS_POLL_INTERVAL_SECONDS,
  120
);

/** Set to 'false' to disable the background push worker on this instance. */
export const NOTIFICATIONS_WORKER_ENABLED = process.env.NOTIFICATIONS_WORKER_ENABLED !== 'false';

export const notificationsVapidConfigured = Boolean(
  NOTIFICATIONS_VAPID_PUBLIC_KEY && NOTIFICATIONS_VAPID_PRIVATE_KEY
);
