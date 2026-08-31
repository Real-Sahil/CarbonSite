import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || "";
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || "";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface CallbackParams {
  orgId: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<CallbackParams> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing authorization code or state" },
        { status: 400 }
      );
    }

    // Decode state to verify it contains our orgId
    const decodedState = JSON.parse(
      Buffer.from(state, "base64").toString("utf-8")
    );

    if (decodedState.orgId !== orgId) {
      return NextResponse.json(
        { error: "State mismatch" },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const redirectUri = `${APP_URL}/api/orgs/${orgId}/integrations/xero/callback`;
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: XERO_CLIENT_ID,
        client_secret: XERO_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return NextResponse.json(
        { error: "Token exchange failed" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Extract tenant ID from token response
    const tenantId = tokenData.xero_tenant_id || tokenData.tenant_id;

    // Store the integration config
    await prisma.integrationConfig.upsert({
      where: {
        organizationId: orgId,
      },
      create: {
        organizationId: orgId,
        xeroConnected: true,
        xeroConnectedAt: new Date(),
        xeroRefreshToken: tokenData.refresh_token,
        xeroTenantId: tenantId,
        xeroTokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 1800) * 1000),
      },
      update: {
        xeroConnected: true,
        xeroConnectedAt: new Date(),
        xeroRefreshToken: tokenData.refresh_token,
        xeroTenantId: tenantId,
        xeroTokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 1800) * 1000),
      },
    });

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL(`/orgs/${orgId}/integrations?xero=connected`, req.url)
    );
  } catch (error) {
    console.error("Xero callback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Callback failed" },
      { status: 500 }
    );
  }
}
