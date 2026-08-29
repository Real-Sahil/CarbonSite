export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const CreateConnectorSchema = z.object({
  sourceSystem: z.enum([
    "salesforce",
    "sap",
    "xero",
    "quickbooks",
    "stripe",
    "aws_iot",
    "openweather",
  ]),
  displayName: z.string().min(1).max(255),
  syncSchedule: z.enum(["hourly", "daily", "weekly", "manual"]).optional(),
  config: z.record(z.any()),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor");

    const connectors = await prisma.airbiteConnector.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    return json(
      {
        connectors: connectors.map((c) => ({
          id: c.id,
          sourceSystem: c.sourceSystem,
          displayName: c.displayName,
          enabled: c.enabled,
          syncSchedule: c.syncSchedule,
          recordsSynced: c.recordsSynced,
          lastSyncAt: c.lastSyncAt?.toISOString() || null,
          lastSyncStatus: c.lastSyncStatus,
          lastSyncError: c.lastSyncError,
          failureCount: c.failureCount,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validated = CreateConnectorSchema.parse(body);

    const existing = await prisma.airbiteConnector.findFirst({
      where: {
        organizationId: orgId,
        sourceSystem: validated.sourceSystem,
      },
    });

    if (existing) {
      return apiError(
        "CONFLICT",
        `Connector for ${validated.sourceSystem} already exists`,
        409
      );
    }

    const connector = await prisma.airbiteConnector.create({
      data: {
        organizationId: orgId,
        sourceSystem: validated.sourceSystem,
        displayName: validated.displayName,
        syncSchedule: validated.syncSchedule || "daily",
        config: validated.config,
      },
    });

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
          createdAt: connector.createdAt.toISOString(),
          updatedAt: connector.updatedAt.toISOString(),
        },
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
