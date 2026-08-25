import { prisma } from "@/lib/db";

interface XeroTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Ensure Xero access token is valid, refreshing if necessary.
 * Returns the current valid access token and tenant ID.
 */
export async function ensureValidXeroToken(organizationId: string): Promise<{
  accessToken: string;
  tenantId: string;
} | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider: "xero" } },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      externalTenantId: true,
      metadata: true,
    },
  });

  if (!connection) {
    return null;
  }

  // Check if token is still valid (refresh if expiring within 5 minutes)
  const now = new Date();
  const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);

  if (connection.expiresAt && connection.expiresAt > refreshThreshold) {
    // Token is still valid
    if (!connection.accessToken || !connection.externalTenantId) {
      return null;
    }
    return {
      accessToken: connection.accessToken,
      tenantId: connection.externalTenantId,
    };
  }

  // Token is expired or expiring soon, try to refresh
  if (!connection.refreshToken) {
    console.error(`[Xero Token Refresh] No refresh token available for org ${organizationId}`);
    return null;
  }

  try {
    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[Xero Token Refresh] Xero credentials not configured");
      return null;
    }

    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        `[Xero Token Refresh] Failed: ${tokenResponse.status}`,
        errorText
      );
      return null;
    }

    const newTokens = (await tokenResponse.json()) as XeroTokenResponse;
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

    // Update the connection with new tokens
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token ?? connection.refreshToken,
        expiresAt,
        metadata: {
          ...((connection.metadata as Record<string, unknown>) ?? {}),
          lastTokenRefresh: new Date().toISOString(),
        },
      },
    });

    if (!connection.externalTenantId) {
      return null;
    }

    return {
      accessToken: newTokens.access_token,
      tenantId: connection.externalTenantId,
    };
  } catch (error) {
    console.error(`[Xero Token Refresh] Error:`, error);
    return null;
  }
}

/**
 * Fetch invoices from Xero and convert to activity records.
 * This is a placeholder that can be expanded based on requirements.
 */
export async function syncXeroBillsToActivityRecords(
  organizationId: string,
  fromDate?: Date
): Promise<{ synced: number; failed: number }> {
  const tokenInfo = await ensureValidXeroToken(organizationId);

  if (!tokenInfo) {
    console.error(`[Xero Sync] No valid token for org ${organizationId}`);
    return { synced: 0, failed: 0 };
  }

  try {
    const params = new URLSearchParams({
      where: `Status=="AUTHORISED"`,
    });

    if (fromDate) {
      const dateStr = fromDate.toISOString().split("T")[0];
      params.append("where", `DueDate>="${dateStr}"`);
    }

    const response = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices?${params.toString()}`,
      {
        headers: {
          "Authorization": `Bearer ${tokenInfo.accessToken}`,
          "Xero-tenant-id": tokenInfo.tenantId,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[Xero Sync] Failed to fetch invoices: ${response.status}`);
      return { synced: 0, failed: 0 };
    }

    const data = await response.json();
    const invoices = data.Invoices ?? [];

    // TODO: Convert Xero invoices to activity records
    // This would involve:
    // 1. Mapping Xero line items to emission categories
    // 2. Creating ActivityRecord rows
    // 3. Handling currency conversion if needed
    // 4. Storing sync metadata for deduplication

    console.log(`[Xero Sync] Fetched ${invoices.length} invoices for org ${organizationId}`);

    return { synced: invoices.length, failed: 0 };
  } catch (error) {
    console.error(`[Xero Sync] Error:`, error);
    return { synced: 0, failed: 1 };
  }
}
