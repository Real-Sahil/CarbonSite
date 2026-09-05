export const dynamic = "force-dynamic";

/**
 * Xero OAuth integration scaffold.
 *
 * Full implementation requires a Xero developer app (client_id + client_secret).
 * See: https://developer.xero.com/documentation/guides/oauth2/auth-flow/
 *
 * Environment variables needed:
 *   XERO_CLIENT_ID
 *   XERO_CLIENT_SECRET
 *   XERO_REDIRECT_URI  (e.g. ${NEXT_PUBLIC_APP_URL}/api/auth/xero/callback)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { requireFeature } from "@/lib/billing/limits";

// GET /api/orgs/[orgId]/integrations/xero — return connection status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const integration = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
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

// POST /api/orgs/[orgId]/integrations/xero — initiate OAuth flow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    // Read credentials from IntegrationConfig (admin-entered via settings page)
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { xeroClientId: true },
    });

    const clientId = config?.xeroClientId || process.env.XERO_CLIENT_ID;

    // Build redirect URI from app URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      `https://${req.headers.get("host")}`;
    const redirectUri =
      process.env.XERO_REDIRECT_URI || `${appUrl}/api/auth/xero/callback`;

    if (!clientId) {
      return apiError(
        "XERO_NOT_CONFIGURED",
        "Xero Client ID is not configured. Please add it in Integration Settings first.",
        400,
      );
    }

    // Encode orgId in state so the callback knows which org to associate the token with
    const state = Buffer.from(JSON.stringify({ orgId })).toString("base64url");
    const scopes = [
      "openid",
      "profile",
      "email",
      "accounting.transactions.read",
      "accounting.contacts.read",
    ].join(" ");

    const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/integrations/xero — disconnect
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const existing = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
    });

    if (!existing) {
      return apiError("NOT_CONNECTED", "Xero is not connected for this organisation.", 404);
    }

    await prisma.integrationConnection.delete({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
    });

    await prisma.integrationConfig.updateMany({
      where: { organizationId: orgId },
      data: { xeroConnected: false, xeroRefreshToken: null, xeroTenantId: null, xeroTokenExpiresAt: null },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.disconnected",
      resourceType: "IntegrationConnection",
      resourceId: existing.id,
      metadata: { provider: "xero" },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
