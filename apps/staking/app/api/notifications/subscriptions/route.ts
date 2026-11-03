import { getAddressesForSubscription } from '@/lib/notifications/store';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  const addresses = getAddressesForSubscription(endpoint);

  return NextResponse.json({ addresses });
}
