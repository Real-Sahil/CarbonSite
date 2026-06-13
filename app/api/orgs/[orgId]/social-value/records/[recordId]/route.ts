import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; recordId: string }> },
) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const limited = rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-records-delete", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const record = await prisma.socialValueRecord.findUnique({ where: { id: recordId } });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Social value record not found.", 404);
    }

    await prisma.socialValueRecord.delete({ where: { id: recordId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "social_value_record.deleted",
      resourceType: "social_value_record",
      resourceId: recordId,
      metadata: { contractId: record.contractId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
