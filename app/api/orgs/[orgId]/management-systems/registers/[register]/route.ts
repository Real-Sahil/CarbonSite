export const dynamic = "force-dynamic";

// A management system register (risks, interested parties, policies, audits,
// audit findings, corrective actions, management reviews): list and create.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { REGISTERS, isRegisterKey } from "@/lib/management-systems/registers/config";
import { createRuleError, delegate, listRows, registerRefsMessage, registerSchema, serialize } from "@/lib/management-systems/registers/server";

type Params = { params: Promise<{ orgId: string; register: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, register } = await params;
    if (!isRegisterKey(register)) return apiError("NOT_FOUND", "Unknown register.", 404);
    await requireOrgMember(orgId, ...MS_READERS);
    return Response.json({ data: await listRows(orgId, register) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, register } = await params;
    if (!isRegisterKey(register)) return apiError("NOT_FOUND", "Unknown register.", 404);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = registerSchema(register, "create").parse(await req.json()) as Record<string, unknown>;

    const refs = await registerRefsMessage(orgId, register, body);
    if (refs) return apiError("NOT_FOUND", refs, 404);
    const ruleError = createRuleError(register, body);
    if (ruleError) return apiError("VALIDATION_ERROR", ruleError, 422);

    const data: Record<string, unknown> = { ...body, organizationId: orgId, createdByUserId: session.user.id };
    if (register === "policies" && body.status === "approved") {
      data.approvedByUserId = session.user.id;
      data.approvedOn = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    }
    const row = await delegate(register).create({ data });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.register_created",
      resourceType: REGISTERS[register].evidenceKind,
      resourceId: row.id,
      metadata: { register },
    });
    return Response.json(serialize(row), { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
