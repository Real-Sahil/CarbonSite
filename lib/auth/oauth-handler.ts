import { prisma } from '@/lib/db';

interface OAuthCallbackParams {
  code?: string;
  state: string;
  realmId?: string;
}

export async function handleOAuthCallback(
  provider: 'quickbooks' | 'sage' | 'xero',
  params: OAuthCallbackParams
) {
  const { code, state, realmId } = params;

  // Decode state to get orgId and userId
  let orgId: string;
  let userId: string;

  try {
    const decodedState = Buffer.from(state, 'base64url').toString('utf-8');
    const stateData = JSON.parse(decodedState);
    orgId = stateData.orgId;
    userId = stateData.userId;
  } catch (error) {
    throw new Error('Invalid state parameter');
  }

  // Get OAuth tokens from provider
  let accessToken: string;
  let refreshToken: string | undefined;
  let expiresIn: number | undefined;

  if (provider === 'quickbooks') {
    if (!code) throw new Error('Missing authorization code');
    const tokenResponse = await exchangeQuickBooksCode(code);
    accessToken = tokenResponse.access_token;
    refreshToken = tokenResponse.refresh_token;
    expiresIn = tokenResponse.expires_in;
  } else if (provider === 'sage') {
    if (!code) throw new Error('Missing authorization code');
    const tokenResponse = await exchangeSageCode(code);
    accessToken = tokenResponse.access_token;
    refreshToken = tokenResponse.refresh_token;
    expiresIn = tokenResponse.expires_in;
  } else if (provider === 'xero') {
    if (!code) throw new Error('Missing authorization code');
    const tokenResponse = await exchangeXeroCode(code);
    accessToken = tokenResponse.access_token;
    refreshToken = tokenResponse.refresh_token;
    expiresIn = tokenResponse.expires_in;
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Store integration connection in database
  await prisma.integrationConnection.upsert({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider: provider.toUpperCase(),
      },
    },
    create: {
      organizationId: orgId,
      provider: provider.toUpperCase(),
      externalAccountId: realmId || null,
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      connectedAt: new Date(),
    },
    update: {
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      externalAccountId: realmId || undefined,
    },
  });

  // Log the connection to audit log
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      action: `${provider.toUpperCase()}_OAUTH_CONNECTED`,
      actorUserId: userId,
      resourceId: orgId,
      resourceType: 'INTEGRATION',
      metadata: {
        provider,
        externalAccountId: realmId || null,
        connectedAt: new Date().toISOString(),
      },
      ipAddress: null,
      userAgent: null,
    },
  });

  // Return redirect URL
  return {
    redirectUrl: `/orgs/${orgId}/settings/integrations?provider=${provider}&status=connected`,
  };
}

async function exchangeQuickBooksCode(code: string) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks OAuth credentials not configured');
  }

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`QuickBooks token exchange failed: ${error}`);
  }

  return response.json();
}

async function exchangeSageCode(code: string) {
  const clientId = process.env.SAGE_CLIENT_ID;
  const clientSecret = process.env.SAGE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sage/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Sage OAuth credentials not configured');
  }

  const response = await fetch('https://oauth.accounting.sage.com/oauth/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sage token exchange failed: ${error}`);
  }

  return response.json();
}

async function exchangeXeroCode(code: string) {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Xero OAuth credentials not configured');
  }

  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero token exchange failed: ${error}`);
  }

  return response.json();
}
