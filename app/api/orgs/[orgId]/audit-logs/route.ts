import { NextRequest } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { prisma } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({
  resourceType: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().default("50"),
  offset: z.string().default("0"),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.safeParse({
      resourceType: _req.nextUrl.searchParams.get("resourceType") ?? undefined,
      action: _req.nextUrl.searchParams.get("action") ?? undefined,
      actorId: _req.nextUrl.searchParams.get("actorId") ?? undefined,
      startDate: _req.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: _req.nextUrl.searchParams.get("endDate") ?? undefined,
      limit: _req.nextUrl.searchParams.get("limit") ?? undefined,
      offset: _req.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!query.success) {
      return apiError("INVALID_QUERY", "Invalid query parameters", 400, query.error.flatten());
    }

    const { resourceType, action, actorId, startDate, endDate, limit, offset } = query.data;

    const where: any = { organizationId: orgId };
    if (resourceType) where.resourceType = resourceType;
    if (action) where.action = action;
    if (actorId) where.actorUserId = actorId;
    if (startDate) where.createdAt = { gte: new Date(startDate) };
    if (endDate) {
      if (!where.createdAt) where.createdAt = {};
      where.createdAt.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.auditLog.count({ where });

    return json(
      {
        data: logs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          actor: log.actor
            ? { id: log.actor.id, email: log.actor.email, name: log.actor.name }
            : null,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        })),
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
          total,
        },
      },
      { version }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
