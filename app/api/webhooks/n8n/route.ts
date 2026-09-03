import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';

const N8nExecutionEventSchema = z.object({
  execution: z.object({
    id: z.string(),
    mode: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    stoppedAt: z.string().datetime().optional(),
    waitTill: z.string().datetime().optional(),
    workflowId: z.string(),
    workflowName: z.string().optional(),
  }),
  executionStatus: z.enum(['success', 'error', 'running', 'waiting']),
  executionResult: z.object({
    startTime: z.number().optional(),
    executionTime: z.number().optional(),
    lastNodeExecuted: z.string().optional(),
  }).optional(),
  executionError: z.object({
    message: z.string().optional(),
    description: z.string().optional(),
    node: z.string().optional(),
  }).optional(),
  metadata: z.object({
    organizationId: z.string(),
    workflowDatabaseId: z.string(),
    triggeredBy: z.string().optional(),
  }).optional(),
});

// Type inferred from schema for documentation purposes
// type N8nExecutionEvent = z.infer<typeof N8nExecutionEventSchema>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = N8nExecutionEventSchema.parse(body);

    const { execution, executionStatus, executionResult, executionError, metadata } = event;

    // Metadata must be present for CarbonSite integration
    if (!metadata?.organizationId || !metadata?.workflowDatabaseId) {
      securityLogger.warn('n8n webhook missing required metadata', {
        hasOrgId: !!metadata?.organizationId,
        hasWorkflowId: !!metadata?.workflowDatabaseId,
      });
      return NextResponse.json(
        { error: 'Missing required metadata fields', code: 'MISSING_METADATA' },
        { status: 400 }
      );
    }

    // Verify workflow exists and belongs to org
    const workflow = await prisma.n8nWorkflow.findUnique({
      where: { id: metadata.workflowDatabaseId },
      select: {
        id: true,
        organizationId: true,
        n8nWorkflowId: true,
      },
    });

    if (!workflow) {
      securityLogger.warn('n8n webhook for unknown workflow', {
        workflowDatabaseId: metadata.workflowDatabaseId,
        organizationId: metadata.organizationId,
      });
      return NextResponse.json(
        { error: 'Workflow not found', code: 'UNKNOWN_WORKFLOW' },
        { status: 404 }
      );
    }

    if (workflow.organizationId !== metadata.organizationId) {
      securityLogger.error('n8n webhook organization mismatch', {
        workflowId: workflow.id,
        expectedOrgId: workflow.organizationId,
        receivedOrgId: metadata.organizationId,
      });
      return NextResponse.json(
        { error: 'Organization mismatch', code: 'ORG_MISMATCH' },
        { status: 403 }
      );
    }

    // Parse execution times
    const startTime = execution.startedAt ? new Date(execution.startedAt) : new Date();
    const completedAt = execution.stoppedAt ? new Date(execution.stoppedAt) : null;
    const executionTime = executionResult?.executionTime || 0;

    // Build execution output
    const output: Record<string, unknown> = {
      n8nExecutionId: execution.id,
      workflowName: execution.workflowName,
      mode: execution.mode,
      lastNodeExecuted: executionResult?.lastNodeExecuted,
    };

    // Map execution status to our enum values
    const statusMap: Record<string, 'success' | 'error' | 'running' | 'waiting'> = {
      success: 'success',
      error: 'error',
      running: 'running',
      waiting: 'waiting',
    };

    const mappedStatus = statusMap[executionStatus] || 'error';

    try {
      // Create or update execution record
      const dbExecution = await prisma.n8nExecution.create({
        data: {
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          n8nExecutionId: execution.id,
          status: mappedStatus,
          duration: executionTime,
          // @ts-expect-error - n8n execution output is valid JSON
          output,
          errorMessage: executionError?.message || null,
          triggerEvent: metadata.triggeredBy || 'manual',
          startedAt: startTime,
          completedAt: completedAt,
        },
      });

      // Update workflow with latest execution info
      const updateData: Record<string, unknown> = {
        lastTriggeredAt: startTime,
        lastTriggeredBy: metadata.triggeredBy || 'manual',
      };

      if (mappedStatus === 'error') {
        updateData.failureCount = { increment: 1 };
        updateData.lastFailedAt = new Date();
        updateData.lastFailureReason = executionError?.message || 'Unknown error';
      }

      await prisma.n8nWorkflow.update({
        where: { id: workflow.id },
        data: updateData as unknown as Prisma.N8nWorkflowUpdateInput,
      });

      securityLogger.info('n8n execution recorded', {
        workflowId: workflow.id,
        organizationId: workflow.organizationId,
        executionId: execution.id,
        status: mappedStatus,
        executionTime,
      });

      return NextResponse.json(
        {
          received: true,
          executionId: dbExecution.id,
          status: mappedStatus,
          message: 'Execution recorded successfully',
        },
        { status: 201 }
      );
    } catch (dbError) {
      securityLogger.error('Failed to record n8n execution', {
        workflowId: workflow.id,
        executionId: execution.id,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      throw dbError;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('n8n webhook validation failed', {
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return NextResponse.json(
        {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid n8n webhook payload',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return handleRouteError(error);
  }
}
