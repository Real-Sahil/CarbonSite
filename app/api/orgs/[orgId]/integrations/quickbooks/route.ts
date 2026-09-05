export const dynamic = "force-dynamic";

/**
 * QuickBooks OAuth connect/status/disconnect.
 *
 * Requires a QuickBooks developer app (client_id + client_secret) — either
 * the org's own, entered via the integrations settings page and stored
 * (encrypted) in IntegrationConfig.quickbooksClientId/quickbooksClientSecret,
 * or the platform-wide fallback below.
 * See: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization
 *
 * Environment variables (platform-wide fallback):
 *   QUICKBOOKS_CLIENT_ID
 *   QUICKBOOKS_CLIENT_SECRET
 *   QUICKBOOKS_REDIRECT_URI  (e.g. ${NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { requireFeature } from "@/lib/billing/limits";

// GET /api/orgs/[orgId]/integrations/quickbooks — return connection status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const integration = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "quickbooks" } },
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

// POST /api/orgs/[orgId]/integrations/quickbooks — initiate OAuth flow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { quickbooksClientId: true },
    });

    const clientId = config?.quickbooksClientId || process.env.QUICKBOOKS_CLIENT_ID;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      `https://${req.headers.get("host")}`;
    const redirectUri =
      process.env.QUICKBOOKS_REDIRECT_URI || `${appUrl}/api/auth/quickbooks/callback`;

    if (!clientId) {
      return apiError(
        "QUICKBOOKS_NOT_CONFIGURED",
        "QuickBooks Client ID is not configured on this server.",
        501,
      );
    }

    const state = Buffer.from(JSON.stringify({ orgId })).toString("base64url");
    const scopes = ["com.intuit.quickbooks.accounting"].join(" ");

    const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
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

// DELETE /api/orgs/[orgId]/integrations/quickbooks — disconnect
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const existing = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "quickbooks" } },
    });

    if (!existing) {
      return apiError("NOT_CONNECTED", "QuickBooks is not connected for this organisation.", 404);
    }

    await prisma.integrationConnection.delete({
      where: { organizationId_provider: { organizationId: orgId, provider: "quickbooks" } },
    });

    await prisma.integrationConfig.updateMany({
      where: { organizationId: orgId },
      data: { quickbooksConnected: false, quickbooksRefreshToken: null, quickbooksRealmId: null, quickbooksTokenExpiresAt: null },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.disconnected",
      resourceType: "IntegrationConnection",
      resourceId: existing.id,
      metadata: { provider: "quickbooks" },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
