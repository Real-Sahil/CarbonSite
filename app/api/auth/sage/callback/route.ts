import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

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
      `${appUrl}/orgs/unknown/settings/integrations?sage_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}?sage_error=missing_params`);
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
    orgId = parsed.orgId;
    if (!orgId) throw new Error("missing orgId");
  } catch {
    return NextResponse.redirect(`${appUrl}?sage_error=invalid_state`);
  }

  const settingsUrl = `${appUrl}/orgs/${orgId}/settings/integrations`;

  try {
    const clientId = process.env.SAGE_CLIENT_ID;
    const clientSecret = process.env.SAGE_CLIENT_SECRET;
    const redirectUri =
      process.env.SAGE_REDIRECT_URI || `${appUrl}/api/auth/sage/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${settingsUrl}?sage_error=credentials_missing`,
      );
    }

    // Sage uses Basic auth for token exchange
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://oauth.accounting.sage.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("[Sage Callback] Token exchange failed:", text);
      return NextResponse.redirect(
        `${settingsUrl}?sage_error=token_exchange_failed`,
      );
    }

    const tokens = await tokenRes.json();

    // Fetch the connected business name
    let businessName: string | null = null;
    let businessId: string | null = null;
    if (tokens.access_token) {
      try {
        const businessRes = await fetch(
          "https://api.accounting.sage.com/v3.1/business",
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              Accept: "application/json",
            },
          },
        );
        if (businessRes.ok) {
          const businessData = await businessRes.json();
          businessName = businessData?.name ?? null;
          businessId = businessData?.id ?? null;
        }
      } catch {
        // Non-fatal
      }
    }

    const scopes: string[] = tokens.scope ? tokens.scope.split(" ") : [];
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    await prisma.integrationConnection.upsert({
      where: {
        organizationId_provider: { organizationId: orgId, provider: "sage" },
      },
      create: {
        organizationId: orgId,
        provider: "sage",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: businessId,
        externalAccountName: businessName,
        connectedAt: new Date(),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: businessId,
        externalAccountName: businessName,
        connectedAt: new Date(),
      },
    });

    // Also populate IntegrationConfig's token fields — this is what
    // lib/integrations/sage.ts (the invoice sync engine) reads from.
    await prisma.integrationConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        sageConnected: true,
        sageConnectedAt: new Date(),
        sageRefreshToken: tokens.refresh_token ?? null,
        sageTenantId: businessId,
        sageTokenExpiresAt: expiresAt,
      },
      update: {
        sageConnected: true,
        sageConnectedAt: new Date(),
        sageRefreshToken: tokens.refresh_token ?? null,
        sageTenantId: businessId,
        sageTokenExpiresAt: expiresAt,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      action: "integration.connected",
      resourceType: "IntegrationConnection",
      resourceId: orgId,
      metadata: { provider: "sage", businessId, businessName },
    });

    return NextResponse.redirect(`${settingsUrl}?sage_success=1`);
  } catch (err) {
    console.error("[Sage Callback] Error:", err);
    return NextResponse.redirect(`${settingsUrl}?sage_error=unexpected_error`);
  }
}
