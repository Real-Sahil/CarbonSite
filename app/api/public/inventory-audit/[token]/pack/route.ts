export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The assurance pack for a verifier link: one snapshot, nothing else.

import { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { resolveInventoryAuditorToken, touchInventoryAuditorAccess } from "@/lib/assurance/auditor-link";
import { assurancePackResponse } from "@/lib/assurance/pack-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, { key: `inventory-audit-pack:${token.slice(0, 32)}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const access = await resolveInventoryAuditorToken(token);
    if (!access) return apiError("NOT_FOUND", "This link has expired or been withdrawn.", 404);
    await touchInventoryAuditorAccess(access.id);
    await writeAuditLog({
      organizationId: access.organizationId,
      action: "assurance.auditor_pack_exported",
      resourceType: "InventoryAuditorAccess",
      resourceId: access.id,
      metadata: { auditor: access.name, company: access.company, snapshotId: access.snapshotId },
    });
    return assurancePackResponse({
      orgId: access.organizationId,
      snapshot: { id: access.snapshot.id, version: access.snapshot.version, reportingPeriod: access.snapshot.reportingPeriod },
      engagementId: access.engagementId,
      generatedBy: `verifier link for ${access.name}${access.company ? `, ${access.company}` : ""}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
