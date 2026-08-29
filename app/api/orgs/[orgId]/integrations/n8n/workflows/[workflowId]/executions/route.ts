import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';

type Params = { params: Promise<{ orgId: string; workflowId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    // Verify workflow belongs to org
    const workflow = await prisma.n8nWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
      select: { organizationId: true },
    });

    if (workflow.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get recent executions
    const executions = await prisma.n8nExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        n8nExecutionId: true,
        status: true,
        triggerEvent: true,
        duration: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    return handleRouteError(error);
  }
}
