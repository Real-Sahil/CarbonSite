import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/integrations/encryption";

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
      externalAccountId: true,
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
    if (!connection.accessToken || !connection.externalAccountId) {
      return null;
    }
    return {
      accessToken: connection.accessToken,
      tenantId: connection.externalAccountId,
    };
  }

  // Token is expired or expiring soon, try to refresh
  if (!connection.refreshToken) {
    console.error(`[Xero Token Refresh] No refresh token available for org ${organizationId}`);
    return null;
  }

  try {
    // Prefer credentials from IntegrationConfig (admin-entered), fall back to env vars
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId },
      select: { xeroClientId: true, xeroClientSecret: true },
    });

    const clientId = config?.xeroClientId || process.env.XERO_CLIENT_ID;
    const encryptedSecret = config?.xeroClientSecret;
    const clientSecret = encryptedSecret
      ? decryptCredential(encryptedSecret)
      : process.env.XERO_CLIENT_SECRET;

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
      },
    });

    if (!connection.externalAccountId) {
      return null;
    }

    return {
      accessToken: newTokens.access_token,
      tenantId: connection.externalAccountId,
    };
  } catch (error) {
    console.error(`[Xero Token Refresh] Error:`, error);
    return null;
  }
}

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Date: string;
  DueDate: string;
  Total: number;
  Status: string;
  Contact: {
    Name: string;
  };
  LineItems: Array<{
    Description: string;
    UnitAmount: number;
    Quantity: number;
    LineAmount: number;
  }>;
}

/**
 * Map Xero invoice to activity record, detecting category from line item description.
 */
function mapXeroInvoiceToCategory(
  lineDescription: string
): "s3-purchased-goods" | "s3-upstream-transport" | "s1-stationary" | null {
  const description = lineDescription.toLowerCase();

  if (
    description.includes("fuel") ||
    description.includes("petrol") ||
    description.includes("diesel") ||
    description.includes("transport")
  ) {
    return "s3-upstream-transport";
  }

  if (
    description.includes("material") ||
    description.includes("supplies") ||
    description.includes("equipment") ||
    description.includes("component")
  ) {
    return "s3-purchased-goods";
  }

  if (
    description.includes("utilities") ||
    description.includes("energy") ||
    description.includes("electricity")
  ) {
    return "s1-stationary";
  }

  return null;
}

/**
 * Fetch invoices from Xero and convert to activity records.
 * Creates ActivityRecord rows from authorized invoices, deduplicating by external ID.
 */
export async function syncXeroBillsToActivityRecords(
  organizationId: string,
  fromDate?: Date
): Promise<{ synced: number; failed: number }> {
  // TODO: Phase 2 feature — invoice sync and anomaly detection
  // Requires: XeroInvoiceRecord, InvoiceAnomaly tables, and corrected ActivityRecord schema mapping
  // Fields need updates: use sourceDescription (not description), amount (not quantity/emissionValue), correct reviewStatus enum
  console.log(`[Xero Sync] Sync deferred for org ${organizationId}`);
  return { synced: 0, failed: 0 };
}
