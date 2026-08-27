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
  tableName: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  recordId: z.string().optional(),
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

    const { cursor, limit, tableName, action, startDate, endDate, recordId } = query.data;

    const where: any = {
      organizationId: orgId,
    };

    if (tableName) where.tableName = tableName;
    if (action) where.action = action;
    if (recordId) where.recordId = recordId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const auditEvents = await prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        actorId: true,
        action: true,
        tableName: true,
        recordId: true,
        oldValues: true,
        newValues: true,
        timestamp: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    const hasMore = auditEvents.length > limit;
    const items = hasMore ? auditEvents.slice(0, -1) : auditEvents;
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
