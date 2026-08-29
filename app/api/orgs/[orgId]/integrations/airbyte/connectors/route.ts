import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const CreateConnectorSchema = z.object({
  sourceSystem: z.enum([
    "salesforce",
    "sap",
    "xero",
    "quickbooks",
    "stripe",
    "slack",
    "aws_iot",
    "openweather"
  ]),
  displayName: z.string().min(1).max(255),
  syncSchedule: z.enum(["hourly", "daily", "weekly", "manual"]).optional(),
  config: z.record(z.any()).optional()
});

interface Params {
  orgId: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const connectors = await prisma.airbiteConnector.findMany({
      where: { organizationId: orgId },
      include: {
        syncLogs: {
          take: 1,
          orderBy: { startedAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      connectors: connectors.map(c => ({
        id: c.id,
        sourceSystem: c.sourceSystem,
        displayName: c.displayName,
        enabled: c.enabled,
        syncSchedule: c.syncSchedule,
        recordsSynced: c.recordsSynced,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastSyncError: c.lastSyncError,
        failureCount: c.failureCount,
        recentSync: c.syncLogs[0]
      }))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validated = CreateConnectorSchema.parse(body);

    const existing = await prisma.airbiteConnector.findUnique({
      where: {
        organizationId_sourceSystem: {
          organizationId: orgId,
          sourceSystem: validated.sourceSystem
        }
      }
    });

    if (existing) {
      return apiError(
        "CONNECTOR_EXISTS",
        `A connector for ${validated.sourceSystem} already exists for this organization`,
        409
      );
    }

    const connector = await prisma.airbiteConnector.create({
      data: {
        organizationId: orgId,
        sourceSystem: validated.sourceSystem,
        displayName: validated.displayName,
        syncSchedule: validated.syncSchedule || "manual",
        config: validated.config || {},
        enabled: true
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: null,
        action: "INTEGRATION_CONNECTOR_CREATED",
        resourceType: "airbyte_connector",
        resourceId: connector.id,
        metadata: {
          created: true,
          sourceSystem: connector.sourceSystem,
          displayName: connector.displayName
        },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined
      }
    });

    return NextResponse.json(
      {
        id: connector.id,
        sourceSystem: connector.sourceSystem,
        displayName: connector.displayName,
        enabled: connector.enabled,
        syncSchedule: connector.syncSchedule,
        recordsSynced: connector.recordsSynced,
        lastSyncAt: connector.lastSyncAt,
        lastSyncStatus: connector.lastSyncStatus,
        createdAt: connector.createdAt
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
