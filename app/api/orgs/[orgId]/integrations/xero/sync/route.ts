import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { dispatchXeroSync } from "@/lib/jobs/dispatch";
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
    await requireOrgMember(orgId, "admin", "editor");

    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    // Check if Xero is connected
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
      select: { xeroConnected: true, xeroTenantId: true },
    });

    if (!config || !config.xeroConnected || !config.xeroTenantId) {
      return NextResponse.json(
        { error: "Xero is not connected for this organization" },
        { status: 400 }
      );
    }

    // Get optional fromDate query parameter
    const url = new URL(req.url);
    const fromDate = url.searchParams.get("fromDate") || undefined;

    const result = await dispatchXeroSync({ orgId, fromDate });

    if (result.status === "queued") {
      return NextResponse.json({
        status: "queued",
        message: "Xero invoice sync queued for the worker process",
        details: { orgId, fromDate: fromDate || null, timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      status: "processed",
      synced: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      message: `Xero sync complete: ${result.created} new, ${result.updated} updated, ${result.skipped} skipped.`,
    });
  } catch (error) {
    console.error("[xero-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
