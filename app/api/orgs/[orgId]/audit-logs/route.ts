export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const auditLogsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().default("50").pipe(z.coerce.number().min(1).max(100)),
  resourceType: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  resourceId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: Params,
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "auditor", "reviewer");

    const query = auditLogsQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );

    if (!query.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, query.error.flatten());
    }

    const { cursor, limit, resourceType, action, startDate, endDate, resourceId } = query.data;

    const where: any = {
      organizationId: orgId,
    };

    if (resourceType) where.resourceType = resourceType;
    if (action) where.action = action;
    if (resourceId) where.resourceId = resourceId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    const hasMore = auditLogs.length > limit;
    const items = hasMore ? auditLogs.slice(0, -1) : auditLogs;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      items,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
