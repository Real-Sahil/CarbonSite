import { prisma } from "@/lib/db";
import { reportLogger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/db/audit";

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Status: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
  }>;
  Total: number;
  InvoiceDate: string;
  DueDate: string;
  Contact: {
    Name: string;
  };
}

interface XeroApiResponse {
  Invoices: XeroInvoice[];
}

/**
 * Syncs invoices from Xero and creates/updates activity records
 * Called periodically to fetch Scope 3 spend data for emissions calculations
 */
export async function syncXeroInvoices(orgId: string): Promise<void> {
  reportLogger.info("Starting Xero sync", { orgId });

  try {
    // Get Xero integration config
    const integration = await prisma.xeroIntegration.findUnique({
      where: { organizationId: orgId },
    });

    if (!integration) {
      reportLogger.warn("Xero integration not configured for org", { orgId });
      return;
    }

    // Check if token needs refresh
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      reportLogger.info("Refreshing Xero access token", { orgId });
      await refreshXeroToken(orgId, integration);
    }

    // Fetch invoices from Xero API
    const accessToken = Buffer.from(integration.accessToken, "base64").toString(
      "utf-8"
    );
    const invoices = await fetchXeroInvoices(accessToken);

    reportLogger.info("Fetched invoices from Xero", {
      orgId,
      invoiceCount: invoices.length,
    });

    // Process each invoice
    let created = 0;
    let updated = 0;

    for (const invoice of invoices) {
      // Validate invoice
      if (!invoice.Total || invoice.Total === 0) {
        reportLogger.debug("Skipping invoice with zero total", {
          invoiceNumber: invoice.InvoiceNumber,
        });
        continue;
      }

      // Parse invoice date
      const activityDate = new Date(invoice.InvoiceDate);
      if (isNaN(activityDate.getTime())) {
        reportLogger.warn("Invalid invoice date", {
          invoiceNumber: invoice.InvoiceNumber,
          date: invoice.InvoiceDate,
        });
        continue;
      }

      // Check if already imported
      const existing = await prisma.activityRecord.findFirst({
        where: {
          organizationId: orgId,
          sourceDescription: `xero:${invoice.InvoiceID}`,
        },
      });

      if (existing) {
        updated++;
        continue;
      }

      // Get or create supplier as facility
      let facility = await prisma.facility.findFirst({
        where: {
          organizationId: orgId,
          name: invoice.Contact.Name,
        },
      });

      if (!facility) {
        facility = await prisma.facility.create({
          data: {
            organizationId: orgId,
            name: invoice.Contact.Name,
            type: "supplier",
            headcount: 0,
          },
        });
        reportLogger.debug("Created facility for supplier", {
          facilityName: invoice.Contact.Name,
        });
      }

      // Create activity record for Scope 3 spend
      const activityRecord = await prisma.activityRecord.create({
        data: {
          organizationId: orgId,
          facilityId: facility.id,
          emissionCategoryId: "s3-purchased-goods",
          originalAmount: invoice.Total,
          originalUnit: "GBP",
          normalizedAmount: invoice.Total / 1000, // Placeholder conversion
          normalizedUnit: "tonnes",
          sourceDescription: `xero:${invoice.InvoiceID}`,
          activityDate,
          reviewStatus: "approved",
          importBatchId: null,
        },
      });

      created++;

      // Audit log
      await writeAuditLog({
        organizationId: orgId,
        action: "xero_invoice_imported",
        resourceType: "ActivityRecord",
        resourceId: activityRecord.id,
        actorUserId: null,
        details: {
          invoiceNumber: invoice.InvoiceNumber,
          supplier: invoice.Contact.Name,
          amount: invoice.Total,
        },
      });
    }

    // Update last sync time
    await prisma.xeroIntegration.update({
      where: { organizationId: orgId },
      data: { lastSyncAt: new Date() },
    });

    reportLogger.info("Xero sync completed", {
      orgId,
      created,
      updated,
      total: created + updated,
    });
  } catch (error) {
    reportLogger.error("Xero sync failed", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetches invoices from Xero API
 */
async function fetchXeroInvoices(accessToken: string): Promise<XeroInvoice[]> {
  const response = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Xero-Tenant-ID": process.env.XERO_TENANT_ID || "",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Xero API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as XeroApiResponse;
  return data.Invoices || [];
}

/**
 * Refreshes expired Xero access token using refresh token
 */
async function refreshXeroToken(
  orgId: string,
  integration: {
    refreshToken: string;
  }
): Promise<void> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Xero OAuth not configured");
  }

  const refreshToken = Buffer.from(integration.refreshToken, "base64").toString(
    "utf-8"
  );

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Xero token");
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const encryptedAccessToken = Buffer.from(data.access_token).toString(
    "base64"
  );
  const encryptedRefreshToken = Buffer.from(data.refresh_token).toString(
    "base64"
  );

  await prisma.xeroIntegration.update({
    where: { organizationId: orgId },
    data: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  reportLogger.info("Xero token refreshed", { orgId });
}
