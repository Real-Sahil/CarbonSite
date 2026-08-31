import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { enqueueSageSync } from "@/lib/jobs/queues";

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

    // Enqueue sync job
    await enqueueSageSync({ orgId, fromDate });

    return NextResponse.json(
      {
        status: "queued",
        message: "Sage invoice sync job queued successfully",
        details: {
          orgId,
          fromDate: fromDate || null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[sage-sync-api] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync initiation failed",
      },
      { status: 500 }
    );
  }
}
