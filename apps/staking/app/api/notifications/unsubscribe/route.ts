import { unlinkAddress } from '@/lib/notifications/store';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
  address: z.string().regex(ethereumAddressRegex).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { endpoint, address } = parsed.data;
  const removed = unlinkAddress(endpoint, address);

  return NextResponse.json({ ok: true, removed });
}
