import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorUserId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// GET /api/orgs/[orgId]/audit-logs
// Requires admin or auditor role.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "auditor");

    const search = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = QuerySchema.safeParse(search);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.flatten());
    }

    const { cursor, limit, action, resourceType, actorUserId, from, to } = parsed.data;

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(action ? { action } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ data: items, nextCursor });
  } catch (err) {
    return handleRouteError(err);
  }
}
