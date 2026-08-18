export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSocialValueTargetSchema } from "@/lib/validation/org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "editor", "reviewer", "viewer", "auditor", "contract_manager",
    );

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contractId") ?? undefined;

    const targets = await prisma.socialValueTarget.findMany({
      where: { organizationId: orgId, contractId },
      include: {
        contract: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(targets);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-targets-create", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSocialValueTargetSchema.parse(await req.json());

    // Verify contract belongs to org
    const contract = await prisma.contract.findUnique({ where: { id: body.contractId } });
    if (!contract || contract.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Contract not found.", 404);
    }

    const target = await prisma.socialValueTarget.upsert({
      where: {
        organizationId_contractId_reportingPeriodId: {
          organizationId: orgId,
          contractId: body.contractId,
          reportingPeriodId: body.reportingPeriodId,
        },
      },
      create: {
        organizationId: orgId,
        contractId: body.contractId,
        reportingPeriodId: body.reportingPeriodId,
        targetPounds: body.targetPounds,
        baselinePounds: body.baselinePounds ?? null,
        notes: body.notes ?? null,
      },
      update: {
        targetPounds: body.targetPounds,
        baselinePounds: body.baselinePounds ?? null,
        notes: body.notes ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "social_value_target.upserted",
      resourceType: "social_value_target",
      resourceId: target.id,
      metadata: { contractId: body.contractId, targetPounds: String(body.targetPounds) },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
