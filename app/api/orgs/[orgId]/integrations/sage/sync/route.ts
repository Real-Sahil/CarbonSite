import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { syncSageInvoices } from "@/lib/integrations/sage";
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

    // Check if Sage is connected
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { sageConnected: true, sageTenantId: true },
    });

    if (!config || !config.sageConnected || !config.sageTenantId) {
      return NextResponse.json(
        { error: "Sage is not connected for this organization" },
        { status: 400 }
      );
    }

    // Sage invoice fetching isn't built yet (no SDK integration) — call the
    // stub directly and report that honestly instead of queuing a job that
    // would silently vanish on this Vercel-only deployment.
    const result = await syncSageInvoices(orgId, fromDate);

    return NextResponse.json({
      status: "not_implemented",
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      message: "Sage invoice sync isn't implemented yet. Your connection is saved, but no invoices were pulled.",
    });
  } catch (error) {
    console.error("[sage-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
