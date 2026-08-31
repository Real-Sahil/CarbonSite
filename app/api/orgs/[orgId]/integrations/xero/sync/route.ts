import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { enqueueXeroSync } from "@/lib/jobs/queues";

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

    // Enqueue sync job
    await enqueueXeroSync({
      orgId,
      fromDate,
    });

    return NextResponse.json({
      status: "queued",
      message: "Xero invoice sync initiated",
      details: {
        orgId,
        fromDate: fromDate || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[xero-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync initiation failed",
      },
      { status: 500 }
    );
  }
}
