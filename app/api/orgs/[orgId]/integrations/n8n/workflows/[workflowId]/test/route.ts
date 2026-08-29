import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { securityLogger } from '@/lib/logger';

type Params = { params: Promise<{ orgId: string; workflowId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const workflow = await prisma.n8nWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
      select: { organizationId: true, n8nWebhookUrl: true, name: true },
    });

    if (workflow.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!workflow.n8nWebhookUrl) {
      return NextResponse.json(
        { error: 'Workflow webhook URL not configured' },
        { status: 400 }
      );
    }

    // Trigger n8n workflow with test payload
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      organizationId: orgId,
      workflowId: workflowId,
    };

    try {
      const response = await fetch(workflow.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        securityLogger.warn(`n8n workflow test failed`, {
          workflowId,
          status: response.status,
          statusText: response.statusText,
        });

        return NextResponse.json(
          { error: `n8n returned status ${response.status}` },
          { status: 400 }
        );
      }

      securityLogger.info(`n8n workflow test executed`, {
        orgId,
        workflowId,
        workflowName: workflow.name,
        initiatedBy: req.headers.get('x-user-id') || 'unknown',
      });

      return NextResponse.json({
        tested: true,
        message: 'Workflow test executed successfully',
      });
    } catch (fetchError) {
      securityLogger.error(`Failed to trigger n8n workflow`, {
        workflowId,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });

      return NextResponse.json(
        { error: 'Failed to reach workflow endpoint' },
        { status: 503 }
      );
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
