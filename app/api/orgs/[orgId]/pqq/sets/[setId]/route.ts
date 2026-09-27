export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { PQQ_EDITORS } from "@/lib/pqq/access";
import { questionSetSchema } from "@/lib/pqq/sets";

type Params = { params: Promise<{ orgId: string; setId: string }> };

/** Replace a questionnaire's details or question mapping. */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, setId } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const body = questionSetSchema.parse(await req.json());
    const existing = await prisma.pqqQuestionSet.findFirst({ where: { id: setId, organizationId: orgId }, select: { id: true } });
    if (!existing) return apiError("NOT_FOUND", "Questionnaire not found.", 404);
    await prisma.pqqQuestionSet.update({
      where: { id: existing.id },
      data: { name: body.name, issuer: body.issuer ?? null, dueOn: body.dueOn ? new Date(`${body.dueOn}T00:00:00Z`) : null, questions: body.questions },
    });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "management_system.pqq_set_saved", resourceType: "PqqQuestionSet", resourceId: existing.id, metadata: { name: body.name, questions: body.questions.length } });
    return Response.json({ id: existing.id });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Delete a questionnaire. The answers stay: other questionnaires use them. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, setId } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const existing = await prisma.pqqQuestionSet.findFirst({ where: { id: setId, organizationId: orgId }, select: { id: true, name: true } });
    if (!existing) return apiError("NOT_FOUND", "Questionnaire not found.", 404);
    await prisma.pqqQuestionSet.delete({ where: { id: existing.id } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "management_system.pqq_set_saved", resourceType: "PqqQuestionSet", resourceId: existing.id, metadata: { deleted: true, name: existing.name } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
