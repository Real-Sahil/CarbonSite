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

    // TODO: Implement QuickBooks sync once SDK available
    // QuickBooks API requires separate OAuth flow and API client
    return NextResponse.json(
      { error: "QuickBooks invoice sync is not yet implemented" },
      { status: 501 }
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
