export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "auditor", "sustainability_director");

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const format = url.searchParams.get("format") ?? "json";

    if (!fromParam) {
      return apiError("MISSING_PARAM", "Query parameter 'from' is required.", 400);
    }

    const fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      return apiError("INVALID_PARAM", "'from' must be a valid ISO date.", 400);
    }

    const toDate = toParam ? new Date(toParam) : new Date();
    if (isNaN(toDate.getTime())) {
      return apiError("INVALID_PARAM", "'to' must be a valid ISO date.", 400);
    }

    if (format !== "csv" && format !== "json") {
      return apiError("INVALID_PARAM", "'format' must be 'csv' or 'json'.", 400);
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: {
        actor: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    if (format === "csv") {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "audit.export_downloaded",
        resourceType: "audit_log",
        resourceId: orgId,
        metadata: { from: fromParam, to: toParam ?? new Date().toISOString(), count: logs.length },
      });

      const csvRows: string[] = [
        "timestamp,actor_name,actor_email,action,resource_type,resource_id,metadata",
      ];

      for (const log of logs) {
        const timestamp = log.createdAt.toISOString();
        const actorName = escapeCsvField(log.actor?.name ?? "");
        const actorEmail = escapeCsvField(log.actor?.email ?? "");
        const action = escapeCsvField(log.action);
        const resourceType = escapeCsvField(log.resourceType);
        const resourceId = escapeCsvField(log.resourceId);
        const metadata = escapeCsvField(JSON.stringify(log.metadata));
        csvRows.push(`${timestamp},${actorName},${actorEmail},${action},${resourceType},${resourceId},${metadata}`);
      }

      const csvBody = csvRows.join("\r\n");

      return new NextResponse(csvBody, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-${orgId}.csv"`,
        },
      });
    }

    // JSON format (default)
    return NextResponse.json({ data: logs, total: logs.length });
  } catch (err) {
    return handleRouteError(err);
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
