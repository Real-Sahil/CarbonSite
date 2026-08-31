import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || "";
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || "";
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface AuthorizeParams {
  orgId: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<AuthorizeParams> }
) {
  try {
    const { orgId } = await params;
    const user = await requireOrgMember(orgId, "admin", "editor");

    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "Xero integration not configured" },
        { status: 500 }
      );
    }

    const state = Buffer.from(JSON.stringify({ orgId, userId: user.session.user.id })).toString("base64");
    const scope = "offline_access openid profile email accounting.transactions accounting.settings";
    const redirectUri = `${APP_URL}/api/auth/xero/callback`;

    const authUrl = new URL(XERO_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", XERO_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Xero authorize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authorization failed" },
      { status: 500 }
    );
  }
}
