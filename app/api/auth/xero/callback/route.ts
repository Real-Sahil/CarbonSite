import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export const dynamic = "force-dynamic";

interface XeroTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface XeroConnectionResponse {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors from Xero
    if (error) {
      const errorDescription = searchParams.get("error_description") ?? "Unknown error";
      console.error(`[Xero OAuth] Error: ${error} - ${errorDescription}`);
      return NextResponse.redirect(
        new URL(`/integrations/xero?error=${encodeURIComponent(error)}`, request.nextUrl.origin)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/integrations/xero?error=missing_params", request.nextUrl.origin)
      );
    }

    // Decode state to get orgId
    let orgId: string;
    try {
      orgId = JSON.parse(Buffer.from(state, "base64url").toString()).orgId;
    } catch {
      return NextResponse.redirect(
        new URL("/integrations/xero?error=invalid_state", request.nextUrl.origin)
      );
    }

    // Exchange code for tokens
    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL("/integrations/xero?error=server_not_configured", request.nextUrl.origin)
      );
    }

    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[Xero Token Exchange] Failed: ${tokenResponse.status}`, errorText);
      return NextResponse.redirect(
        new URL("/integrations/xero?error=token_exchange_failed", request.nextUrl.origin)
      );
    }

    const tokens = (await tokenResponse.json()) as XeroTokenResponse;

    // Get tenant ID (Xero Org ID) from ID token
    // In production, decode and verify the JWT properly
    // For now, we'll fetch the connections to get the org info
    const connectionsResponse = await fetch("https://api.xero.com/connections", {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
      },
    });

    if (!connectionsResponse.ok) {
      console.error(
        `[Xero Connections] Failed: ${connectionsResponse.status}`,
        await connectionsResponse.text()
      );
      return NextResponse.redirect(
        new URL("/integrations/xero?error=connections_fetch_failed", request.nextUrl.origin)
      );
    }

    const connections = (await connectionsResponse.json()) as XeroConnectionResponse[];

    if (!connections.length) {
      console.error("[Xero Connections] No connections found");
      return NextResponse.redirect(
        new URL("/integrations/xero?error=no_connections", request.nextUrl.origin)
      );
    }

    const firstConnection = connections[0];
    const tenantId = firstConnection.id;
    const accountName = firstConnection.name;

    // Store the connection in the database
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existingConnection = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
    });

    if (existingConnection) {
      // Update existing connection
      await prisma.integrationConnection.update({
        where: { id: existingConnection.id },
        data: {
          externalTenantId: tenantId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existingConnection.refreshToken,
          tokenType: tokens.token_type,
          scopes: tokens.scope.split(" "),
          expiresAt,
          connectedAt: new Date(),
          externalAccountName: accountName,
          metadata: {
            ...((existingConnection.metadata as Record<string, unknown>) ?? {}),
            lastTokenRefresh: new Date().toISOString(),
          },
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        action: "integration.connected",
        resourceType: "IntegrationConnection",
        resourceId: existingConnection.id,
        metadata: {
          provider: "xero",
          tenantId,
          accountName,
          action: "reconnected",
        },
      });
    } else {
      // Create new connection
      const connection = await prisma.integrationConnection.create({
        data: {
          organizationId: orgId,
          provider: "xero",
          externalTenantId: tenantId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenType: tokens.token_type,
          scopes: tokens.scope.split(" "),
          expiresAt,
          connectedAt: new Date(),
          externalAccountName: accountName,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        action: "integration.connected",
        resourceType: "IntegrationConnection",
        resourceId: connection.id,
        metadata: {
          provider: "xero",
          tenantId,
          accountName,
        },
      });
    }

    return NextResponse.redirect(
      new URL(`/integrations/xero?success=true`, request.nextUrl.origin)
    );
  } catch (error) {
    console.error("[Xero Callback] Unexpected error:", error);
    return handleRouteError(error);
  }
}
