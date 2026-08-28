import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import {
  getInvoiceAnomalies,
  resolveInvoiceAnomaly,
} from "@/lib/jobs/workers/invoice-anomaly-detector";
import { securityLogger } from "@/lib/logger";

type Params = Promise<{ orgId: string }>;

export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "reviewer");

    const url = new URL(req.url);
    const severityParam = url.searchParams.get("severity");
    const severity = severityParam as "info" | "warning" | "critical" | undefined;
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const anomalies = await getInvoiceAnomalies(orgId, {
      severity: severity || undefined,
      type: type || undefined,
      status: status || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const paginatedAnomalies = anomalies.slice(offset, offset + limit);

    return NextResponse.json({
      anomalies: paginatedAnomalies,
      total: anomalies.length,
      offset,
      limit,
      hasMore: offset + limit < anomalies.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "reviewer");

    const body = await req.json();
    const { anomalyIds, resolution, resolutionNotes, bulkAction } = body;

    if (!Array.isArray(anomalyIds) || anomalyIds.length === 0) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "anomalyIds array required" },
        { status: 400 }
      );
    }

    if (!resolution) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "resolution field required" },
        { status: 400 }
      );
    }

    // Verify all anomalies belong to this org
    const anomalies = await prisma.invoiceAnomaly.findMany({
      where: {
        id: { in: anomalyIds },
        invoice: { organizationId: orgId },
      },
    });

    if (anomalies.length !== anomalyIds.length) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Some anomalies not found or unauthorized" },
        { status: 403 }
      );
    }

    // Get current user ID (assuming from session)
    const session = await req.headers
      .get("authorization")
      ?.split(" ")[1];

    // Batch update all anomalies
    const updated = await Promise.all(
      anomalyIds.map((anomalyId: string) =>
        resolveInvoiceAnomaly(
          anomalyId,
          resolution,
          resolutionNotes,
          undefined
        )
      )
    );

    securityLogger.info("Invoice anomalies resolved", {
      orgId,
      count: updated.length,
      resolution,
    });

    return NextResponse.json({
      code: "SUCCESS",
      message: `${updated.length} anomalies resolved`,
      updated,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
