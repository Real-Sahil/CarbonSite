import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/db/audit';

/**
 * Webhook endpoint for n8n workflow callbacks
 * POST /api/webhooks/n8n
 *
 * Receives workflow completion events and updates CarbonSite state accordingly
 */

const workflowCallbackSchema = z.object({
  workflowName: z.string(),
  orgId: z.string().uuid(),
  status: z.enum(['success', 'failed']),
  timestamp: z.string().datetime(),
  message: z.string().optional(),
  data: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-n8n-signature');
    if (signature !== process.env.N8N_SIGNATURE_KEY) {
      console.warn('[n8n webhook] Invalid signature');
      return NextResponse.json(
        { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const payload = workflowCallbackSchema.parse(body);

    console.info('[n8n webhook] Received workflow callback', {
      workflowName: payload.workflowName,
      orgId: payload.orgId,
      status: payload.status,
    });

    // Verify organization exists
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: payload.orgId },
    });

    // Handle workflow completion based on type
    switch (payload.workflowName) {
      case 'facility-risk-update':
        await handleFacilityRiskUpdate(payload, org);
        break;

      case 'submission-approval':
        await handleSubmissionApproval(payload, org);
        break;

      case 'anomaly-escalation':
        await handleAnomalyEscalation(payload, org);
        break;

      case 'supplier-data-sync':
        await handleSupplierDataSync(payload, org);
        break;

      default:
        console.warn(`[n8n webhook] Unknown workflow: ${payload.workflowName}`);
    }

    // Log workflow execution
    await writeAuditLog({
      organizationId: payload.orgId,
      action: 'integration.connected',
      resourceType: 'n8n_workflow',
      resourceId: payload.workflowName,
      metadata: {
        status: payload.status,
        message: payload.message,
      },
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      received: true,
      workflowName: payload.workflowName,
      status: payload.status,
    });
  } catch (error) {
    console.error('[n8n webhook] Error processing callback:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook payload',
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle facility risk level updates from n8n
 * Workflow identifies high-emission facilities and updates their risk level
 */
async function handleFacilityRiskUpdate(
  payload: z.infer<typeof workflowCallbackSchema>,
  org: any
) {
  if (payload.status === 'failed') {
    console.error(`[n8n] Facility risk update failed: ${payload.message}`);
    return;
  }

  if (!payload.data?.facilityId || !payload.data?.riskLevel) {
    console.warn('[n8n] Facility risk update missing required data');
    return;
  }

  try {
    await prisma.facility.update({
      where: {
        id: payload.data.facilityId,
        organizationId: payload.orgId,
      },
      data: {
        riskLevel: payload.data.riskLevel,
        updatedAt: new Date(),
      },
    });

    console.info('[n8n] Facility risk level updated', {
      facilityId: payload.data.facilityId,
      riskLevel: payload.data.riskLevel,
    });
  } catch (error) {
    console.error('[n8n] Failed to update facility risk level:', error);
  }
}

/**
 * Handle field submission approvals from n8n workflows
 * Converts approved submissions to ActivityRecords
 */
async function handleSubmissionApproval(
  payload: z.infer<typeof workflowCallbackSchema>,
  org: any
) {
  if (payload.status === 'failed') {
    console.error(`[n8n] Submission approval failed: ${payload.message}`);
    return;
  }

  if (!payload.data?.submissionId) {
    console.warn('[n8n] Submission approval missing submission ID');
    return;
  }

  try {
    // Update field submission status
    const submission = await prisma.fieldSubmission.update({
      where: {
        id: payload.data.submissionId,
        organizationId: payload.orgId,
      },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
      },
    });

    console.info('[n8n] Field submission approved', {
      submissionId: payload.data.submissionId,
      fieldWorker: submission.submittedByUserId,
    });
  } catch (error) {
    console.error('[n8n] Failed to approve submission:', error);
  }
}

/**
 * Handle anomaly escalations from n8n
 * Routes high-severity anomalies to auditors for review
 */
async function handleAnomalyEscalation(
  payload: z.infer<typeof workflowCallbackSchema>,
  org: any
) {
  if (payload.status === 'failed') {
    console.error(`[n8n] Anomaly escalation failed: ${payload.message}`);
    return;
  }

  if (!payload.data?.recordId || !payload.data?.severity) {
    console.warn('[n8n] Anomaly escalation missing required data');
    return;
  }

  try {
    // Update activity record to flag for review
    await prisma.activityRecord.update({
      where: {
        id: payload.data.recordId,
        organizationId: payload.orgId,
      },
      data: {
        reviewStatus: 'in_review',
        assumptionNotes: `[Auto-flagged] Anomaly detected with severity: ${payload.data.severity}`,
        updatedAt: new Date(),
      },
    });

    console.info('[n8n] Anomaly escalated for review', {
      recordId: payload.data.recordId,
      severity: payload.data.severity,
    });
  } catch (error) {
    console.error('[n8n] Failed to escalate anomaly:', error);
  }
}

/**
 * Handle supplier data synchronization from n8n
 * Syncs supplier-submitted emissions data into staging area
 */
async function handleSupplierDataSync(
  payload: z.infer<typeof workflowCallbackSchema>,
  org: any
) {
  if (payload.status === 'failed') {
    console.error(`[n8n] Supplier data sync failed: ${payload.message}`);
    return;
  }

  if (!payload.data?.supplierId || !payload.data?.recordCount) {
    console.warn('[n8n] Supplier data sync missing required data');
    return;
  }

  try {
    console.info('[n8n] Supplier data synced', {
      supplierId: payload.data.supplierId,
      recordCount: payload.data.recordCount,
    });
    // Data is already in staging tables via Airbyte, just log success
  } catch (error) {
    console.error('[n8n] Failed to sync supplier data:', error);
  }
}
