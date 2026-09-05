import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/integrations/encryption";
import type { Prisma } from "@prisma/client";

interface XeroTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  xero_tenant_id?: string;
}

/**
 * Refresh Xero OAuth token using refresh token stored in IntegrationConfig.
 * Returns valid access token and tenant ID, or null if not configured.
 */
export async function getValidXeroToken(organizationId: string): Promise<{
  accessToken: string;
  tenantId: string;
} | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { organizationId },
    select: {
      xeroConnected: true,
      xeroRefreshToken: true,
      xeroTenantId: true,
      xeroTokenExpiresAt: true,
      xeroClientId: true,
      xeroClientSecret: true,
    },
  });

  if (!config || !config.xeroConnected || !config.xeroRefreshToken || !config.xeroTenantId) {
    return null;
  }

  // Check if token is still valid (has > 5 min remaining)
  const now = new Date();
  const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);
  if (config.xeroTokenExpiresAt && config.xeroTokenExpiresAt > refreshThreshold) {
    // Token is still valid, return it (we'll fetch fresh access token via refresh flow)
    return {
      accessToken: "", // Will be refreshed below
      tenantId: config.xeroTenantId,
    };
  }

  // Refresh the token — prefer the org's own admin-entered app credentials
  // (set via the integrations settings page), falling back to the
  // platform-wide env vars, matching how the OAuth callback resolves them.
  const clientId = config.xeroClientId || process.env.XERO_CLIENT_ID;
  const clientSecret = config.xeroClientSecret
    ? decryptCredential(config.xeroClientSecret)
    : process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Xero] XERO_CLIENT_ID or XERO_CLIENT_SECRET not configured");
    return null;
  }

  try {
    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.xeroRefreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error(`[Xero] Token refresh failed: ${tokenResponse.status}`, error);
      return null;
    }

    const tokenData: XeroTokenResponse = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 1800) * 1000);

    // Store updated tokens
    await prisma.integrationConfig.update({
      where: { organizationId },
      data: {
        xeroRefreshToken: tokenData.refresh_token || config.xeroRefreshToken,
        xeroTokenExpiresAt: newExpiresAt,
      },
    });

    return {
      accessToken: tokenData.access_token,
      tenantId: config.xeroTenantId,
    };
  } catch (error) {
    console.error(`[Xero] Token refresh error:`, error);
    return null;
  }
}

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate?: string;
  Total: number;
  Status: string;
  Contact?: {
    Name: string;
  };
  LineItems?: Array<{
    LineItemID?: string;
    Description?: string;
    UnitAmount: number;
    Quantity: number;
    LineAmount: number;
  }>;
}

/**
 * Fetch invoices from Xero API
 */
export async function fetchXeroInvoices(
  organizationId: string,
  fromDate?: string
): Promise<XeroInvoice[]> {
  const token = await getValidXeroToken(organizationId);
  if (!token) {
    throw new Error(`Xero not configured for org ${organizationId}`);
  }

  // Refresh token to get fresh access token
  const freshToken = await getValidXeroToken(organizationId);
  if (!freshToken) {
    throw new Error(`Failed to get valid Xero token for org ${organizationId}`);
  }

  // Build where clause: fetch authorized + paid invoices
  let whereClause = '(Status == "AUTHORISED" || Status == "PAID")';
  if (fromDate) {
    const date = new Date(fromDate).toISOString().split("T")[0];
    whereClause += ` && InvoiceDate >= DateTime(${date}T00:00:00)`;
  }

  try {
    const url = new URL(`${XERO_API_BASE}/Invoices`);
    url.searchParams.set("where", whereClause);
    url.searchParams.set("order", "InvoiceDate DESC");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${freshToken.accessToken}`,
        "Xero-tenant-id": token.tenantId,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { Invoices?: XeroInvoice[] };
    return data.Invoices || [];
  } catch (error) {
    console.error(`[Xero] Failed to fetch invoices for org ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Sync Xero invoices to CarbonSite database
 */
export async function syncXeroInvoices(
  organizationId: string,
  fromDate?: string
): Promise<{ created: number; updated: number; skipped: number }> {
  console.log(`[Xero Sync] Starting sync for org ${organizationId}`);

  const invoices = await fetchXeroInvoices(organizationId, fromDate);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    try {
      // Check if already synced
      const existing = await prisma.xeroSyncLog.findFirst({
        where: {
          organizationId,
          invoiceId: invoice.InvoiceID,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Parse line items
      const lineItems = (invoice.LineItems || []).map((item, idx) => ({
        itemId: item.LineItemID || `item-${idx}`,
        description: item.Description || "",
        quantityInvoiced: item.Quantity,
        unitPrice: item.UnitAmount,
        lineAmount: item.LineAmount,
      }));

      // Create or update invoice record
      const result = await prisma.invoiceRecord.upsert({
        where: {
          organizationId_sourceSystem_externalInvoiceId: {
            organizationId,
            sourceSystem: "xero",
            externalInvoiceId: invoice.InvoiceID,
          },
        },
        create: {
          organizationId,
          externalInvoiceId: invoice.InvoiceID,
          sourceSystem: "xero",
          vendorId: invoice.Contact?.Name?.substring(0, 8) || "unknown",
          vendorName: invoice.Contact?.Name || "Unknown Vendor",
          invoiceDate: new Date(invoice.InvoiceDate),
          dueDate: invoice.DueDate ? new Date(invoice.DueDate) : null,
          totalAmount: invoice.Total,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          paymentStatus: invoice.Status === "PAID" ? "paid" : "unpaid",
          scope3ReadyStatus: "pending",
          extractedAt: new Date(),
        },
        update: {
          vendorName: invoice.Contact?.Name || "Unknown Vendor",
          dueDate: invoice.DueDate ? new Date(invoice.DueDate) : null,
          totalAmount: invoice.Total,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          paymentStatus: invoice.Status === "PAID" ? "paid" : "unpaid",
          extractedAt: new Date(),
        },
      });

      // Log sync for each line item
      for (let idx = 0; idx < (invoice.LineItems || []).length; idx++) {
        const item = (invoice.LineItems || [])[idx];
        if (!item) continue;

        await prisma.xeroSyncLog.create({
          data: {
            organizationId,
            invoiceId: invoice.InvoiceID,
            invoiceNumber: invoice.InvoiceNumber,
            lineItemIndex: idx,
            supplierName: invoice.Contact?.Name || "Unknown",
            lineDescription: item.Description || "",
            amount: item.LineAmount,
            category: "s3-purchased-goods", // Default category; user can override
            status: "processed",
          },
        });
      }

      created++;
    } catch (error) {
      console.error(`[Xero Sync] Failed to sync invoice ${invoice.InvoiceID}:`, error);
      skipped++;
    }
  }

  // Anomaly detection for newly synced invoices is triggered by the caller
  // (see dispatchXeroSync in lib/jobs/dispatch.ts) so it can run inline or
  // via the queue depending on JOB_PROCESSING_MODE.

  console.log(
    `[Xero Sync] Complete: created=${created}, updated=${updated}, skipped=${skipped}`
  );

  return { created, updated, skipped };
}
