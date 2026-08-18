export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "auditor");

    const [activityRecords, calculations, auditLog, evidenceManifest] = await Promise.all([
      prisma.activityRecord.findMany({
        where: { organizationId: orgId },
        include: {
          emissionCategory: { select: { name: true, scope: true, code: true } },
          facility: { select: { name: true } },
        },
        take: 50000,
      }),
      prisma.emissionCalculation.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          activityRecordId: true,
          totalCo2e: true,
          selectionReason: true,
          factorValue: true,
          formula: true,
          warnings: true,
          createdAt: true,
        },
        take: 50000,
      }),
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        include: {
          actor: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      prisma.evidenceFile.findMany({
        where: { organizationId: orgId },
        select: {
          filename: true,
          byteSize: true,
          checksum: true,
          createdAt: true,
        },
      }),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "audit.data_export_requested",
      resourceType: "org",
      resourceId: orgId,
      metadata: {
        activityRecordCount: activityRecords.length,
        calculationCount: calculations.length,
        auditLogCount: auditLog.length,
        evidenceFileCount: evidenceManifest.length,
      },
    });

    const bundle = {
      exportedAt: new Date().toISOString(),
      organizationId: orgId,
      activityRecords,
      calculations,
      auditLog,
      evidenceManifest,
    };

    return new NextResponse(JSON.stringify(bundle), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="carbonsite-export-${orgId}.json"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
