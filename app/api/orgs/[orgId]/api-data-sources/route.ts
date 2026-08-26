export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

const CreateApiDataSourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  endpoint: z.string().url(),
  authMethod: z.enum(["none", "api_key", "bearer", "basic"]),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
  basicUsername: z.string().optional(),
  basicPassword: z.string().optional(),
  dataFormat: z.enum(["json", "csv"]).default("json"),
  syncIntervalMins: z.number().int().min(5).max(1440).default(60),
  mappingConfig: z.record(z.unknown()).default({} as Record<string, unknown>),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const sources = await prisma.apiDataSource.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        endpoint: true,
        authMethod: true,
        dataFormat: true,
        enabled: true,
        lastSyncAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        syncIntervalMins: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: sources });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = await req.json();
    const validated = CreateApiDataSourceSchema.parse(body);

    const source = await prisma.apiDataSource.create({
      data: {
        organizationId: orgId,
        name: validated.name,
        description: validated.description,
        endpoint: validated.endpoint,
        authMethod: validated.authMethod,
        apiKey: validated.apiKey || null,
        bearerToken: validated.bearerToken || null,
        basicUsername: validated.basicUsername || null,
        basicPassword: validated.basicPassword || null,
        dataFormat: validated.dataFormat,
        syncIntervalMins: validated.syncIntervalMins,
        mappingConfig: validated.mappingConfig as any,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.connected",
      resourceType: "ApiDataSource",
      resourceId: source.id,
      metadata: {
        name: source.name,
        endpoint: source.endpoint,
        authMethod: source.authMethod,
      },
    });

    return NextResponse.json(
      { id: source.id, message: "API data source created" },
      { status: 201 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
