import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

// GET /api/orgs/[orgId]/field-submissions/[submissionId]
// Accessible by org members (all roles) AND the field worker who submitted it.
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  try {
    const { orgId, submissionId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin", "editor", "reviewer", "viewer", "auditor", "field_worker",
    );

    const submission = await prisma.fieldSubmission.findFirst({
      where: {
        id: submissionId,
        organizationId: orgId,
        // field_workers can only see their own submissions
        ...(membership.role === "field_worker"
          ? { submittedByUserId: session.user.id }
          : {}),
      },
      include: {
        emissionCategory: { select: { scope: true, name: true } },
        facility: { select: { name: true } },
        files: {
          include: {
            evidenceFile: { select: { id: true, filename: true, storageKey: true } },
          },
        },
      },
    });

    if (!submission) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    // Fetch latest CO2e if an activity record was created from this submission
    let co2eKg: number | null = null;
    if (submission.activityRecordId) {
      const latestCalc = await prisma.emissionCalculation.findFirst({
        where: { activityRecordId: submission.activityRecordId },
        orderBy: { createdAt: "desc" },
        select: { totalCo2e: true },
      });
      if (latestCalc) co2eKg = Number(latestCalc.totalCo2e);
    }

    // Generate 15-minute presigned download URLs for evidence files
    const evidenceFiles = await Promise.all(
      submission.files
        .filter((f) => f.evidenceFile !== null)
        .map(async (f) => {
          let downloadUrl: string | null = null;
          try {
            if (f.evidenceFile?.storageKey) {
              downloadUrl = await presignDownload(f.evidenceFile.storageKey);
            }
          } catch {
            // Presign failure is non-fatal — return filename without URL
          }
          return {
            id: f.evidenceFile!.id,
            filename: f.evidenceFile!.filename,
            downloadUrl,
          };
        }),
    );

    return NextResponse.json({
      id: submission.id,
      documentType: submission.documentType,
      status: submission.status,
      createdAt: submission.createdAt,
      reviewNote: submission.reviewNote,
      co2eKg,
      scope: submission.emissionCategory?.scope ?? null,
      // The site the worker submitted against — mobile needs it to start a
      // correction capture for the same site.
      siteId: submission.siteId,
      evidenceFiles,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// NOTE: submission review lives at ./review/route.ts (PATCH) — the single
// canonical implementation shared with bulk-review via
// lib/field-submissions/approve.ts. A diverged duplicate PATCH handler was
// removed from this file; do not re-add one.
