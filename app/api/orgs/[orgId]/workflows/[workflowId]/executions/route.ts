import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> }
) {
  try {
    const { orgId, workflowId } = await params;

    await requireOrgMember(orgId, 'admin', 'editor', 'viewer');

    const workflow = await prisma.n8nWorkflow.findFirst({
      where: {
        id: workflowId,
        organizationId: orgId,
      },
    });

    if (!workflow) {
      return apiError('NOT_FOUND', 'Workflow not found', 404);
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');

    const where = {
      organizationId: orgId,
      n8nWorkflowId: workflowId,
      ...(status && { status }),
    };

    const [executions, total] = await Promise.all([
      prisma.n8nWorkflowExecution.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.n8nWorkflowExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
