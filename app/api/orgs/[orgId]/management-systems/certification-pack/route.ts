export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/orgs/[orgId]/management-systems/certification-pack?frameworks=a,b
// Streams the certification pack for the chosen adopted frameworks.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";
import { certificationPackResponse } from "@/lib/management-systems/certification-pack";

const PACK_ROLES = [...MS_EDITORS, "auditor"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PACK_ROLES);
    const asked = (req.nextUrl.searchParams.get("frameworks") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    const adopted = await prisma.msFrameworkAdoption.findMany({
      where: { organizationId: orgId, status: { not: "withdrawn" }, ...(asked.length ? { frameworkSlug: { in: asked } } : {}) },
      select: { frameworkSlug: true },
    });
    const frameworks = adopted.map((a) => a.frameworkSlug);
    if (!frameworks.length) return apiError("NOT_FOUND", "Adopt a framework first.", 404);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.certification_pack_exported",
      resourceType: "MsFrameworkAdoption",
      resourceId: frameworks.join(","),
      metadata: { frameworks },
    });
    return certificationPackResponse({ orgId, frameworks, generatedFor: session.user.email ?? session.user.id });
  } catch (err) {
    return handleRouteError(err);
  }
}
