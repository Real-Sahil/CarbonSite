export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const AssuranceDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]).describe("Auditor decision"),
  notes: z.string().optional().describe("Auditor comments"),
  signatureBase64: z.string().optional().describe("Optional e-signature data (base64 encoded)"),
});

/**
 * GET /api/orgs/[orgId]/snapshots/[snapshotId]/assurance
 * Retrieve auditor assurance record for a snapshot.
 *
 * Accessible by: admin, auditor, reviewer
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; snapshotId: string }> },
) {
  try {
    const { orgId, snapshotId } = await params;

    await requireOrgMember(orgId, "admin", "auditor", "reviewer");

    // Verify snapshot belongs to org
    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: snapshotId },
      select: { organizationId: true },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    // Fetch assurance record
    const assurance = await prisma.snapshotAssurance.findUnique({
      where: { snapshotId },
      select: {
        id: true,
        status: true,
        notes: true,
        signedAt: true,
        createdAt: true,
        auditor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!assurance) {
      return NextResponse.json({
        snapshotId,
        assurance: null,
        message: "No assurance record yet",
      });
    }

    return NextResponse.json({
      snapshotId,
      assurance: {
        id: assurance.id,
        status: assurance.status,
        notes: assurance.notes,
        auditor: {
          name: assurance.auditor.name,
          email: assurance.auditor.email,
        },
        signedAt: assurance.signedAt?.toISOString(),
        createdAt: assurance.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * POST /api/orgs/[orgId]/snapshots/[snapshotId]/assurance
 * Submit auditor assurance decision (approve/reject).
 *
 * Accessible by: auditor role only
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; snapshotId: string }> },
) {
  try {
    const { orgId, snapshotId } = await params;

    const { session } = await requireOrgMember(orgId, "auditor", "admin");

    // Verify snapshot belongs to org
    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: snapshotId },
      select: { organizationId: true, id: true },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    // Parse and validate body
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("BAD_REQUEST", "Request body must be valid JSON", 400);
    }

    const parsed = AssuranceDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    const { status, notes, signatureBase64 } = parsed.data;

    // Check if assurance already exists
    const existing = await prisma.snapshotAssurance.findUnique({
      where: { snapshotId },
    });

    let assurance;

    if (existing) {
      // Update existing assurance (auditor can change their decision)
      assurance = await prisma.snapshotAssurance.update({
        where: { snapshotId },
        data: {
          status,
          notes,
          signatureBase64,
          signedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          notes: true,
          signedAt: true,
        },
      });
    } else {
      // Create new assurance record
      assurance = await prisma.snapshotAssurance.create({
        data: {
          organizationId: orgId,
          snapshotId,
          auditorUserId: session.user.id,
          status,
          notes,
          signatureBase64,
          signedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          notes: true,
          signedAt: true,
        },
      });
    }

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.assured",
      resourceType: "SnapshotAssurance",
      resourceId: assurance.id,
      metadata: {
        snapshotId,
        status,
        signed: !!signatureBase64,
      },
    }).catch(() => null);

    return NextResponse.json(
      {
        success: true,
        assurance: {
          id: assurance.id,
          status: assurance.status,
          notes: assurance.notes,
          signedAt: assurance.signedAt?.toISOString(),
          message: `Snapshot ${status === "approved" ? "approved" : "rejected"} by auditor`,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * DELETE /api/orgs/[orgId]/snapshots/[snapshotId]/assurance
 * Retract auditor assurance decision.
 *
 * Accessible by: admin only
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; snapshotId: string }> },
) {
  try {
    const { orgId, snapshotId } = await params;

    const { session } = await requireOrgMember(orgId, "admin");

    // Verify snapshot belongs to org
    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: snapshotId },
      select: { organizationId: true },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    const assurance = await prisma.snapshotAssurance.findUnique({
      where: { snapshotId },
      select: { id: true },
    });

    if (!assurance) {
      return apiError("NOT_FOUND", "No assurance record to delete", 404);
    }

    await prisma.snapshotAssurance.delete({
      where: { snapshotId },
    });

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.assurance_retracted",
      resourceType: "SnapshotAssurance",
      resourceId: assurance.id,
      metadata: {
        snapshotId,
      },
    }).catch(() => null);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
