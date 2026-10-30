export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/db/audit";
import { ROLE_GROUPS, requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LAYOUT_CATALOGUE, layoutSchema } from "@/lib/reports/layout";
import { loadReportLayout, resetReportLayout, saveReportLayout } from "@/lib/reports/layout/store";

type Ctx = { params: Promise<{ orgId: string; reportType: string }> };

function unknownType(reportType: string) {
  return LAYOUT_CATALOGUE[reportType] ? null : apiError("NOT_FOUND", "This report type has no custom layout.", 404);
}

/** The layout in force, with the blocks the report type offers. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, reportType } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const missing = unknownType(reportType);
    if (missing) return missing;
    return NextResponse.json({
      catalogue: LAYOUT_CATALOGUE[reportType],
      blocks: await loadReportLayout(orgId, reportType),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Saves the order, hidden blocks and renamed headings. Figures are never part of a layout. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, reportType } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const missing = unknownType(reportType);
    if (missing) return missing;
    const input = layoutSchema.parse(await req.json());
    const saved = await saveReportLayout(orgId, reportType, session.user.id, input);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report_layout.saved",
      resourceType: "ReportLayout",
      resourceId: reportType,
      metadata: { reportType, version: saved.version, hidden: saved.blocks.filter((b) => "hidden" in b).length },
    });
    return NextResponse.json({ version: saved.version, blocks: await loadReportLayout(orgId, reportType) });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Back to the catalogue default. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, reportType } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const missing = unknownType(reportType);
    if (missing) return missing;
    await resetReportLayout(orgId, reportType);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report_layout.reset",
      resourceType: "ReportLayout",
      resourceId: reportType,
      metadata: { reportType },
    });
    return NextResponse.json({ blocks: await loadReportLayout(orgId, reportType) });
  } catch (err) {
    return handleRouteError(err);
  }
}
