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

    // TODO: Enqueue actual sync job with Airbyte
    // For now, simulate an async sync operation
    setImmediate(async () => {
      try {
        // Simulate sync delay
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        const recordsRead = Math.floor(Math.random() * 500) + 50;
        const recordsWritten = Math.floor(recordsRead * 0.95); // 95% success

        await prisma.airbyteSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "success",
            recordsRead,
            recordsWritten,
            completedAt: new Date()
          }
        });

        await prisma.airbiteConnector.update({
          where: { id: connectorId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "success",
            lastSyncError: null,
            recordsSynced: {
              increment: recordsWritten
            },
            failureCount: 0
          }
        });

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: null,
            action: "INTEGRATION_SYNC_COMPLETED",
            resourceType: "airbyte_connector",
            resourceId: connectorId,
            metadata: {
              recordsRead,
              recordsWritten,
              syncDuration: Date.now() - syncLog.startedAt.getTime()
            }
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await prisma.airbyteSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "failed",
            errorMessage,
            completedAt: new Date()
          }
        });

        await prisma.airbiteConnector.update({
          where: { id: connectorId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "failed",
            lastSyncError: errorMessage,
            lastFailureAt: new Date(),
            failureCount: {
              increment: 1
            }
          }
        });

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: null,
            action: "INTEGRATION_SYNC_FAILED",
            resourceType: "airbyte_connector",
            resourceId: connectorId,
            metadata: {
              error: errorMessage
            }
          }
        });
      }
    });

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

function calculateNextScheduleTime(schedule: string | null): Date {
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
      return null as any;
  }
}
