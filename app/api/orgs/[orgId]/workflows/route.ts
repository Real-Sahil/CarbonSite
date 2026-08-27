import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createWorkflowSchema = z.object({
  n8nWorkflowId: z.string().min(1, 'n8n workflow ID required'),
  name: z.string().min(1, 'Workflow name required'),
  triggerType: z.enum(['field_submission_pending', 'emission_threshold_reached', 'report_ready', 'daily_digest']),
  description: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, 'admin', 'editor');

    const workflows = await prisma.n8nWorkflow.findMany({
      where: { organizationId: orgId },
      include: {
        _count: {
          select: { executions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      workflows: workflows.map((w) => ({
        id: w.id,
        n8nWorkflowId: w.n8nWorkflowId,
        name: w.name,
        triggerType: w.triggerType,
        description: w.description,
        enabled: w.enabled,
        webhookUrl: w.webhookUrl,
        executionCount: w._count.executions,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      total: workflows.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, 'admin');

    const body = await req.json();
    const validation = createWorkflowSchema.safeParse(body);

    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.errors[0].message, 400);
    }

    const { n8nWorkflowId, name, triggerType, description, webhookUrl, config, enabled } = validation.data;

    // Check if workflow already exists
    const existing = await prisma.n8nWorkflow.findFirst({
      where: {
        organizationId: orgId,
        n8nWorkflowId,
      },
    });

    if (existing) {
      return apiError(
        'ALREADY_EXISTS',
        `Workflow ${n8nWorkflowId} is already configured for this org`,
        409
      );
    }

    const workflow = await prisma.n8nWorkflow.create({
      data: {
        organizationId: orgId,
        n8nWorkflowId,
        name,
        triggerType,
        description,
        webhookUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: (config || {}) as any,
        enabled: enabled !== false,
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
