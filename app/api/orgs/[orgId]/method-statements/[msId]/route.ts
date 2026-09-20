import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  status: z.enum(["draft", "issued", "signed_off", "superseded"]).optional(),
  title: z.string().min(1).optional(),
  version: z.string().optional(),
  riskAssessmentText: z.string().optional().nullable(),
  methodText: z.string().optional().nullable(),
  ppeRequired: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  signedOffByUserId: z.string().optional().nullable(),
  signedOffAt: z.string().datetime().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; msId: string }> }) {
  try {
    const { orgId, msId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const ms = await prisma.methodStatement.findUnique({
      where: { id: msId },
      include: {
        createdBy: { select: { id: true, name: true } },
        signedOffBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    if (!ms || ms.organizationId !== orgId) return apiError("NOT_FOUND", "Method statement not found", 404);
    return NextResponse.json(ms);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; msId: string }> }) {
  try {
    const { orgId, msId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const ms = await prisma.methodStatement.findUnique({ where: { id: msId }, select: { organizationId: true, status: true } });
    if (!ms || ms.organizationId !== orgId) return apiError("NOT_FOUND", "Method statement not found", 404);

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.methodStatement.update({
      where: { id: msId },
      data: {
        ...(body.status && { status: body.status as never }),
        ...(body.title && { title: body.title }),
        ...(body.version && { version: body.version }),
        ...(body.riskAssessmentText !== undefined && { riskAssessmentText: body.riskAssessmentText }),
        ...(body.methodText !== undefined && { methodText: body.methodText }),
        ...(body.ppeRequired !== undefined && { ppeRequired: body.ppeRequired }),
        ...(body.issuedAt !== undefined && { issuedAt: body.issuedAt ? new Date(body.issuedAt) : null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
        ...(body.signedOffByUserId !== undefined && { signedOffByUserId: body.signedOffByUserId }),
        ...(body.signedOffAt !== undefined && { signedOffAt: body.signedOffAt ? new Date(body.signedOffAt) : null }),
      },
    });

    const action = body.status === "issued"
      ? "method_statement.issued"
      : body.status === "signed_off"
      ? "method_statement.signed_off"
      : body.status === "superseded"
      ? "method_statement.superseded"
      : "method_statement.created";

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action,
      resourceType: "MethodStatement",
      resourceId: msId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; msId: string }> }) {
  try {
    const { orgId, msId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const ms = await prisma.methodStatement.findUnique({ where: { id: msId }, select: { organizationId: true } });
    if (!ms || ms.organizationId !== orgId) return apiError("NOT_FOUND", "Method statement not found", 404);

    await prisma.methodStatement.delete({ where: { id: msId } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "method_statement.deleted", resourceType: "MethodStatement", resourceId: msId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
