import 'server-only';

import { isProduction } from '@/lib/env';
import { z } from 'zod';

/**
 * Push service endpoint hosts observed from real browsers:
 *
 * - Chrome and other Google-API-enabled Chromium builds (Edge, Brave, Opera, Vivaldi, Yandex,
 *   Chromium on Android) issue FCM endpoints: `fcm.googleapis.com/fcm/send/...` and, since
 *   2025, Google frontend hosts such as `jmt17.google.com/fcm/send/...`
 * - Firefox (Mozilla autopush): `updates.push.services.mozilla.com/wpush/v2/...`
 * - Safari (APNs Web Push): `web.push.apple.com/...`
 * - Legacy Windows/EdgeHTML: `notify.windows.com/...`
 */
const PUSH_SERVICE_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

/**
 * Extra endpoint host suffixes (comma-separated) allowed via NOTIFICATIONS_EXTRA_PUSH_HOSTS,
 * e.g. for browsers with their own push relay or self-hosted test push services.
 */
const EXTRA_HOST_SUFFIXES = (process.env.NOTIFICATIONS_EXTRA_PUSH_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter((host) => host.length > 0);

const ALLOWED_HOST_SUFFIXES = [...PUSH_SERVICE_HOST_SUFFIXES, ...EXTRA_HOST_SUFFIXES];

/**
 * Chrome's FCM endpoints are served from numbered Google frontend hosts (e.g. `jmt17.google.com`).
 * Match the whole family rather than individual numbers.
 */
const GOOGLE_FCM_FRONTEND_HOST_REGEX = /^jmt\d+\.google\.com$/;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Prevents SSRF: subscription endpoints are caller-supplied URLs that the server later sends
 * HTTP requests to, so they must point at a known push service. Browsers that use their own
 * push relay can be supported via `NOTIFICATIONS_EXTRA_PUSH_HOSTS`. Localhost endpoints are
 * allowed in non-production builds for local testing.
 */
export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!isProduction && LOCAL_HOSTS.has(url.hostname)) return true;

  if (url.protocol !== 'https:') return false;

  if (GOOGLE_FCM_FRONTEND_HOST_REGEX.test(url.hostname)) return true;

  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`)
  );
}

export const pushEndpointSchema = z
  .string()
  .url()
  .refine(isAllowedPushEndpoint, { message: 'Unsupported push endpoint' });
