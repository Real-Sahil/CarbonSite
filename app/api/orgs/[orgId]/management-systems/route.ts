export const dynamic = "force-dynamic";

// Management systems overview: the framework catalogue and what the
// organisation has adopted (GET), and adopting a framework (POST).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { getFramework } from "@/lib/management-systems/catalogue";
import { catalogueSummary, loadAdoptions } from "@/lib/management-systems/load";
import { MS_EDITORS, MS_READERS, adoptSchema } from "@/lib/management-systems/access";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...MS_READERS);
    return Response.json({ catalogue: catalogueSummary(), adoptions: await loadAdoptions(orgId) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const { frameworkSlug } = adoptSchema.parse(await req.json());
    const framework = getFramework(frameworkSlug);
    if (!framework) return apiError("NOT_FOUND", "That framework is not in the catalogue.", 404);

    const existing = await prisma.msFrameworkAdoption.findUnique({
      where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug } },
    });
    // Adopting again brings a withdrawn framework back with its history intact.
    const adoption = existing
      ? await prisma.msFrameworkAdoption.update({
          where: { id: existing.id },
          data: { status: existing.status === "withdrawn" ? "implementing" : existing.status },
        })
      : await prisma.msFrameworkAdoption.create({
          data: { organizationId: orgId, frameworkSlug, adoptedByUserId: session.user.id },
        });

    if (!existing || existing.status === "withdrawn") {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "management_system.adopted",
        resourceType: "MsFrameworkAdoption",
        resourceId: adoption.id,
        metadata: { frameworkSlug, name: framework.name },
      });
    }
    return Response.json(adoption, { status: existing ? 200 : 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
