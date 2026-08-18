export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSocialValueRecordSchema } from "@/lib/validation/org";
import { Decimal } from "@prisma/client/runtime/library";

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
    const reportingPeriodId = searchParams.get("reportingPeriodId") ?? undefined;

    const records = await prisma.socialValueRecord.findMany({
      where: {
        organizationId: orgId,
        contractId,
        reportingPeriodId,
      },
      include: {
        measure: { include: { theme: true } },
        contract: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        evidenceFile: { select: { id: true, filename: true, storageKey: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(records);
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
      "admin", "sustainability_director", "sustainability_manager",
      "contract_manager", "editor",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-records-create", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSocialValueRecordSchema.parse(await req.json());

    // Verify contract belongs to org
    const contract = await prisma.contract.findUnique({ where: { id: body.contractId } });
    if (!contract || contract.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Contract not found.", 404);
    }

    // Verify measure exists
    const measure = await prisma.socialValueMeasure.findUnique({ where: { id: body.measureId } });
    if (!measure || !measure.active) {
      return apiError("NOT_FOUND", "Social value measure not found.", 404);
    }

    const valuePounds = new Decimal(body.quantity).mul(measure.valuePerUnit);

    const record = await prisma.socialValueRecord.create({
      data: {
        organizationId: orgId,
        contractId: body.contractId,
        reportingPeriodId: body.reportingPeriodId,
        measureId: body.measureId,
        quantity: body.quantity,
        valuePounds,
        evidenceFileId: body.evidenceFileId ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
      include: {
        measure: { include: { theme: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "social_value_record.created",
      resourceType: "social_value_record",
      resourceId: record.id,
      metadata: {
        contractId: body.contractId,
        measureId: body.measureId,
        quantity: body.quantity,
        valuePounds: valuePounds.toString(),
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
