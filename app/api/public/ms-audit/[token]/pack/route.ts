export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The certification pack for an auditor link, limited to the link's frameworks.

import { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { resolveAuditorToken, touchAuditorAccess } from "@/lib/management-systems/auditor-access";
import { certificationPackResponse } from "@/lib/management-systems/certification-pack";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, { key: `ms-audit-pack:${token.slice(0, 32)}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const access = await resolveAuditorToken(token);
    if (!access || !access.frameworks.length) return apiError("NOT_FOUND", "This link has expired or been withdrawn.", 404);
    await touchAuditorAccess(access.id);
    await writeAuditLog({
      organizationId: access.organizationId,
      action: "management_system.certification_pack_exported",
      resourceType: "MsAuditorAccess",
      resourceId: access.id,
      metadata: { auditor: access.name, company: access.company, frameworks: access.frameworks },
    });
    return certificationPackResponse({ orgId: access.organizationId, frameworks: access.frameworks, generatedFor: `${access.name}${access.company ? `, ${access.company}` : ""}` });
  } catch (err) {
    return handleRouteError(err);
  }
}
