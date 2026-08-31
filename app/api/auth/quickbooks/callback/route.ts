import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/auth/oauth-handler';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const realmId = searchParams.get('realmId');
  const state = searchParams.get('state');

  if (!code || !realmId || !state) {
    return NextResponse.json(
      { error: 'Missing required OAuth parameters' },
      { status: 400 }
    );
  }

  try {
    const result = await handleOAuthCallback('quickbooks', {
      code,
      realmId,
      state,
    });

    return NextResponse.redirect(result.redirectUrl);
  } catch (error) {
    console.error('QuickBooks OAuth callback error:', error);
    return NextResponse.redirect(
      `/auth/error?provider=quickbooks&error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error'
      )}`
    );
  }
}
