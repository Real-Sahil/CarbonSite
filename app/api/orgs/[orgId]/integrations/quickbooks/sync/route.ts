import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { enqueueQuickBooksSync } from "@/lib/jobs/queues";
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

    // Enqueue sync job
    await enqueueQuickBooksSync({ orgId, fromDate });

    return NextResponse.json(
      {
        status: "queued",
        message: "QuickBooks invoice sync job queued successfully",
        details: {
          orgId,
          fromDate: fromDate || null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[quickbooks-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync initiation failed",
      },
      { status: 500 }
    );
  }
}
