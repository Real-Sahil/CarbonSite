import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * OAuth callback from Xero
 * GET /api/integrations/xero/callback?code=...&state=...
 * Exchanges code for access token and stores in database
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.json(
        { error: `Xero OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    // Decode state to get orgId
    let orgId: string;
    try {
      const decodedState = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8")
      );
      orgId = decodedState.orgId;
    } catch {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Exchange code for token
    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[xero-callback] Missing Xero configuration");
      return NextResponse.json(
        {
          error: "Xero OAuth not configured on server",
          details: "Contact your administrator",
        },
        { status: 500 }
      );
    }

    const response = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[xero-callback] Token exchange failed:", errorBody);
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const tokenData = (await response.json()) as XeroTokenResponse;

    // Encrypt tokens before storing (simple base64; in production use proper encryption)
    const encryptedAccessToken = Buffer.from(tokenData.access_token).toString(
      "base64"
    );
    const encryptedRefreshToken = Buffer.from(tokenData.refresh_token).toString(
      "base64"
    );

    // Store or update integration
    await prisma.xeroIntegration.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        lastSyncAt: null,
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/orgs/${orgId}/settings/integrations?xero=connected`,
      302
    );
  } catch (error) {
    console.error("[xero-callback] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
