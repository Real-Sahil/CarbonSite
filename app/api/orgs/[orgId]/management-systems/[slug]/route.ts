export const dynamic = "force-dynamic";

// One adopted framework: the page's data (GET) and the adoption's status and
// certificate details (PATCH).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { loadFrameworkView } from "@/lib/management-systems/load";
import { MS_EDITORS, MS_READERS, adoptionUpdateSchema } from "@/lib/management-systems/access";

type Params = { params: Promise<{ orgId: string; slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug } = await params;
    await requireOrgMember(orgId, ...MS_READERS);
    const view = await loadFrameworkView(orgId, slug);
    if (!view) return apiError("NOT_FOUND", "That framework is not in the catalogue.", 404);
    return Response.json(view);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug } = await params;
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const body = adoptionUpdateSchema.parse(await req.json());
    const adoption = await prisma.msFrameworkAdoption.findUnique({
      where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: slug } },
    });
    if (!adoption) return apiError("NOT_FOUND", "This framework has not been adopted.", 404);

    const updated = await prisma.msFrameworkAdoption.update({ where: { id: adoption.id }, data: body });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.adoption_updated",
      resourceType: "MsFrameworkAdoption",
      resourceId: adoption.id,
      metadata: { frameworkSlug: slug, changed: Object.keys(body), status: updated.status },
    });
    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
