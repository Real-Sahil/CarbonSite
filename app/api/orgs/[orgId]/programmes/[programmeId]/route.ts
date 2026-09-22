export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional(),
  clientName: z.string().optional().nullable(),
  programmeManagerUserId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budgetTco2e: z.number().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; programmeId: string }> }) {
  try {
    const { orgId, programmeId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const programme = await prisma.programme.findUnique({
      where: { id: programmeId },
      include: {
        programmeManager: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        projects: { select: { id: true, name: true, status: true } },
      },
    });
    if (!programme || programme.organizationId !== orgId) return apiError("NOT_FOUND", "Programme not found", 404);
    return NextResponse.json(programme);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; programmeId: string }> }) {
  try {
    const { orgId, programmeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { organizationId: true } });
    if (!programme || programme.organizationId !== orgId) return apiError("NOT_FOUND", "Programme not found", 404);

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.programme.update({
      where: { id: programmeId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status as never }),
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.programmeManagerUserId !== undefined && { programmeManagerUserId: body.programmeManagerUserId }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.budgetTco2e !== undefined && { budgetTco2e: body.budgetTco2e }),
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "programme.updated", resourceType: "Programme", resourceId: programmeId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; programmeId: string }> }) {
  try {
    const { orgId, programmeId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { organizationId: true, name: true } });
    if (!programme || programme.organizationId !== orgId) return apiError("NOT_FOUND", "Programme not found", 404);

    await prisma.programme.delete({ where: { id: programmeId } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "programme.deleted", resourceType: "Programme", resourceId: programmeId,
      metadata: { name: programme.name },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
