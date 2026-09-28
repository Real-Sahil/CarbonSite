export const dynamic = "force-dynamic";

/**
 * POST /api/orgs/{orgId}/import-profiles/preview (multipart): reads an export
 * in memory and stores nothing. With `sourceSystem` only, it suggests a column
 * mapping from that system's template; with `spec` (JSON) it also runs the
 * rules and lists the codes that still need one.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { parseSpreadsheet } from "@/lib/imports/parser";
import { applyProfile, profileSpecSchema, resolveColumns, SOURCE_SYSTEMS, summariseProfile, type SourceSystem } from "@/lib/imports/profiles";
import { templateFor } from "@/lib/imports/profile-templates";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("MISSING_FILE", "Attach a CSV or Excel export to preview.", 422);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(ext)) return apiError("BAD_REQUEST", "File must be CSV or Excel.", 400);
    if (file.size > 50 * 1024 * 1024) return apiError("TOO_LARGE", "File must be under 50 MB.", 413);

    const { headers, rows } = await parseSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);

    const rawSystem = form.get("sourceSystem");
    const system: SourceSystem = SOURCE_SYSTEMS.includes(rawSystem as SourceSystem) ? (rawSystem as SourceSystem) : "generic";
    const suggestedColumns = resolveColumns(templateFor(system).columns, headers);

    const rawSpec = form.get("spec");
    if (typeof rawSpec !== "string" || !rawSpec) {
      return NextResponse.json({ headers, sampleRows: rows.slice(0, 5), suggestedColumns });
    }
    let specJson: unknown;
    try {
      specJson = JSON.parse(rawSpec);
    } catch {
      return apiError("VALIDATION_ERROR", "spec is not valid JSON.", 400);
    }
    const parsed = profileSpecSchema.safeParse(specJson);
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid profile.", 400, parsed.error.flatten());

    const missing = Object.entries(parsed.data.columns)
      .filter(([, header]) => !headers.includes(header))
      .map(([key, header]) => `${key} ("${header}")`);
    if (missing.length) return apiError("COLUMNS_NOT_FOUND", `This file has no column for ${missing.join(", ")}.`, 422, { headers });

    const profiled = applyProfile(rows, parsed.data);
    const summary = summariseProfile(rows, parsed.data, profiled);
    const sample = profiled.slice(0, 10).map((p, i) => ({ rowNumber: i + 2, ...p }));
    return NextResponse.json({ headers, suggestedColumns, summary, sample });
  } catch (err) {
    return handleRouteError(err);
  }
}
