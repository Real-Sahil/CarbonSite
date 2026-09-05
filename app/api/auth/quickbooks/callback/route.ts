import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { decryptCredential } from "@/lib/integrations/encryption";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const realmId = searchParams.get("realmId"); // QuickBooks company ID
  const errorParam = searchParams.get("error");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    `https://${req.headers.get("host")}`;

  if (errorParam) {
    return NextResponse.redirect(
      `${appUrl}/orgs/unknown/settings/integrations?quickbooks_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}?quickbooks_error=missing_params`);
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
    orgId = parsed.orgId;
    if (!orgId) throw new Error("missing orgId");
  } catch {
    return NextResponse.redirect(`${appUrl}?quickbooks_error=invalid_state`);
  }

  const settingsUrl = `${appUrl}/orgs/${orgId}/settings/integrations`;

  try {
    // Load credentials from IntegrationConfig (admin-entered values)
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { quickbooksClientId: true, quickbooksClientSecret: true },
    });

    const clientId = config?.quickbooksClientId || process.env.QUICKBOOKS_CLIENT_ID;
    const encryptedSecret = config?.quickbooksClientSecret;
    const clientSecret = encryptedSecret
      ? decryptCredential(encryptedSecret)
      : process.env.QUICKBOOKS_CLIENT_SECRET;
    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI || `${appUrl}/api/auth/quickbooks/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${settingsUrl}?quickbooks_error=credentials_missing`,
      );
    }

    // QuickBooks requires Basic auth header for token exchange
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
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
      },
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("[QuickBooks Callback] Token exchange failed:", text);
      return NextResponse.redirect(
        `${settingsUrl}?quickbooks_error=token_exchange_failed`,
      );
    }

    const tokens = await tokenRes.json();

    // Fetch company info to get the account name
    let companyName: string | null = null;
    if (realmId && tokens.access_token) {
      try {
        const companyRes = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              Accept: "application/json",
            },
          },
        );
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          companyName = companyData?.QueryResponse?.CompanyInfo?.[0]?.CompanyName ?? null;
        }
      } catch {
        // Non-fatal: company name is cosmetic only
      }
    }

    const scopes: string[] = tokens.scope ? tokens.scope.split(" ") : [];
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.integrationConnection.upsert({
      where: {
        organizationId_provider: { organizationId: orgId, provider: "quickbooks" },
      },
      create: {
        organizationId: orgId,
        provider: "quickbooks",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: realmId,
        externalAccountName: companyName,
        connectedAt: new Date(),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes,
        externalAccountId: realmId,
        externalAccountName: companyName,
        connectedAt: new Date(),
      },
    });

    // Also populate IntegrationConfig's token fields — this is what
    // lib/integrations/quickbooks.ts (the invoice sync engine) reads from.
    await prisma.integrationConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        quickbooksConnected: true,
        quickbooksConnectedAt: new Date(),
        quickbooksRefreshToken: tokens.refresh_token ?? null,
        quickbooksRealmId: realmId,
        quickbooksTokenExpiresAt: expiresAt,
      },
      update: {
        quickbooksConnected: true,
        quickbooksConnectedAt: new Date(),
        quickbooksRefreshToken: tokens.refresh_token ?? null,
        quickbooksRealmId: realmId,
        quickbooksTokenExpiresAt: expiresAt,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      action: "integration.connected",
      resourceType: "IntegrationConnection",
      resourceId: orgId,
      metadata: { provider: "quickbooks", realmId, companyName },
    });

    return NextResponse.redirect(`${settingsUrl}?quickbooks_success=1`);
  } catch (err) {
    console.error("[QuickBooks Callback] Error:", err);
    return NextResponse.redirect(`${settingsUrl}?quickbooks_error=unexpected_error`);
  }
}
