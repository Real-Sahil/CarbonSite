export const dynamic = "force-dynamic";

// A management system register (lib/management-systems/registers/config.ts):
// list and create.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { REGISTERS, isRegisterKey } from "@/lib/management-systems/registers/config";
import { afterSave, createDefaults, createRuleError, delegate, enrich, listRows, registerRefsMessage, registerSchema, serialize } from "@/lib/management-systems/registers/server";

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

    const enriched = { ...body };
    const enrichError = await enrich(orgId, register, enriched);
    if (enrichError) return apiError("VALIDATION_ERROR", enrichError, 422);
    const data: Record<string, unknown> = { ...enriched, ...createDefaults(register, enriched, session.user.id), organizationId: orgId, createdByUserId: session.user.id };
    const row = await afterSave(orgId, register, await delegate(register).create({ data }), session.user.id);
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
