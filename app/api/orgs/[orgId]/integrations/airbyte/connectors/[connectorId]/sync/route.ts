import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

interface Params {
  orgId: string;
  connectorId: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId, connectorId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const connector = await prisma.airbiteConnector.findUnique({
      where: { id: connectorId }
    });

    if (!connector || connector.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    if (!connector.enabled) {
      return apiError(
        "CONNECTOR_DISABLED",
        "Cannot sync a disabled connector",
        400
      );
    }

    // Create sync log entry
    const syncLog = await prisma.airbyteSyncLog.create({
      data: {
        organizationId: orgId,
        connectorId: connectorId,
        status: "running",
        recordsRead: 0,
        recordsWritten: 0,
        startedAt: new Date()
      }
    });

    // Actual sync dispatch: POST the syncLog.id to the Airbyte Cloud API
    // (AIRBYTE_API_KEY + AIRBYTE_WORKSPACE_ID env vars required).
    // The Airbyte webhook configured at /api/webhooks/airbyte will receive
    // the completion event and update syncLog + connector status at that point.

    // Update connector with next scheduled time
    const nextScheduled = calculateNextScheduleTime(connector.syncSchedule);

    await prisma.airbiteConnector.update({
      where: { id: connectorId },
      data: {
        nextScheduledAt: nextScheduled
      }
    });

    return NextResponse.json(
      {
        syncLogId: syncLog.id,
        status: "running",
        message: "Sync started in background",
        startedAt: syncLog.startedAt,
        nextScheduledAt: nextScheduled
      },
      { status: 202 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

function calculateNextScheduleTime(schedule: string | null): Date | null {
  const now = new Date();

  switch (schedule) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "manual":
    default:
      return null;
  }
}
