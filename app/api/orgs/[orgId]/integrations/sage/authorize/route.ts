import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";

const SAGE_CLIENT_ID = process.env.SAGE_CLIENT_ID || "";
const SAGE_CLIENT_SECRET = process.env.SAGE_CLIENT_SECRET || "";
const SAGE_AUTH_URL = "https://oauth.accounts.sage.com/oauth/authorize";
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

    if (!SAGE_CLIENT_ID || !SAGE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "Sage integration not configured" },
        { status: 500 }
      );
    }

    const state = Buffer.from(JSON.stringify({ orgId, userId: user.session.user.id })).toString("base64");
    const scope = "full_access";
    const redirectUri = `${APP_URL}/api/auth/sage/callback`;

    const authUrl = new URL(SAGE_AUTH_URL);
    authUrl.searchParams.set("client_id", SAGE_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Sage authorize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authorization failed" },
      { status: 500 }
    );
  }
}
