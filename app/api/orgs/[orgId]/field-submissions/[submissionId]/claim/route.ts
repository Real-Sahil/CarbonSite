export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

// A claim is considered stale after this many milliseconds and can be overridden.
const CLAIM_STALE_MS = 5 * 60 * 1000;

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

/**
 * POST /api/orgs/[orgId]/field-submissions/[submissionId]/claim
 * Claim a submission for exclusive review. Returns 409 if claimed by someone
 * else and the claim is fresh (< 5 min old).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        reviewClaimedByUserId: true,
        reviewClaimedAt: true,
      },
    });

    if (!submission) return apiError("NOT_FOUND", "Submission not found.", 404);
    if (submission.status === "approved" || submission.status === "rejected") {
      return apiError("CONFLICT", "Submission already resolved.", 409);
    }

    const now = new Date();
    const isStale =
      !submission.reviewClaimedAt ||
      now.getTime() - submission.reviewClaimedAt.getTime() > CLAIM_STALE_MS;

    if (
      submission.reviewClaimedByUserId &&
      submission.reviewClaimedByUserId !== session.user.id &&
      !isStale
    ) {
      return apiError(
        "CLAIM_CONFLICT",
        "Another reviewer is currently working on this submission. Try again in a few minutes.",
        409,
      );
    }

    const updated = await prisma.fieldSubmission.update({
      where: { id: submissionId },
      data: {
        reviewClaimedByUserId: session.user.id,
        reviewClaimedAt: now,
      },
      select: { id: true, reviewClaimedByUserId: true, reviewClaimedAt: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.review_claimed",
      resourceType: "field_submission",
      resourceId: submissionId,
      metadata: {},
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * DELETE /api/orgs/[orgId]/field-submissions/[submissionId]/claim
 * Release a review claim. Only the claimant or an admin may release.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      select: { id: true, reviewClaimedByUserId: true },
    });

    if (!submission) return apiError("NOT_FOUND", "Submission not found.", 404);

    const callerMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: session.user.id },
      },
      select: { role: true },
    });

    const isAdmin = callerMembership?.role === "admin";
    if (submission.reviewClaimedByUserId !== session.user.id && !isAdmin) {
      return apiError("FORBIDDEN", "Only the claimant or an admin may release this claim.", 403);
    }

    await prisma.fieldSubmission.update({
      where: { id: submissionId },
      data: { reviewClaimedByUserId: null, reviewClaimedAt: null },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.review_claim_released",
      resourceType: "field_submission",
      resourceId: submissionId,
      metadata: {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
