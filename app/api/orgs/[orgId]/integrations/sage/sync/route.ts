import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

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

    // TODO: Implement Sage sync once SDK available
    // Sage API requires separate OAuth flow and API client
    return NextResponse.json(
      { error: "Sage invoice sync is not yet implemented" },
      { status: 501 }
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
