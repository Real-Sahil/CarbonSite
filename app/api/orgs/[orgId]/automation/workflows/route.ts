export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

// Define available workflows
const AVAILABLE_WORKFLOWS = [
  {
    name: "submission-reminder",
    displayName: "Field Worker Submission Reminder",
    description: "Daily reminder for pending field submissions older than 7 days",
    schedule: "daily",
    triggerType: "scheduled",
    enabled: true,
  },
  {
    name: "facility-risk-flag",
    displayName: "Facility Risk Flagging",
    description: "Identifies facilities with high emissions after calculation run",
    schedule: "on-demand",
    triggerType: "event",
    enabled: true,
  },
  {
    name: "report-ready-notification",
    displayName: "Report Ready Notification",
    description: "Notifies when report generation is complete",
    schedule: "on-demand",
    triggerType: "event",
    enabled: true,
  },
  {
    name: "anomaly-alert",
    displayName: "Anomaly Detection Alert",
    description: "Alerts when anomalies are detected in emissions data",
    schedule: "on-demand",
    triggerType: "event",
    enabled: true,
  },
  {
    name: "supplier-data-request",
    displayName: "Supplier Data Request",
    description: "Sends supplier data collection requests",
    schedule: "on-demand",
    triggerType: "event",
    enabled: true,
  },
];

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin", "editor");

    // Check if n8n is configured
    const n8nConfigured = !!process.env.N8N_WEBHOOK_URL;

    // For MVP, return workflow definitions with status indicators
    // In production, would fetch actual workflow metrics from n8n API or database
    const workflows = AVAILABLE_WORKFLOWS.map((workflow) => ({
      id: workflow.name,
      ...workflow,
      status: n8nConfigured ? "ready" : "not-configured",
      lastRunAt: null as string | null,
      lastRunStatus: null as "success" | "failed" | null,
      nextScheduledRun: workflow.triggerType === "scheduled" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
    }));

    return json(
      {
        workflows,
        n8nConfigured,
        note: n8nConfigured
          ? "n8n is configured and ready"
          : "n8n webhook URL not configured. Set N8N_WEBHOOK_URL environment variable.",
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const TriggerWorkflowSchema = z.object({
  manualRun: z.boolean().optional().default(false),
  testMode: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin");

    if (!process.env.N8N_WEBHOOK_URL) {
      return apiError(
        "CONFIGURATION_ERROR",
        "n8n is not configured. Set N8N_WEBHOOK_URL environment variable.",
        503
      );
    }

    const body = await req.json();
    const validated = TriggerWorkflowSchema.parse(body);

    // For now, return 501 — workflow triggering via this endpoint would require
    // additional validation and logging. Use workflow-specific trigger functions instead.
    return apiError(
      "NOT_IMPLEMENTED",
      "Use workflow-specific trigger endpoints instead (e.g., POST /triggers/submission-reminder)",
      501
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
