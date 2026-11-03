import { pushEndpointSchema } from '@/lib/notifications/endpoint';
import { migrateSubscriptionEndpoint } from '@/lib/notifications/store';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resubscribeSchema = z.object({
  oldEndpoint: z.string().url().nullable(),
  subscription: z.object({
    endpoint: pushEndpointSchema,
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { oldEndpoint, subscription } = parsed.data;

  if (!oldEndpoint) {
    return NextResponse.json({ error: 'Missing old endpoint' }, { status: 400 });
  }

  const migrated = migrateSubscriptionEndpoint({
    oldEndpoint,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  return NextResponse.json({ ok: migrated });
}
