import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { syncQuickBooksInvoices } from "@/lib/integrations/quickbooks";
import { requireFeature } from "@/lib/billing/limits";

interface SyncParams {
  orgId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<SyncParams> }
) {
  try {
    const { orgId } = await params;
    const fromDate = req.nextUrl.searchParams.get("fromDate") || undefined;

    await requireOrgMember(orgId, "admin", "editor");

    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    // Check if QuickBooks is connected
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { quickbooksConnected: true, quickbooksRealmId: true },
    });

    if (!config || !config.quickbooksConnected || !config.quickbooksRealmId) {
      return NextResponse.json(
        { error: "QuickBooks is not connected for this organization" },
        { status: 400 }
      );
    }

    // QuickBooks invoice fetching isn't built yet (no SDK integration) — call
    // the stub directly and report that honestly instead of queuing a job
    // that would silently vanish on this Vercel-only deployment.
    const result = await syncQuickBooksInvoices(orgId, fromDate);

    return NextResponse.json({
      status: "not_implemented",
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      message: "QuickBooks invoice sync isn't implemented yet. Your connection is saved, but no invoices were pulled.",
    });
  } catch (error) {
    console.error("[quickbooks-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
