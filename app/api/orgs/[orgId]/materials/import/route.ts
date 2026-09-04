export const dynamic = "force-dynamic";

// Bulk create/update for the embodied carbon material library
// (EmbodiedMaterial). Unlike EmissionFactor (versioned, immutable once
// imported), a material is upserted by its unique name — re-importing an
// existing name with a corrected or previously-missing figure (most
// commonly: C1-C4 end-of-life and replacementCycleYears, which nothing
// seeds by default) updates that row in place. The library is shared
// across every organisation, exactly like the DEFRA/EPA factor libraries,
// so this write is not organization-scoped even though the route lives
// under an org path — the URL only decides who is allowed to make the
// change, via requireOrgMember.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { requireOrgMember } from "@/lib/auth/session";
import { parseMaterialWorkbook } from "@/lib/materials/import";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const MAX_MATERIAL_IMPORT_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "material-imports", session.user.id),
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return apiError("MISSING_FILE", "Attach a CSV or XLSX material file.", 422);
    }
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return apiError("UNSUPPORTED_MATERIAL_FILE", "Only CSV and XLSX material imports are supported.", 422);
    }
    if (file.size <= 0 || file.size > MAX_MATERIAL_IMPORT_BYTES) {
      return apiError("INVALID_MATERIAL_IMPORT_SIZE", "Material imports must be between 1 byte and 5 MB.", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseMaterialWorkbook(buffer, file.name);
    if (parsed.errors.length > 0) {
      return apiError("INVALID_MATERIAL_IMPORT", parsed.errors.join("\n"), 422);
    }
    if (parsed.rows.length === 0) {
      return apiError("EMPTY_MATERIAL_IMPORT", "No material rows were found.", 422);
    }

    const existing = await prisma.embodiedMaterial.findMany({
      where: { name: { in: parsed.rows.map((row) => row.name) } },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((row) => row.name));

    let createdCount = 0;
    let updatedCount = 0;
    for (const row of parsed.rows) {
      const data = {
        category: row.category,
        description: row.description,
        gwpA1A3: row.gwpA1A3,
        gwpA4: row.gwpA4,
        gwpA5: row.gwpA5,
        gwpC1C4: row.gwpC1C4,
        gwpC1: row.gwpC1,
        gwpC2: row.gwpC2,
        gwpC3: row.gwpC3,
        gwpC4: row.gwpC4,
        gwpD: row.gwpD,
        replacementCycleYears: row.replacementCycleYears,
        declaredUnit: row.declaredUnit,
        density: row.density,
        source: row.source,
        sourceUrl: row.sourceUrl,
      };
      await prisma.embodiedMaterial.upsert({
        where: { name: row.name },
        create: { name: row.name, ...data },
        update: data,
      });
      if (existingNames.has(row.name)) updatedCount++;
      else createdCount++;
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "material_library.imported",
      resourceType: "embodied_material",
      resourceId: orgId,
      metadata: {
        filename: file.name,
        createdCount,
        updatedCount,
      },
    });

    return NextResponse.json({ createdCount, updatedCount, totalRows: parsed.rows.length }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
