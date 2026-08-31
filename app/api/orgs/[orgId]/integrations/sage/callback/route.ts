import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SAGE_CLIENT_ID = process.env.SAGE_CLIENT_ID || "";
const SAGE_CLIENT_SECRET = process.env.SAGE_CLIENT_SECRET || "";
const SAGE_TOKEN_URL = "https://oauth.accounts.sage.com/oauth/token";
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
    const redirectUri = `${APP_URL}/api/orgs/${orgId}/integrations/sage/callback`;
    const tokenResponse = await fetch(SAGE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: SAGE_CLIENT_ID,
        client_secret: SAGE_CLIENT_SECRET,
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
        // Sage specific fields would need to be added to schema
        // For now, storing in testResults as a workaround
        testResults: {
          sage: {
            connected: true,
            connectedAt: new Date().toISOString(),
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          },
        },
      },
      update: {
        testResults: {
          sage: {
            connected: true,
            connectedAt: new Date().toISOString(),
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          },
        },
      },
    });

    return NextResponse.redirect(
      new URL(`/orgs/${orgId}/integrations?sage=connected`, req.url)
    );
  } catch (error) {
    console.error("Sage callback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Callback failed" },
      { status: 500 }
    );
  }
}
