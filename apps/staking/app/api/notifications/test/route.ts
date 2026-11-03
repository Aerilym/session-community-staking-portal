import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { getRemoteFeatureFlag } from '@/lib/feature-flags-server';
import { DEFAULT_LOCALE } from '@/lib/locale-util';
import { pushEndpointSchema } from '@/lib/notifications/endpoint';
import { notificationsVapidConfigured } from '@/lib/notifications/env';
import { sendNotificationToEndpoint } from '@/lib/notifications/push';
import { getTranslations } from 'next-intl/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testSchema = z.object({
  endpoint: pushEndpointSchema,
});

/** Minimum milliseconds between test notifications per endpoint. */
const TEST_COOLDOWN_MS = 10_000;

const lastSentAt = new Map<string, number>();

export async function POST(request: Request) {
  if (!notificationsVapidConfigured) {
    return NextResponse.json({ error: 'Notifications are not configured' }, { status: 503 });
  }

  const { enabled } = await getRemoteFeatureFlag(REMOTE_FEATURE_FLAG.DISABLE_NODE_NOTIFICATIONS);
  if (enabled) {
    return NextResponse.json({ error: 'Notifications are disabled' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { endpoint } = parsed.data;

  const lastSent = lastSentAt.get(endpoint);
  if (lastSent && Date.now() - lastSent < TEST_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Too many test notifications' }, { status: 429 });
  }

  const dict = await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: 'notifications.push.test',
  });

  const sent = await sendNotificationToEndpoint(endpoint, {
    title: dict('title'),
    body: dict('body'),
    tag: 'test-notification',
    url: '/mystakes',
  });

  if (!sent) {
    return NextResponse.json({ error: 'No subscription found for this device' }, { status: 404 });
  }

  lastSentAt.set(endpoint, Date.now());

  return NextResponse.json({ ok: true });
}
