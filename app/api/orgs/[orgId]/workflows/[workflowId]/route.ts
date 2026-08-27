import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateWorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  triggerType: z.enum(['field_submission_pending', 'emission_threshold_reached', 'report_ready', 'daily_digest']).optional(),
  webhookUrl: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> }
) {
  try {
    const { orgId, workflowId } = await params;

    await requireOrgMember(orgId, 'admin', 'editor');

    const workflow = await prisma.n8nWorkflow.findFirst({
      where: {
        id: workflowId,
        organizationId: orgId,
      },
      include: {
        executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
        },
      },
    });

    if (!workflow) {
      return apiError('NOT_FOUND', 'Workflow not found', 404);
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> }
) {
  try {
    const { orgId, workflowId } = await params;

    await requireOrgMember(orgId, 'admin');

    const workflow = await prisma.n8nWorkflow.findFirst({
      where: {
        id: workflowId,
        organizationId: orgId,
      },
    });

    if (!workflow) {
      return apiError('NOT_FOUND', 'Workflow not found', 404);
    }

    const body = await req.json();
    const validation = updateWorkflowSchema.safeParse(body);

    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.errors[0].message, 400);
    }

    const updated = await prisma.n8nWorkflow.update({
      where: { id: workflowId },
      data: {
        ...validation.data,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: validation.data.config ? (validation.data.config as any) : undefined,
      },
    });

    return NextResponse.json({ workflow: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> }
) {
  try {
    const { orgId, workflowId } = await params;

    await requireOrgMember(orgId, 'admin');

    const workflow = await prisma.n8nWorkflow.findFirst({
      where: {
        id: workflowId,
        organizationId: orgId,
      },
    });

    if (!workflow) {
      return apiError('NOT_FOUND', 'Workflow not found', 404);
    }

    await prisma.n8nWorkflow.delete({
      where: { id: workflowId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
