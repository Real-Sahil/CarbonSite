export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { requireSharedLibraryEditor } from "@/lib/auth/shared-libraries";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { parseFactorWorkbook, type ParsedFactorRow } from "@/lib/factors/import";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const MAX_FACTOR_IMPORT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "factor-imports", session.user.id),
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const factorLibraryId = String(form.get("factorLibraryId") ?? "");
    const file = form.get("file");

    // With a library chosen this writes shared reference data every tenant
    // reads, so only platform staff may. Without one it writes the org's own
    // factors, which only this org's calculations use.
    if (factorLibraryId) await requireSharedLibraryEditor(orgId);

    if (!(file instanceof File)) {
      return apiError("MISSING_FILE", "Attach a CSV or XLSX factor file.", 422);
    }

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return apiError("UNSUPPORTED_FACTOR_FILE", "Only CSV and XLSX factor imports are supported.", 422);
    }
    if (file.size <= 0 || file.size > MAX_FACTOR_IMPORT_BYTES) {
      return apiError("INVALID_FACTOR_IMPORT_SIZE", "Factor imports must be between 1 byte and 10 MB.", 422);
    }

    const categories = await prisma.emissionCategory.findMany({
      select: { id: true, code: true, scope: true, activityType: true },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseFactorWorkbook(buffer, file.name, categories);
    if (parsed.errors.length > 0) {
      return apiError("INVALID_FACTOR_IMPORT", parsed.errors.join("\n"), 422);
    }
    if (parsed.rows.length === 0) {
      return apiError("EMPTY_FACTOR_IMPORT", "No factor rows were found.", 422);
    }

    if (!factorLibraryId) {
      return importOrganizationFactors(orgId, session.user.id, file.name, parsed.rows);
    }

    const factorLibrary = await prisma.factorLibrary.findUnique({
      where: { id: factorLibraryId },
      select: { id: true, name: true, version: true },
    });
    if (!factorLibrary) {
      return apiError("INVALID_FACTOR_LIBRARY", "Factor library does not exist.", 422);
    }

    const externalIds = parsed.rows
      .map((row) => row.externalId)
      .filter((value): value is string => Boolean(value));
    if (externalIds.length > 0) {
      const existing = await prisma.emissionFactor.findMany({
        where: {
          factorLibraryId,
          externalId: { in: externalIds },
        },
        select: { externalId: true },
      });
      if (existing.length > 0) {
        return apiError(
          "DUPLICATE_FACTOR_EXTERNAL_ID",
          `Factor external_id already exists in this library: ${existing
            .map((row) => row.externalId)
            .join(", ")}`,
          422,
        );
      }
    }

    const result = await prisma.emissionFactor.createMany({
      data: parsed.rows.map((row) => ({
        activityType: row.activityType,
        ch4: row.ch4,
        co2: row.co2,
        co2e: row.co2e,
        biogenicCo2: row.biogenicCo2,
        effectiveEndDate: row.effectiveEndDate,
        effectiveStartDate: row.effectiveStartDate,
        emissionCategoryId: row.emissionCategoryId,
        externalId: row.externalId,
        factorLibraryId,
        geographyCountry: row.geographyCountry,
        geographyRegion: row.geographyRegion,
        inputUnit: row.inputUnit,
        n2o: row.n2o,
        scope: row.scope,
        uncertaintyRating: row.uncertaintyRating,
        usageNotes: row.usageNotes,
        priceBaseYear: row.priceBaseYear,
      })),
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "factor.library_imported",
      resourceType: "factor_library",
      resourceId: factorLibraryId,
      metadata: {
        factorLibrary: `${factorLibrary.name} ${factorLibrary.version}`,
        filename: file.name,
        importedRows: result.count,
      },
    });

    return NextResponse.json(
      {
        factorLibraryId,
        importedRows: result.count,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const identityOf = (r: {
  scope: number;
  emissionCategoryId: string | null;
  activityType: string | null;
  geographyCountry: string | null;
  geographyRegion: string | null;
  inputUnit: string;
}) =>
  [r.scope, r.emissionCategoryId, r.activityType, r.geographyCountry, r.geographyRegion, r.inputUnit]
    .map((v) => v ?? "")
    .join("|");

/**
 * Writes an upload into the org's own factors. A row with the same scope,
 * category, activity, geography and unit as an existing factor becomes its
 * next version, so calculations that used the old one still reproduce.
 */
async function importOrganizationFactors(orgId: string, userId: string, filename: string, rows: ParsedFactorRow[]) {
  const uncategorised = rows.filter((r) => !r.emissionCategoryId).length;
  if (uncategorised > 0) {
    return apiError(
      "MISSING_FACTOR_CATEGORY",
      `${uncategorised} row(s) have no emission_category_code. Organisation factors apply by category, so every row needs one.`,
      422,
    );
  }

  const existing = await prisma.organizationEmissionFactor.findMany({
    where: { organizationId: orgId },
    select: {
      scope: true, emissionCategoryId: true, activityType: true,
      geographyCountry: true, geographyRegion: true, inputUnit: true, version: true,
    },
  });
  const latest = new Map<string, number>();
  for (const f of existing) {
    const key = identityOf(f);
    latest.set(key, Math.max(latest.get(key) ?? 0, f.version));
  }

  const data = rows.map((row) => {
    const key = identityOf(row);
    const version = (latest.get(key) ?? 0) + 1;
    latest.set(key, version);
    return {
      organizationId: orgId,
      scope: row.scope,
      emissionCategoryId: row.emissionCategoryId,
      activityType: row.activityType,
      geographyCountry: row.geographyCountry,
      geographyRegion: row.geographyRegion,
      effectiveStartDate: row.effectiveStartDate,
      effectiveEndDate: row.effectiveEndDate,
      inputUnit: row.inputUnit,
      co2: row.co2,
      ch4: row.ch4,
      n2o: row.n2o,
      co2e: row.co2e,
      uncertaintyRating: row.uncertaintyRating,
      usageNotes: row.usageNotes,
      priceBaseYear: row.priceBaseYear,
      source: "uploaded_csv",
      version,
      createdByUserId: userId,
    };
  });

  const result = await prisma.organizationEmissionFactor.createMany({ data });

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "factor.organization_imported",
    resourceType: "organization_emission_factor",
    resourceId: orgId,
    metadata: { filename, importedRows: result.count },
  });

  return NextResponse.json({ target: "organization", importedRows: result.count }, { status: 201 });
}
