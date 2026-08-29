export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import {
  triggerSubmissionReminder,
  triggerFacilityRiskFlag,
  triggerReportReadyNotification,
  triggerAnomalyAlert,
  triggerSupplierDataRequest,
} from "@/lib/automation/n8n-client";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string; workflowName: string }> };

const TriggerPayloadSchema = z.object({
  calculationRunId: z.string().optional(),
  reportId: z.string().optional(),
  reportType: z.string().optional(),
  creatorEmail: z.string().email().optional(),
  recordId: z.string().optional(),
  anomalyScore: z.number().optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  supplierId: z.string().optional(),
  requestId: z.string().optional(),
  supplierEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, workflowName } = await params;
    const { version, json } = await withApiVersion(req);

    await requireOrgMember(orgId, "admin");

    if (!process.env.N8N_WEBHOOK_URL) {
      return apiError(
        "CONFIGURATION_ERROR",
        "n8n is not configured",
        503
      );
    }

    const body = await req.json();
    const validated = TriggerPayloadSchema.parse(body);

    let result;

    switch (workflowName) {
      case "submission-reminder":
        result = await triggerSubmissionReminder(orgId);
        break;
      case "facility-risk-flag":
        if (!validated.calculationRunId) {
          return apiError(
            "INVALID_REQUEST",
            "calculationRunId is required for facility-risk-flag workflow",
            400
          );
        }
        result = await triggerFacilityRiskFlag(orgId, validated.calculationRunId);
        break;
      case "report-ready-notification":
        if (!validated.reportId || !validated.reportType || !validated.creatorEmail) {
          return apiError(
            "INVALID_REQUEST",
            "reportId, reportType, and creatorEmail are required for report-ready-notification workflow",
            400
          );
        }
        result = await triggerReportReadyNotification(
          orgId,
          validated.reportId,
          validated.reportType,
          validated.creatorEmail
        );
        break;
      case "anomaly-alert":
        if (!validated.recordId || validated.anomalyScore === undefined || !validated.severity) {
          return apiError(
            "INVALID_REQUEST",
            "recordId, anomalyScore, and severity are required for anomaly-alert workflow",
            400
          );
        }
        result = await triggerAnomalyAlert(orgId, validated.recordId, validated.anomalyScore, validated.severity);
        break;
      case "supplier-data-request":
        if (!validated.supplierId || !validated.requestId || !validated.supplierEmail) {
          return apiError(
            "INVALID_REQUEST",
            "supplierId, requestId, and supplierEmail are required for supplier-data-request workflow",
            400
          );
        }
        result = await triggerSupplierDataRequest(
          orgId,
          validated.supplierId,
          validated.requestId,
          validated.supplierEmail
        );
        break;
      default:
        return apiError(
          "NOT_FOUND",
          `Unknown workflow: ${workflowName}`,
          404
        );
    }

    return json(
      {
        workflowName,
        triggered: result.success,
        message: result.message || result.error,
        timestamp: new Date().toISOString(),
      },
      {
        version,
        status: result.success ? 200 : 400,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
