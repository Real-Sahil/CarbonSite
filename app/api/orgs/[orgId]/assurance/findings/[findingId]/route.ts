export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { respondToFindingSchema, resolveFindingSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string; findingId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;
// Management response can come from anyone who can act on behalf of the org
// being audited, which is a broader group than who can raise or resolve findings.
const RESPOND_ROLES = ["admin", "sustainability_director", "sustainability_manager", "editor"] as const;

/** Records management's response to a finding. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, findingId } = await params;
    const { session } = await requireOrgMember(orgId, ...RESPOND_ROLES);

    const finding = await prisma.assuranceFinding.findFirst({
      where: { id: findingId, organizationId: orgId },
      include: { engagement: { select: { status: true } } },
    });
    if (!finding) return apiError("NOT_FOUND", "Finding not found.", 404);
    if (finding.engagement.status === "signed" || finding.engagement.status === "withdrawn") {
      return apiError("ENGAGEMENT_CLOSED", `This engagement is ${finding.engagement.status}.`, 409);
    }
    if (finding.status === "resolved" || finding.status === "qualified") {
      return apiError("ALREADY_RESOLVED", "This finding is already closed.", 409);
    }

    const body = respondToFindingSchema.parse(await req.json());

    const updated = await prisma.assuranceFinding.update({
      where: { id: findingId },
      data: {
        managementResponse: body.managementResponse,
        managementRespondedAt: new Date(),
        managementRespondedByUserId: session.user.id,
        status: "management_responded",
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.finding_management_response",
      resourceType: "AssuranceFinding",
      resourceId: findingId,
      metadata: { title: finding.title },
    });

    return Response.json({
      ...updated,
      quantifiedImpactCo2e: updated.quantifiedImpactCo2e === null ? null : Number(updated.quantifiedImpactCo2e),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** The assuror closes the finding, either resolved or formally qualified. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, findingId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const finding = await prisma.assuranceFinding.findFirst({
      where: { id: findingId, organizationId: orgId },
      include: { engagement: { select: { status: true } } },
    });
    if (!finding) return apiError("NOT_FOUND", "Finding not found.", 404);
    if (finding.status === "resolved" || finding.status === "qualified") {
      return apiError("ALREADY_RESOLVED", "This finding is already closed.", 409);
    }

    const body = resolveFindingSchema.parse(await req.json());

    // A material misstatement being marked "resolved" rather than "qualified"
    // needs management to have actually responded first — an assuror cannot
    // wave away the platform's most severe finding tier without a paper trail.
    if (body.status === "resolved" && finding.severity === "material_misstatement" && !finding.managementResponse) {
      return apiError(
        "RESPONSE_REQUIRED",
        "A material misstatement cannot be marked resolved without a recorded management response explaining the correction.",
        422,
      );
    }

    const updated = await prisma.assuranceFinding.update({
      where: { id: findingId },
      data: { status: body.status, resolvedAt: new Date() },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.finding_resolved",
      resourceType: "AssuranceFinding",
      resourceId: findingId,
      metadata: { title: finding.title, status: body.status, severity: finding.severity },
    });

    return Response.json({
      ...updated,
      quantifiedImpactCo2e: updated.quantifiedImpactCo2e === null ? null : Number(updated.quantifiedImpactCo2e),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
