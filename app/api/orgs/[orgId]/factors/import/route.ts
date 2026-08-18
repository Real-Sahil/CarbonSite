export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { requireOrgMember } from "@/lib/auth/session";
import { parseFactorWorkbook } from "@/lib/factors/import";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const MAX_FACTOR_IMPORT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "factor-imports", session.user.id),
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const factorLibraryId = String(form.get("factorLibraryId") ?? "");
    const file = form.get("file");

    if (!factorLibraryId) {
      return apiError("MISSING_FACTOR_LIBRARY", "Choose a factor library.", 422);
    }
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

    const [factorLibrary, categories] = await Promise.all([
      prisma.factorLibrary.findUnique({
        where: { id: factorLibraryId },
        select: { id: true, name: true, version: true },
      }),
      prisma.emissionCategory.findMany({
        select: { id: true, code: true, scope: true, activityType: true },
      }),
    ]);

    if (!factorLibrary) {
      return apiError("INVALID_FACTOR_LIBRARY", "Factor library does not exist.", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseFactorWorkbook(buffer, file.name, categories);
    if (parsed.errors.length > 0) {
      return apiError("INVALID_FACTOR_IMPORT", parsed.errors.join("\n"), 422);
    }
    if (parsed.rows.length === 0) {
      return apiError("EMPTY_FACTOR_IMPORT", "No factor rows were found.", 422);
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
