import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    const { workflowId, executionId, workflowName, status, triggerType, triggerData, output, errorMessage, executionTime } =
      event;

    if (!workflowId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, status' },
        { status: 400 }
      );
    }

    // Find the workflow to get organizationId
    const workflow = await prisma.n8nWorkflow.findFirst({
      where: {
        n8nWorkflowId: workflowId,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Record execution
    const execution = await prisma.n8nWorkflowExecution.create({
      data: {
        organizationId: workflow.organizationId,
        n8nWorkflowId: workflow.id,
        workflowName: workflowName || workflow.name,
        triggerType: triggerType || workflow.triggerType,
        triggerData: triggerData || {},
        status,
        errorMessage: errorMessage || null,
        output: output || {},
        executionTimeMs: executionTime || null,
        executedAt: new Date(),
      },
    });

    // Update workflow last execution status if needed
    if (status === 'success') {
      await prisma.n8nWorkflow.update({
        where: { id: workflow.id },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      message: 'Execution recorded',
    });
  } catch (error) {
    console.error('n8n webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
