export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";
import { REGISTERS, isRegisterKey } from "@/lib/management-systems/registers/config";
import { applyRules, delegate, registerRefsMessage, registerSchema, serialize } from "@/lib/management-systems/registers/server";

type Params = { params: Promise<{ orgId: string; register: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, register, id } = await params;
    if (!isRegisterKey(register)) return apiError("NOT_FOUND", "Unknown register.", 404);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = registerSchema(register, "update").parse(await req.json()) as Record<string, unknown>;

    const existing = await delegate(register).findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", `That ${REGISTERS[register].singular} was not found.`, 404);
    const refs = await registerRefsMessage(orgId, register, body);
    if (refs) return apiError("NOT_FOUND", refs, 404);
    const { data, error } = applyRules(register, existing, body, session.user.id);
    if (error) return apiError("VALIDATION_ERROR", error, 422);

    const row = await delegate(register).update({ where: { id: existing.id }, data });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.register_updated",
      resourceType: REGISTERS[register].evidenceKind,
      resourceId: row.id,
      metadata: { register, changed: Object.keys(data), status: row.status ?? null },
    });
    return Response.json(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Delete a row and any evidence links pointing at it. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, register, id } = await params;
    if (!isRegisterKey(register)) return apiError("NOT_FOUND", "Unknown register.", 404);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const existing = await delegate(register).findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", `That ${REGISTERS[register].singular} was not found.`, 404);

    const kind = REGISTERS[register].evidenceKind as "ms_risk";
    await prisma.$transaction([
      prisma.msEvidenceLink.deleteMany({ where: { organizationId: orgId, kind, targetId: existing.id } }),
      ...(register === "audits" ? [prisma.msEvidenceLink.deleteMany({ where: { organizationId: orgId, kind: "ms_audit_finding", targetId: { in: (await prisma.msAuditFinding.findMany({ where: { auditId: existing.id, organizationId: orgId }, select: { id: true } })).map((f) => f.id) } } })] : []),
    ]);
    await delegate(register).delete({ where: { id: existing.id } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.register_deleted",
      resourceType: REGISTERS[register].evidenceKind,
      resourceId: existing.id,
      metadata: { register, title: existing[REGISTERS[register].titleField] ?? null },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
