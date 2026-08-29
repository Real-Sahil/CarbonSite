import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const UpdateConnectorSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  syncSchedule: z.enum(["hourly", "daily", "weekly", "manual"]).optional(),
  config: z.record(z.any()).optional()
});

interface Params {
  orgId: string;
  connectorId: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId, connectorId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const connector = await prisma.airbiteConnector.findUnique({
      where: { id: connectorId },
      include: {
        syncLogs: {
          orderBy: { startedAt: "desc" },
          take: 10
        }
      }
    });

    if (!connector || connector.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    return NextResponse.json({
      id: connector.id,
      sourceSystem: connector.sourceSystem,
      displayName: connector.displayName,
      enabled: connector.enabled,
      syncSchedule: connector.syncSchedule,
      config: connector.config,
      recordsSynced: connector.recordsSynced,
      lastSyncAt: connector.lastSyncAt,
      lastSyncStatus: connector.lastSyncStatus,
      lastSyncError: connector.lastSyncError,
      failureCount: connector.failureCount,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
      recentSyncs: connector.syncLogs
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId, connectorId } = await params;
    await requireOrgMember(orgId, "admin");

    const connector = await prisma.airbiteConnector.findUnique({
      where: { id: connectorId }
    });

    if (!connector || connector.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    const body = await req.json();
    const validated = UpdateConnectorSchema.parse(body);

    const updated = await prisma.airbiteConnector.update({
      where: { id: connectorId },
      data: {
        ...(validated.displayName && { displayName: validated.displayName }),
        ...(validated.enabled !== undefined && { enabled: validated.enabled }),
        ...(validated.syncSchedule && { syncSchedule: validated.syncSchedule }),
        ...(validated.config && { config: validated.config })
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: null,
        action: "INTEGRATION_CONNECTOR_UPDATED",
        resourceType: "airbyte_connector",
        resourceId: connectorId,
        metadata: validated,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined
      }
    });

    return NextResponse.json({
      id: updated.id,
      sourceSystem: updated.sourceSystem,
      displayName: updated.displayName,
      enabled: updated.enabled,
      syncSchedule: updated.syncSchedule,
      recordsSynced: updated.recordsSynced,
      lastSyncAt: updated.lastSyncAt,
      lastSyncStatus: updated.lastSyncStatus,
      updatedAt: updated.updatedAt
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId, connectorId } = await params;
    await requireOrgMember(orgId, "admin");

    const connector = await prisma.airbiteConnector.findUnique({
      where: { id: connectorId }
    });

    if (!connector || connector.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    await prisma.airbiteConnector.delete({
      where: { id: connectorId }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: null,
        action: "INTEGRATION_CONNECTOR_DELETED",
        resourceType: "airbyte_connector",
        resourceId: connectorId,
        metadata: {
          deleted: true,
          sourceSystem: connector.sourceSystem,
          displayName: connector.displayName
        },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined
      }
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
