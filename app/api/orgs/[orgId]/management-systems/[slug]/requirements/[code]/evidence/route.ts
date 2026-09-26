export const dynamic = "force-dynamic";

// Link evidence to a requirement: one of the organisation's own records
// (checked against the organisation first), a URL or a note.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { getFramework, headingCodes } from "@/lib/management-systems/catalogue";
import { MS_EDITORS, evidenceCreateSchema } from "@/lib/management-systems/access";
import { findRecordLabel, isRecordKind } from "@/lib/management-systems/evidence";

type Params = { params: Promise<{ orgId: string; slug: string; code: string }> };

const MAX_LINKS_PER_REQUIREMENT = 100;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug, code: rawCode } = await params;
    const code = decodeURIComponent(rawCode);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = evidenceCreateSchema.parse(await req.json());

    const framework = getFramework(slug);
    if (!framework?.requirements.some((r) => r.code === code) || headingCodes(framework).has(code)) {
      return apiError("NOT_FOUND", "That requirement is not in the catalogue.", 404);
    }
    const adoption = await prisma.msFrameworkAdoption.findUnique({
      where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: slug } },
      select: { id: true },
    });
    if (!adoption) return apiError("NOT_FOUND", "Adopt this framework before linking evidence.", 404);

    const count = await prisma.msEvidenceLink.count({ where: { organizationId: orgId, frameworkSlug: slug, requirementCode: code } });
    if (count >= MAX_LINKS_PER_REQUIREMENT) return apiError("LIMIT_REACHED", "This requirement already has 100 pieces of evidence.", 422);

    let data: { kind: typeof body.kind; targetId: string | null; url: string | null; label: string; note: string | null };
    if (body.kind === "url") {
      data = { kind: "url", targetId: null, url: body.url, label: body.label, note: body.note ?? null };
    } else if (body.kind === "note") {
      data = { kind: "note", targetId: null, url: null, label: body.label, note: body.note ?? null };
    } else {
      if (!isRecordKind(body.kind)) return apiError("VALIDATION_ERROR", "Unknown evidence kind.", 422);
      const label = await findRecordLabel(orgId, body.kind, body.targetId);
      if (!label) return apiError("NOT_FOUND", "That record was not found in this organisation.", 404);
      data = { kind: body.kind, targetId: body.targetId, url: null, label, note: body.note ?? null };
    }

    const link = await prisma.msEvidenceLink.create({
      data: { organizationId: orgId, frameworkSlug: slug, requirementCode: code, createdByUserId: session.user.id, ...data },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.evidence_linked",
      resourceType: "MsEvidenceLink",
      resourceId: link.id,
      metadata: { frameworkSlug: slug, requirementCode: code, kind: link.kind, targetId: link.targetId },
    });
    return Response.json(link, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
