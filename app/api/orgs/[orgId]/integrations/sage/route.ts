export const dynamic = "force-dynamic";

/**
 * Sage OAuth integration scaffold.
 *
 * Full implementation requires a Sage developer app (client_id + client_secret).
 * See: https://developer.sage.com/
 *
 * Environment variables needed:
 *   SAGE_CLIENT_ID
 *   SAGE_CLIENT_SECRET
 *   SAGE_REDIRECT_URI  (e.g. ${NEXT_PUBLIC_APP_URL}/api/auth/sage/callback)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

// GET /api/orgs/[orgId]/integrations/sage — return connection status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const integration = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "sage" } },
      select: {
        id: true,
        provider: true,
        connectedAt: true,
        externalAccountName: true,
        scopes: true,
        expiresAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      connectedAt: integration.connectedAt?.toISOString() ?? null,
      accountName: integration.externalAccountName,
      scopes: integration.scopes,
      tokenExpired: integration.expiresAt ? integration.expiresAt < new Date() : false,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/integrations/sage — initiate OAuth flow
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const clientId = process.env.SAGE_CLIENT_ID;
    const redirectUri = process.env.SAGE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return apiError(
        "SAGE_NOT_CONFIGURED",
        "Sage integration is not configured on this server.",
        501,
      );
    }

    const state = Buffer.from(JSON.stringify({ orgId })).toString("base64url");
    const scopes = [
      "full_access",
    ].join(" ");

    const authUrl = new URL("https://www.sageone.com/oauth2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/integrations/sage — disconnect
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const existing = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "sage" } },
    });

    if (!existing) {
      return apiError("NOT_CONNECTED", "Sage is not connected for this organisation.", 404);
    }

    await prisma.integrationConnection.delete({
      where: { organizationId_provider: { organizationId: orgId, provider: "sage" } },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.disconnected",
      resourceType: "IntegrationConnection",
      resourceId: existing.id,
      metadata: { provider: "sage" },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
