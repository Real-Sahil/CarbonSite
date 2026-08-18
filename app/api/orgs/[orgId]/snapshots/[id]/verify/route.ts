export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string; id: string }> };

const verifySnapshotSchema = z.object({
  action: z.enum(["approved", "changes_requested"]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "reviewer");

    const body = verifySnapshotSchema.parse(await req.json());

    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id },
      select: { id: true, organizationId: true, publishedByUserId: true, verificationStatus: true, version: true },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found.", 404);
    }
    if (snapshot.verificationStatus === "approved") {
      return apiError("CONFLICT", "Snapshot is already approved.", 409);
    }
    // Prevent self-verification
    if (snapshot.publishedByUserId === session.user.id) {
      return apiError("FORBIDDEN", "The publisher cannot verify their own snapshot.", 403);
    }

    const updated = await prisma.publishedSnapshot.update({
      where: { id },
      data: {
        verificationStatus: body.action,
        verifiedByUserId: session.user.id,
        verifiedAt: new Date(),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: `snapshot.${body.action}`,
      resourceType: "published_snapshot",
      resourceId: id,
      metadata: { action: body.action, version: snapshot.version, note: body.note },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
