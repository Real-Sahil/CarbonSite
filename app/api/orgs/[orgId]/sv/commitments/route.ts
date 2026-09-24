export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSvCommitmentSchema } from "@/lib/validation/org";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contractId") ?? undefined;
    const frameworkId = searchParams.get("frameworkId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const reportingPeriodId = searchParams.get("reportingPeriodId") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const commitments = await prisma.svCommitment.findMany({
      where: {
        organizationId: orgId,
        ...(contractId && { contractId }),
        ...(frameworkId && { frameworkId }),
        ...(status && { status: status as never }),
        ...(reportingPeriodId && { reportingPeriodId }),
      },
      include: {
        contract: { select: { id: true, name: true } },
        framework: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = commitments.length > limit;
    const data = hasMore ? commitments.slice(0, limit) : commitments;

    return NextResponse.json({
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
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
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-commitments-create", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSvCommitmentSchema.parse(await req.json());

    if (body.contractId) {
      const contract = await prisma.contract.findUnique({ where: { id: body.contractId } });
      if (!contract || contract.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Contract not found.", 404);
      }
    }
    if (body.frameworkId) {
      const framework = await prisma.svFramework.findUnique({ where: { id: body.frameworkId } });
      if (!framework || framework.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Framework not found.", 404);
      }
    }

    const commitment = await prisma.svCommitment.create({
      data: {
        organizationId: orgId,
        contractId: body.contractId,
        frameworkId: body.frameworkId,
        ownerUserId: body.ownerUserId,
        title: body.title,
        description: body.description,
        targetValue: body.targetValue != null ? new Decimal(body.targetValue) : undefined,
        targetUnit: body.targetUnit,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
        reportingPeriodId: body.reportingPeriodId,
        status: body.status ?? "draft",
        monetisedValue: body.monetisedValue != null ? new Decimal(body.monetisedValue) : undefined,
        currency: body.currency ?? "GBP",
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_commitment.create",
      resourceType: "SvCommitment",
      resourceId: commitment.id,
      metadata: { title: body.title, contractId: body.contractId },
    });

    return NextResponse.json(commitment, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
