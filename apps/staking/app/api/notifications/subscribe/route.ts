import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { getRemoteFeatureFlag } from '@/lib/feature-flags-server';
import { pushEndpointSchema } from '@/lib/notifications/endpoint';
import { notificationsVapidConfigured } from '@/lib/notifications/env';
import { linkAddress, upsertSubscription } from '@/lib/notifications/store';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: pushEndpointSchema,
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  address: z.string().regex(ethereumAddressRegex),
});

export async function POST(request: Request) {
  if (!notificationsVapidConfigured) {
    return NextResponse.json({ error: 'Notifications are not configured' }, { status: 503 });
  }

  const { enabled } = await getRemoteFeatureFlag(REMOTE_FEATURE_FLAG.DISABLE_NODE_NOTIFICATIONS);
  if (enabled) {
    return NextResponse.json({ error: 'Notifications are disabled' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { subscription, address } = parsed.data;

  const subscriptionId = upsertSubscription({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  if (subscriptionId === null) {
    return NextResponse.json({ error: 'Subscription limit reached' }, { status: 429 });
  }

  const linked = linkAddress(subscriptionId, address);

  if (!linked) {
    return NextResponse.json({ error: 'Address limit reached for this device' }, { status: 429 });
  }

  return NextResponse.json({ ok: true });
}
