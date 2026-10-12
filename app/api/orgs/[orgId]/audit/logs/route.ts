import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { cursorPage, wholeNumberParam, MAX_PAGE_SIZE } from '@/lib/api/pagination';
import { z } from 'zod';

const querySchema = z.object({
  cursor: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string().optional(),
  framework: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, 'admin', 'auditor', 'reviewer');

    const sp = req.nextUrl.searchParams;
    const parsedParams = querySchema.parse({
      cursor: sp.get('cursor') || undefined,
      resourceType: sp.get('resourceType') || undefined,
      resourceId: sp.get('resourceId') || undefined,
      action: sp.get('action') || undefined,
      framework: sp.get('framework') || undefined,
      limit: wholeNumberParam(sp.get('limit'), 25, 1, MAX_PAGE_SIZE),
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(parsedParams.resourceType && { resourceType: parsedParams.resourceType }),
        ...(parsedParams.resourceId && { resourceId: parsedParams.resourceId }),
        ...(parsedParams.action && { action: parsedParams.action }),
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        auditContexts: {
          where: parsedParams.framework
            ? { framework: parsedParams.framework }
            : undefined,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parsedParams.limit + 1,
      ...(parsedParams.cursor && {
        skip: 1,
        cursor: { id: parsedParams.cursor },
      }),
    });

    const page = cursorPage(logs, parsedParams.limit);

    return NextResponse.json({
      logs: page.items.map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        actor: log.actor ? {
          id: log.actor.id,
          email: log.actor.email,
          name: log.actor.name,
        } : null,
        ipAddress: log.ipAddress,
        frameworks: log.auditContexts?.map((ctx) => ctx.framework) || [],
        metadata: log.metadata,
      })),
      pagination: {
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
