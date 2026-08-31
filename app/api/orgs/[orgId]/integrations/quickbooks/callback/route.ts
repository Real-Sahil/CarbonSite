import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "";
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "";
const QUICKBOOKS_TOKEN_URL = "https://quickbooks.api.intuit.com/oauth2/tokens";
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
    const realmId = searchParams.get("realmId");

    if (!code || !state || !realmId) {
      return NextResponse.json(
        { error: "Missing authorization code, state, or realm ID" },
        { status: 400 }
      );
    }

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
    const redirectUri = `${APP_URL}/api/orgs/${orgId}/integrations/quickbooks/callback`;
    const tokenResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
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

    // Store the integration config
    await prisma.integrationConfig.upsert({
      where: {
        organizationId: orgId,
      },
      create: {
        organizationId: orgId,
        // QuickBooks specific fields would need to be added to schema
        // For now, storing in testResults as a workaround
        testResults: {
          quickbooks: {
            connected: true,
            realmId,
            refreshToken: tokenData.refresh_token,
            connectedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          },
        },
      },
      update: {
        testResults: {
          quickbooks: {
            connected: true,
            realmId,
            refreshToken: tokenData.refresh_token,
            connectedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          },
        },
      },
    });

    return NextResponse.redirect(
      new URL(`/orgs/${orgId}/integrations?quickbooks=connected`, req.url)
    );
  } catch (error) {
    console.error("QuickBooks callback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Callback failed" },
      { status: 500 }
    );
  }
}
