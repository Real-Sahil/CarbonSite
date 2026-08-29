export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string; connectorId: string }> };

const UpdateConnectorSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  syncSchedule: z
    .enum(["hourly", "daily", "weekly", "manual"])
    .optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectorId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor");

    const connector = await prisma.airbiteConnector.findFirst({
      where: {
        id: connectorId,
        organizationId: orgId,
      },
      include: {
        syncLogs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!connector) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    return json(
      {
        connector: {
          id: connector.id,
          sourceSystem: connector.sourceSystem,
          displayName: connector.displayName,
          enabled: connector.enabled,
          syncSchedule: connector.syncSchedule,
          recordsSynced: connector.recordsSynced,
          lastSyncAt: connector.lastSyncAt?.toISOString() || null,
          lastSyncStatus: connector.lastSyncStatus,
          lastSyncError: connector.lastSyncError,
          failureCount: connector.failureCount,
          nextScheduledAt: connector.nextScheduledAt?.toISOString() || null,
          createdAt: connector.createdAt.toISOString(),
          updatedAt: connector.updatedAt.toISOString(),
        },
        syncLogs: connector.syncLogs.map((log) => ({
          id: log.id,
          status: log.status,
          recordsRead: log.recordsRead,
          recordsWritten: log.recordsWritten,
          errorMessage: log.errorMessage,
          duration: log.duration,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() || null,
        })),
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectorId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validated = UpdateConnectorSchema.parse(body);

    const connector = await prisma.airbiteConnector.findFirst({
      where: {
        id: connectorId,
        organizationId: orgId,
      },
    });

    if (!connector) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    const updated = await prisma.airbiteConnector.update({
      where: { id: connectorId },
      data: {
        ...(validated.displayName && { displayName: validated.displayName }),
        ...(validated.syncSchedule && { syncSchedule: validated.syncSchedule }),
        ...(validated.enabled !== undefined && { enabled: validated.enabled }),
        ...(validated.config && { config: validated.config }),
      },
    });

    return json(
      {
        connector: {
          id: updated.id,
          sourceSystem: updated.sourceSystem,
          displayName: updated.displayName,
          enabled: updated.enabled,
          syncSchedule: updated.syncSchedule,
          recordsSynced: updated.recordsSynced,
          lastSyncAt: updated.lastSyncAt?.toISOString() || null,
          lastSyncStatus: updated.lastSyncStatus,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectorId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin");

    const connector = await prisma.airbiteConnector.findFirst({
      where: {
        id: connectorId,
        organizationId: orgId,
      },
    });

    if (!connector) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    await prisma.airbiteConnector.delete({
      where: { id: connectorId },
    });

    return json(
      { message: "Connector deleted successfully" },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
