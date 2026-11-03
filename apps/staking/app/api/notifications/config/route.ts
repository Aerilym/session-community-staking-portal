import { NOTIFICATIONS_VAPID_PUBLIC_KEY } from '@/lib/notifications/env';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public VAPID key for the service worker's push subscription renewal
 * (`pushsubscriptionchange` cannot access build-time env inlining).
 */
export function GET() {
  return NextResponse.json({ publicKey: NOTIFICATIONS_VAPID_PUBLIC_KEY ?? null });
}
