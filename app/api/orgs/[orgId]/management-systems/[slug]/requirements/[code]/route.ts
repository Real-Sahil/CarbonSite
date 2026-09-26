export const dynamic = "force-dynamic";

// The organisation's position on one requirement: status, owner, due date
// and notes. No row means not started, so the first save creates it.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { getFramework, headingCodes } from "@/lib/management-systems/catalogue";
import { MS_EDITORS, requirementUpdateSchema } from "@/lib/management-systems/access";

type Params = { params: Promise<{ orgId: string; slug: string; code: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug, code: rawCode } = await params;
    const code = decodeURIComponent(rawCode);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = requirementUpdateSchema.parse(await req.json());

    const framework = getFramework(slug);
    const requirement = framework?.requirements.find((r) => r.code === code);
    if (!framework || !requirement) return apiError("NOT_FOUND", "That requirement is not in the catalogue.", 404);
    if (headingCodes(framework).has(code)) return apiError("VALIDATION_ERROR", "Assess the requirements under this heading, not the heading itself.", 422);
    if (body.status === "not_applicable" && !body.notes?.trim()) {
      const current = await prisma.msRequirementStatus.findUnique({
        where: { organizationId_frameworkSlug_requirementCode: { organizationId: orgId, frameworkSlug: slug, requirementCode: code } },
        select: { notes: true },
      });
      if (!current?.notes?.trim()) return apiError("VALIDATION_ERROR", "Say why this requirement does not apply.", 422);
    }

    const adoption = await prisma.msFrameworkAdoption.findUnique({
      where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: slug } },
      select: { id: true },
    });
    if (!adoption) return apiError("NOT_FOUND", "Adopt this framework before assessing it.", 404);

    const refError = await orgRefsError(orgId, { ownerUserId: body.ownerUserId });
    if (refError) return refError;

    const key = { organizationId: orgId, frameworkSlug: slug, requirementCode: code };
    const saved = await prisma.msRequirementStatus.upsert({
      where: { organizationId_frameworkSlug_requirementCode: key },
      create: { ...key, ...body, updatedByUserId: session.user.id },
      update: { ...body, updatedByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.requirement_updated",
      resourceType: "MsRequirementStatus",
      resourceId: saved.id,
      metadata: { frameworkSlug: slug, requirementCode: code, changed: Object.keys(body), status: saved.status },
    });
    return Response.json(saved);
  } catch (err) {
    return handleRouteError(err);
  }
}
