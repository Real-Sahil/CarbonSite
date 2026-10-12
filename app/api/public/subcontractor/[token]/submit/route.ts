export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { deleteObject, putObject } from "@/lib/storage";
import {
  OPEN_STATUSES, evidenceKeyFor, portalFormFields, portalSubmissionSchema, readEvidence, resolveSubcontractorToken,
} from "@/lib/subcontractor/portal";
import { apiError, handleRouteError } from "@/lib/validation/api";

/**
 * A subcontractor's figures through their link. No account. The link is single-purpose:
 * it can record one submission while the request is open, and nothing else.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, {
      key: `subcontractor-submit:${token.slice(0, 16)}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited) return limited;

    const row = await resolveSubcontractorToken(token);
    if (!row) return apiError("NOT_FOUND", "This link has expired or been withdrawn. Ask for a new one.", 404);
    if (!OPEN_STATUSES.includes(row.status)) {
      return apiError("NOT_OPEN", "These figures are already with the requester and no longer take changes.", 409);
    }

    const form = await req.formData();
    const parsed = portalSubmissionSchema.safeParse(portalFormFields(form));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the form and try again.", 422);
    }
    const data = parsed.data;

    let evidenceKey: string | null = null;
    const file = form.get("evidence");
    if (file instanceof File && file.size > 0) {
      const read = await readEvidence(file);
      if ("error" in read) return apiError("VALIDATION_ERROR", read.error, 422);
      evidenceKey = evidenceKeyFor(row.organizationId, row.id, read.name);
      await putObject(evidenceKey, read.buffer, read.type);
    }

    // Conditional on the link still being open, so two submits at once cannot both land.
    const now = new Date();
    const result = await prisma.subcontractorCarbonSubmission.updateMany({
      where: { id: row.id, status: { in: [...OPEN_STATUSES] }, tokenExpiresAt: { gt: now } },
      data: {
        status: "submitted",
        submittedVia: "portal_link",
        submitterName: data.submitterName,
        submitterNote: data.submitterNote ?? null,
        scope1Tco2e: data.scope1Tco2e ?? null,
        scope2Tco2e: data.scope2Tco2e ?? null,
        scope3Tco2e: data.scope3Tco2e ?? null,
        evidenceStorageKey: evidenceKey,
        submittedAt: now,
        rejectionReason: null,
      },
    });
    if (result.count === 0) {
      // Lost the race (or the link expired mid-upload): drop the file we just wrote.
      if (evidenceKey) await deleteObject(evidenceKey).catch(() => null);
      return apiError("NOT_OPEN", "These figures are already with the requester and no longer take changes.", 409);
    }

    await writeAuditLog({
      organizationId: row.organizationId,
      action: "subcontractor_submission.submitted",
      resourceType: "SubcontractorCarbonSubmission",
      resourceId: row.id,
      metadata: {
        via: "portal_link",
        scope1Tco2e: data.scope1Tco2e ?? null,
        scope2Tco2e: data.scope2Tco2e ?? null,
        scope3Tco2e: data.scope3Tco2e ?? null,
        evidence: evidenceKey !== null,
      },
    });

    return NextResponse.json({ ok: true, status: "submitted" }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
