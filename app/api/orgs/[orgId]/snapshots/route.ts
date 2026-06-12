import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const createSnapshotSchema = z.object({
  reportingPeriodId: z.string().min(1),
  calculationRunId: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const snapshots = await prisma.publishedSnapshot.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        calculationRun: {
          include: {
            factorLibrary: { select: { name: true, version: true } },
            methodologyVersion: { select: { name: true } },
          },
        },
        publishedBy: { select: { name: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { publishedAt: "desc" },
    });

    return NextResponse.json({ data: snapshots });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createSnapshotSchema.parse(await req.json());

    // Verify period and run belong to this org
    const [period, run] = await Promise.all([
      prisma.reportingPeriod.findUnique({
        where: { id: body.reportingPeriodId },
        select: { organizationId: true, status: true },
      }),
      prisma.calculationRun.findUnique({
        where: { id: body.calculationRunId },
        select: { organizationId: true, reportingPeriodId: true, status: true },
      }),
    ]);

    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }
    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }
    if (run.status !== "succeeded") {
      return apiError("CONFLICT", "Calculation run has not succeeded yet.", 409);
    }
    if (run.reportingPeriodId !== body.reportingPeriodId) {
      return apiError("CONFLICT", "Calculation run belongs to a different reporting period.", 409);
    }

    // Determine version number for this period
    const latestSnapshot = await prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId, reportingPeriodId: body.reportingPeriodId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latestSnapshot?.version ?? 0) + 1;

    const snapshot = await prisma.publishedSnapshot.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        calculationRunId: body.calculationRunId,
        publishedByUserId: session.user.id,
        version,
      },
      include: {
        reportingPeriod: { select: { label: true } },
        calculationRun: {
          include: {
            factorLibrary: { select: { name: true, version: true } },
            methodologyVersion: { select: { name: true } },
          },
        },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.published",
      resourceType: "published_snapshot",
      resourceId: snapshot.id,
      metadata: { reportingPeriodId: body.reportingPeriodId, version },
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
