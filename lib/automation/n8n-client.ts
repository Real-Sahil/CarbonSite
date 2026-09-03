/**
 * n8n Workflow Automation Client
 * Triggers n8n workflows via webhooks for:
 * 1. Field worker submission reminders
 * 2. Facility risk flagging
 * 3. Report ready notifications
 */

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.carbonsite.app/webhook';

export interface WorkflowPayload {
  workflowName: string;
  orgId: string;
  timestamp: string;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}

export async function triggerN8nWorkflow(
  workflowName: string,
  payload: { orgId: string } & Record<string, string | number | boolean | null | undefined | Record<string, unknown>>
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn('[n8n] N8N_WEBHOOK_URL not configured, workflow trigger skipped');
    return { success: false, error: 'n8n not configured' };
  }

  try {
    const url = `${N8N_BASE_URL}/${workflowName}`;
    const body: WorkflowPayload = {
      workflowName,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Signature': process.env.N8N_SIGNATURE_KEY || '',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[n8n] Workflow '${workflowName}' failed:`, {
        status: response.status,
        error,
      });
      return {
        success: false,
        error: `HTTP ${response.status}: ${error}`,
      };
    }

    console.info(`[n8n] Workflow '${workflowName}' triggered successfully`, {
      orgId: payload.orgId,
    });

    return { success: true };
  } catch (error) {
    console.error(`[n8n] Failed to trigger workflow '${workflowName}':`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Workflow 1: Field Worker Submission Reminder
 * Trigger: Daily at 9 AM
 * Finds pending submissions older than 7 days and emails reviewers
 */
export async function triggerSubmissionReminder(orgId: string) {
  return triggerN8nWorkflow('submission-reminder', {
    orgId,
  });
}

/**
 * Workflow 2: Facility Risk Flagging
 * Trigger: After calculation run completes
 * Identifies facilities with high emissions and flags them
 */
export async function triggerFacilityRiskFlag(orgId: string, calculationRunId: string) {
  return triggerN8nWorkflow('facility-risk-flag', {
    orgId,
    calculationRunId,
  });
}

/**
 * Workflow 3: Report Ready Notification
 * Trigger: Report status changes to 'ready'
 * Notifies report creator and team via email + Slack
 */
export async function triggerReportReadyNotification(
  orgId: string,
  reportId: string,
  reportType: string,
  creatorEmail: string
) {
  return triggerN8nWorkflow('report-ready-notification', {
    orgId,
    reportId,
    reportType,
    creatorEmail,
  });
}

/**
 * Workflow 4: Anomaly Alert
 * Trigger: Anomaly detected in emissions data
 * Notifies auditors and sustainability leads
 */
export async function triggerAnomalyAlert(
  orgId: string,
  recordId: string,
  anomalyScore: number,
  severity: 'low' | 'medium' | 'high'
) {
  return triggerN8nWorkflow('anomaly-alert', {
    orgId,
    recordId,
    anomalyScore,
    severity,
  });
}

/**
 * Workflow 5: Supplier Data Request
 * Trigger: New supplier data request created
 * Sends supplier invitation and tracks responses
 */
export async function triggerSupplierDataRequest(
  orgId: string,
  supplierId: string,
  requestId: string,
  supplierEmail: string
) {
  return triggerN8nWorkflow('supplier-data-request', {
    orgId,
    supplierId,
    requestId,
    supplierEmail,
  });
}
