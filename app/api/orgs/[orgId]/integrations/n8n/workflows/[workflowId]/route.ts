import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  n8nWebhookUrl: z.string().url().optional()
});

type Params = { params: Promise<{ orgId: string; workflowId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const workflow = await prisma.n8nWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
      include: {
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            triggerEvent: true,
            status: true,
            startedAt: true,
            completedAt: true,
            duration: true
          }
        }
      }
    });

    if (workflow.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const existing = await prisma.n8nWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
      select: { organizationId: true }
    });

    if (existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, config, enabled, n8nWebhookUrl } = UpdateWorkflowSchema.parse(body);

    const workflow = await prisma.n8nWorkflow.update({
      where: { id: workflowId },
      // @ts-expect-error - Zod validated JSON object in conditional spread
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(config && { config }),
        ...(enabled !== undefined && { enabled }),
        ...(n8nWebhookUrl && { n8nWebhookUrl })
      },
      select: {
        id: true,
        n8nWorkflowId: true,
        name: true,
        trigger: true,
        action: true,
        enabled: true,
        updatedAt: true
      }
    });

    securityLogger.info(`n8n workflow updated: ${workflowId}`, {
      orgId,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const existing = await prisma.n8nWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
      select: { organizationId: true }
    });

    if (existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.n8nWorkflow.delete({
      where: { id: workflowId }
    });

    securityLogger.info(`n8n workflow deleted: ${workflowId}`, {
      orgId,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
