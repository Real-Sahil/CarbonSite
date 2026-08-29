import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';

const CreateWorkflowSchema = z.object({
  n8nWorkflowId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  trigger: z.enum(['report_ready', 'field_submission', 'import_complete', 'manual']),
  action: z.enum(['send_email', 'slack_notification', 'create_jira_ticket', 'update_spreadsheet']),
  config: z.record(z.unknown()),
  n8nWebhookUrl: z.string().url().optional()
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const workflows = await prisma.n8nWorkflow.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        n8nWorkflowId: true,
        name: true,
        description: true,
        trigger: true,
        action: true,
        enabled: true,
        lastTriggeredAt: true,
        failureCount: true,
        lastFailedAt: true,
        createdAt: true
      }
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editors);

    const body = await req.json();
    const {
      n8nWorkflowId,
      name,
      description,
      trigger,
      action,
      config,
      n8nWebhookUrl
    } = CreateWorkflowSchema.parse(body);

    const workflow = await prisma.n8nWorkflow.create({
      data: {
        organizationId: orgId,
        n8nWorkflowId,
        name,
        description,
        trigger,
        action,
        config,
        n8nWebhookUrl,
        enabled: true
      },
      select: {
        id: true,
        n8nWorkflowId: true,
        name: true,
        trigger: true,
        action: true,
        enabled: true,
        createdAt: true
      }
    });

    securityLogger.info(`n8n workflow created: ${workflow.id}`, {
      orgId,
      trigger,
      action,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
