import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";

/**
 * Initiates OAuth flow with Xero
 * GET /api/integrations/xero/authorize?orgId=...
 * Redirects to Xero OAuth login
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = new URL(request.url).searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId parameter" },
        { status: 400 }
      );
    }

    // Verify user is org admin
    await requireOrgMember(orgId, "admin");

    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          error: "Xero OAuth not configured",
          details: "Set XERO_CLIENT_ID and XERO_REDIRECT_URI in environment",
        },
        { status: 500 }
      );
    }

    // Store org in session state for callback
    const state = Buffer.from(JSON.stringify({ orgId })).toString("base64");

    const xeroAuthUrl = new URL("https://login.xero.com/identity/connect/authorize");
    xeroAuthUrl.searchParams.set("response_type", "code");
    xeroAuthUrl.searchParams.set("client_id", clientId);
    xeroAuthUrl.searchParams.set("redirect_uri", redirectUri);
    xeroAuthUrl.searchParams.set("scope", "offline_access accounting.transactions.read");
    xeroAuthUrl.searchParams.set("state", state);

    return NextResponse.redirect(xeroAuthUrl.toString());
  } catch (error) {
    console.error("[xero-authorize] Error:", error);
    return NextResponse.json(
      {
        error: "Authorization failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
