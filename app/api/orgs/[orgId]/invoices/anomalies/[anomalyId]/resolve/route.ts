import { NextRequest } from "next/server";
import { requireOrgMember, ROLE_GROUPS, requireSession } from "@/lib/auth/session";
import { resolveInvoiceAnomaly } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
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
    const { version, json } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.reviewers);

    const body = await _req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return apiError("INVALID_BODY", "Invalid request body", 400, validation.error.flatten());
    }

    const { resolution, resolutionNotes } = validation.data;

    // Verify anomaly belongs to this org
    const anomaly = await prisma.invoiceAnomaly.findUnique({
      where: { id: anomalyId },
      include: { invoice: true },
    });

    if (!anomaly) {
      return apiError("NOT_FOUND", "Anomaly not found", 404);
    }

    if (anomaly.invoice.organizationId !== orgId) {
      return apiError("FORBIDDEN", "Access denied", 403);
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

    return json({
      code: "OK",
      message: "Anomaly resolved",
      data: {
        id: updated.id,
        resolution: updated.resolution,
        resolutionNotes: updated.resolutionNotes,
        resolvedAt: updated.resolvedAt?.toISOString(),
      },
    }, { version });
  } catch (error) {
    return handleRouteError(error);
  }
}
