export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  status: z.enum(["open", "appealed", "complied", "extended", "withdrawn", "overdue"]).optional(),
  complianceDeadline: z.string().optional().nullable(),
  compliedAt: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  appealed: z.boolean().optional(),
  appealOutcome: z.string().optional().nullable(),
  regulatorContact: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; noticeId: string }> }) {
  try {
    const { orgId, noticeId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const notice = await prisma.enforcementNotice.findUnique({
      where: { id: noticeId },
      include: {
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        permit: { select: { id: true, reference: true } },
        owner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!notice || notice.organizationId !== orgId) return apiError("NOT_FOUND", "Notice not found", 404);
    return NextResponse.json(notice);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; noticeId: string }> }) {
  try {
    const { orgId, noticeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const notice = await prisma.enforcementNotice.findUnique({ where: { id: noticeId }, select: { organizationId: true } });
    if (!notice || notice.organizationId !== orgId) return apiError("NOT_FOUND", "Notice not found", 404);

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.enforcementNotice.update({
      where: { id: noticeId },
      data: {
        ...(body.status && { status: body.status as never }),
        ...(body.complianceDeadline !== undefined && { complianceDeadline: body.complianceDeadline ? new Date(body.complianceDeadline) : null }),
        ...(body.compliedAt !== undefined && { compliedAt: body.compliedAt ? new Date(body.compliedAt) : null }),
        ...(body.requirements !== undefined && { requirements: body.requirements }),
        ...(body.appealed !== undefined && { appealed: body.appealed }),
        ...(body.appealOutcome !== undefined && { appealOutcome: body.appealOutcome }),
        ...(body.regulatorContact !== undefined && { regulatorContact: body.regulatorContact }),
        ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId }),
      },
    });

    const action = body.compliedAt
      ? "enforcement_notice.complied"
      : body.appealed
      ? "enforcement_notice.appealed"
      : "enforcement_notice.updated";

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action, resourceType: "EnforcementNotice", resourceId: noticeId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
