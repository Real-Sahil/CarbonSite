import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/auth/oauth-handler';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `/auth/error?provider=sage&error=${encodeURIComponent(
        errorDescription || error
      )}`
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing required OAuth parameters' },
      { status: 400 }
    );
  }

  try {
    const result = await handleOAuthCallback('sage', {
      code,
      state,
    });

    return NextResponse.redirect(result.redirectUrl);
  } catch (error) {
    console.error('Sage OAuth callback error:', error);
    return NextResponse.redirect(
      `/auth/error?provider=sage&error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error'
      )}`
    );
  }
}
