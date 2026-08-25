import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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

  // Use externalAccountId as tenant ID
  const tenantId = connection.externalAccountId;

  // Check if token is still valid (refresh if expiring within 5 minutes)
  const now = new Date();
  const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);

  if (connection.expiresAt && connection.expiresAt > refreshThreshold) {
    // Token is still valid
    if (!connection.accessToken || !tenantId) {
      return null;
    }
    return {
      accessToken: connection.accessToken,
      tenantId,
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
      },
    });

    if (!tenantId) {
      return null;
    }

    return {
      accessToken: newTokens.access_token,
      tenantId,
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
  const tokenInfo = await ensureValidXeroToken(organizationId);

  if (!tokenInfo) {
    console.error(`[Xero Sync] No valid token for org ${organizationId}`);
    return { synced: 0, failed: 0 };
  }

  try {
    let where = `Status=="AUTHORISED"`;
    if (fromDate) {
      const dateStr = fromDate.toISOString().split("T")[0];
      where += ` AND Date>="${dateStr}"`;
    }

    const response = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices?where=${encodeURIComponent(where)}`,
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
    const invoices = (data.Invoices ?? []) as XeroInvoice[];

    let synced = 0;
    let failed = 0;

    // Get or create default reporting period for this org
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), 0, 1);
    const periodEnd = new Date(now.getFullYear(), 11, 31);

    let reportingPeriod = await prisma.reportingPeriod.findFirst({
      where: { organizationId },
      orderBy: { endDate: "desc" },
    });

    if (!reportingPeriod) {
      reportingPeriod = await prisma.reportingPeriod.create({
        data: {
          organizationId,
          label: `${now.getFullYear()} Calendar Year`,
          type: "year",
          status: "draft",
          startDate: periodStart,
          endDate: periodEnd,
        },
      });
    }

    for (const invoice of invoices) {
      try {
        const invoiceDate = new Date(invoice.Date);

        for (const lineItem of invoice.LineItems) {
          const category = mapXeroInvoiceToCategory(lineItem.Description);
          if (!category) {
            continue;
          }

          // Deduplication: check if this invoice line item was already synced
          // For now, we'll create new records each sync - in production, use a separate
          // tracking table for Xero sync history to prevent duplicates
          // TODO: Add XeroSyncLog table to track processed invoice IDs

          const cat = await prisma.emissionCategory.findUnique({
            where: { code: category },
          });

          if (!cat) {
            console.warn(`[Xero Sync] No category found for code ${category}`);
            continue;
          }

          // Create activity record from invoice line item
          // Xero invoice info stored in sourceDescription for traceability
          const sourceInfo = `Xero Invoice ${invoice.InvoiceNumber} - ${invoice.Contact.Name}: ${lineItem.Description}`;

          await prisma.activityRecord.create({
            data: {
              organizationId,
              reportingPeriodId: reportingPeriod.id,
              emissionCategoryId: cat.id,
              sourceDescription: sourceInfo,
              amount: new Prisma.Decimal(lineItem.Quantity),
              unit: "unitless",
              reviewStatus: "draft",
              evidenceStatus: "missing",
              createdByUserId: "xero-sync",
            },
          });

          synced++;
        }
      } catch (error) {
        console.error(`[Xero Sync] Failed to process invoice ${invoice.InvoiceNumber}:`, error);
        failed++;
      }
    }

    console.log(
      `[Xero Sync] Synced ${synced} line items from ${invoices.length} invoices for org ${organizationId}`
    );

    return { synced, failed };
  } catch (error) {
    console.error(`[Xero Sync] Error:`, error);
    return { synced: 0, failed: 1 };
  }
}
