import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { decryptCredential } from "@/lib/integrations/encryption";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    `https://${req.headers.get("host")}`;

  if (errorParam) {
    return NextResponse.redirect(
      `${appUrl}/orgs/unknown/settings/integrations?xero_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}?xero_error=missing_params`);
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
    orgId = parsed.orgId;
    if (!orgId) throw new Error("missing orgId");
  } catch {
    return NextResponse.redirect(`${appUrl}?xero_error=invalid_state`);
  }

  const settingsUrl = `${appUrl}/orgs/${orgId}/settings/integrations`;

  try {
    // Load credentials from IntegrationConfig (admin-entered values)
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { xeroClientId: true, xeroClientSecret: true },
    });

    const clientId = config?.xeroClientId || process.env.XERO_CLIENT_ID;
    const encryptedSecret = config?.xeroClientSecret;
    const clientSecret = encryptedSecret
      ? decryptCredential(encryptedSecret)
      : process.env.XERO_CLIENT_SECRET;

    const redirectUri =
      process.env.XERO_REDIRECT_URI || `${appUrl}/api/auth/xero/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${settingsUrl}?xero_error=credentials_missing`,
      );
    }

    // Exchange auth code for tokens
    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("[Xero Callback] Token exchange failed:", text);
      return NextResponse.redirect(
        `${settingsUrl}?xero_error=token_exchange_failed`,
      );
    }

    const tokens = await tokenRes.json();

    // Fetch connected tenant (Xero organisation)
    const connectionsRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let tenantId: string | null = null;
    let tenantName: string | null = null;

    if (connectionsRes.ok) {
      const connections = await connectionsRes.json();
      if (connections.length > 0) {
        tenantId = connections[0].tenantId;
        tenantName = connections[0].tenantName;
      }
    }

    const scopes: string[] = tokens.scope ? tokens.scope.split(" ") : [];
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert IntegrationConnection
    await prisma.integrationConnection.upsert({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
      create: {
        organizationId: orgId,
        provider: "xero",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: tenantId,
        externalAccountName: tenantName,
        connectedAt: new Date(),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: tenantId,
        externalAccountName: tenantName,
        connectedAt: new Date(),
      },
    });

    // Mark xeroConnected in IntegrationConfig
    await prisma.integrationConfig.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, xeroConnected: true },
      update: { xeroConnected: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      action: "integration.connected",
      resourceType: "IntegrationConnection",
      resourceId: orgId,
      metadata: { provider: "xero", tenantName },
    });

    return NextResponse.redirect(`${settingsUrl}?xero_success=1`);
  } catch (err) {
    console.error("[Xero Callback] Error:", err);
    return NextResponse.redirect(`${settingsUrl}?xero_error=unexpected_error`);
  }
}
