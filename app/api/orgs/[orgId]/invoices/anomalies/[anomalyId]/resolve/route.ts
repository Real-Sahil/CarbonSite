import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS, requireSession } from "@/lib/auth/session";
import { resolveInvoiceAnomaly } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { handleRouteError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  resolution: z.enum(["approved", "rejected"]),
  resolutionNotes: z.string().optional(),
});

type Params = {
  params: Promise<{ orgId: string; anomalyId: string }>;
};

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, anomalyId } = await params;

    // TODO: Implement invoice anomaly resolution after schema additions (Phase 2+)
    return NextResponse.json(
      { code: "NOT_IMPLEMENTED", message: "Invoice anomaly detection coming in Phase 2. Feature not yet available." },
      { status: 501 }
    );

    /* DISABLED: Incomplete invoice anomaly feature
    await requireOrgMember(orgId, ...ROLE_GROUPS.reviewers);

    const body = await _req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "Invalid request body", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { resolution, resolutionNotes } = validation.data;

    // Verify anomaly belongs to this org
    const anomaly = await prisma.invoiceAnomaly.findUnique({
      where: { id: anomalyId },
      include: { invoice: true },
    });

    if (!anomaly) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Anomaly not found" },
        { status: 404 }
      );
    }

    if (anomaly.invoice.organizationId !== orgId) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const session = await requireSession();

    const updated = await resolveInvoiceAnomaly(
      anomalyId,
      resolution,
      resolutionNotes,
      session.user.id
    );

    // If rejected, skip from Scope 3 calculations
    if (resolution === "rejected") {
      await prisma.invoiceRecord.update({
        where: { id: anomaly.invoiceId },
        data: { reconciliationStatus: "rejected" },
      });
    }

    return NextResponse.json({
      code: "OK",
      message: "Anomaly resolved",
      data: {
        id: updated.id,
        resolution: updated.resolution,
        resolutionNotes: updated.resolutionNotes,
        resolvedAt: updated.resolvedAt?.toISOString(),
      },
    });
    */
  } catch (error) {
    return handleRouteError(error);
  }
}
