import { NextRequest } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { getInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { z } from "zod";

const querySchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).optional(),
  type: z.string().optional(),
  resolution: z.enum(["approved", "rejected", "pending"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().default("50"),
  offset: z.string().default("0"),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const query = querySchema.safeParse(
      Object.fromEntries(_req.nextUrl.searchParams)
    );

    if (!query.success) {
      return apiError("INVALID_QUERY", "Invalid query parameters", 400, query.error.flatten());
    }

    const { severity, type, resolution, startDate, endDate, limit, offset } =
      query.data;

    const filters = {
      severity: severity as "info" | "warning" | "critical" | undefined,
      type,
      status: resolution,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const anomalies = await getInvoiceAnomalies(orgId, filters);

    const paginatedAnomalies = anomalies.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    return json({
      data: paginatedAnomalies.map((anomaly) => ({
        id: anomaly.id,
        invoiceId: anomaly.invoiceId,
        invoiceNumber: anomaly.invoice.externalInvoiceId,
        vendorName: anomaly.invoice.vendorName,
        vendorId: anomaly.invoice.vendorId,
        amount: anomaly.invoice.totalAmount,
        anomalyType: anomaly.anomalyType,
        severity: anomaly.severity,
        reason: anomaly.reason,
        resolution: anomaly.resolution || "pending",
        resolutionNotes: anomaly.resolutionNotes,
        resolvedBy: anomaly.resolvedBy?.name,
        detectedAt: anomaly.detectedAt.toISOString(),
        resolvedAt: anomaly.resolvedAt?.toISOString(),
      })),
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: anomalies.length,
      },
    }, { version });
  } catch (error) {
    return handleRouteError(error);
  }
}
