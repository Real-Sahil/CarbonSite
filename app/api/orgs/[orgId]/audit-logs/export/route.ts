import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const QuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

// GET /api/orgs/[orgId]/audit-logs/export
// Streams a CSV (or JSON) export of the org's audit log. Max 10,000 rows.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "auditor");

    const search = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = QuerySchema.safeParse(search);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.flatten());
    }

    const { action, resourceType, from, to, format } = parsed.data;

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(action ? { action } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "audit.export_downloaded",
      resourceType: "AuditLog",
      resourceId: orgId,
      metadata: { rows: logs.length, format },
    });

    if (format === "json") {
      return new NextResponse(JSON.stringify({ data: logs }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit-${orgId}-${Date.now()}.json"`,
        },
      });
    }

    const HEADERS = [
      "id",
      "createdAt",
      "action",
      "resourceType",
      "resourceId",
      "actorName",
      "actorEmail",
      "metadata",
    ];

    const rows = logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      actorName: l.actor?.name ?? "",
      actorEmail: l.actor?.email ?? "",
      metadata: JSON.stringify(l.metadata),
    }));

    const csv = toCSV(rows, HEADERS);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-${orgId}-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
