import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';

const querySchema = z.object({
  cursor: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string().optional(),
  framework: z.string().optional(),
  limit: z.string().default('25').transform((v) => Math.min(100, parseInt(v, 10))),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, 'admin', 'auditor', 'reviewer');

    const parsedParams = querySchema.parse({
      cursor: req.nextUrl.searchParams.get('cursor') || undefined,
      resourceType: req.nextUrl.searchParams.get('resourceType') || undefined,
      resourceId: req.nextUrl.searchParams.get('resourceId') || undefined,
      action: req.nextUrl.searchParams.get('action') || undefined,
      framework: req.nextUrl.searchParams.get('framework') || undefined,
      limit: req.nextUrl.searchParams.get('limit') || '25',
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

    const items = logs.slice(0, parsedParams.limit);
    const nextCursor = logs.length > parsedParams.limit ? logs[logs.length - 1]?.id : null;

    return NextResponse.json({
      logs: items.map((log) => ({
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
        nextCursor,
        hasMore: logs.length > parsedParams.limit,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
