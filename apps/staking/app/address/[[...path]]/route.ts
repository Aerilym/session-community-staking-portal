import { NextResponse } from 'next/server';

/**
 * Legacy /address/* routes were replaced by the SESH token explorer
 * (https://seshtoken.info/address/...). Redirect them permanently.
 *
 * Implemented as a route handler rather than a next.config redirect, and read
 * from the server-only SESH_TOKEN_EXPLORER_URL, so the destination is resolved
 * from the runtime environment instead of being baked in at build time
 * (NEXT_PUBLIC_* vars are inlined into the build by Next).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const explorerUrl = process.env.SESH_TOKEN_EXPLORER_URL ?? 'https://seshtoken.info';
  const destination = new URL(`/address/${path.join('/')}`, explorerUrl);
  return NextResponse.redirect(destination, 308);
}
