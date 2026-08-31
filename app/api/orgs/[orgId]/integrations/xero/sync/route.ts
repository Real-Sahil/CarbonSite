export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { ensureValidXeroToken } from "@/lib/integrations/xero";

// POST /api/orgs/[orgId]/integrations/xero/sync — trigger invoice sync
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const xero = await ensureValidXeroToken(orgId);
    if (!xero) {
      return apiError(
        "XERO_NOT_CONNECTED",
        "Xero is not connected. Please connect your Xero account first.",
        400,
      );
    }

    // Fetch invoices from Xero (last 90 days)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);
    const since = sinceDate.toISOString().split("T")[0];

    const xeroRes = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices?where=Type=="ACCPAY"&DateFrom=${since}&pageSize=100`,
      {
        headers: {
          Authorization: `Bearer ${xero.accessToken}`,
          "Xero-tenant-id": xero.tenantId,
          Accept: "application/json",
        },
      },
    );

    if (!xeroRes.ok) {
      const text = await xeroRes.text();
      console.error("[Xero Sync] Fetch invoices failed:", text);
      return apiError("XERO_API_ERROR", "Failed to fetch invoices from Xero", 502);
    }

    const data = await xeroRes.json();
    const invoices = data.Invoices ?? [];

    let created = 0;
    let skipped = 0;

    for (const inv of invoices) {
      const externalId = inv.InvoiceID;
      if (!externalId) { skipped++; continue; }

      await prisma.invoiceRecord.upsert({
        where: {
          organizationId_sourceSystem_externalInvoiceId: {
            organizationId: orgId,
            sourceSystem: "xero",
            externalInvoiceId: externalId,
          },
        },
        create: {
          organizationId: orgId,
          externalInvoiceId: externalId,
          vendorId: inv.Contact?.ContactID ?? "unknown",
          vendorName: inv.Contact?.Name ?? "Unknown Vendor",
          invoiceDate: new Date(inv.Date ?? Date.now()),
          receivedDate: inv.FullyPaidOnDate ? new Date(inv.FullyPaidOnDate) : null,
          totalAmount: inv.Total ?? 0,
          lineItems: inv.LineItems ?? [],
          sourceSystem: "xero",
          extractedAt: new Date(),
        },
        update: {
          totalAmount: inv.Total ?? 0,
          lineItems: inv.LineItems ?? [],
          receivedDate: inv.FullyPaidOnDate ? new Date(inv.FullyPaidOnDate) : null,
        },
      });
      created++;
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.connected",
      resourceType: "InvoiceRecord",
      resourceId: orgId,
      metadata: { created, skipped, total: invoices.length },
    });

    return NextResponse.json({ synced: created, skipped, total: invoices.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
