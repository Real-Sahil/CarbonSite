export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { parseSpreadsheet } from "@/lib/imports/parser";
import { detectActivityColumnMapping, CANONICAL_FIELDS } from "@/lib/imports/column-mapper";

// Returns column mapping preview for a file before committing to a full import.
// Used by the HelloCSV-style mapping review UI.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return apiError("MISSING_FILE", "Attach a CSV or XLSX file to preview.", 422);
    }

    const allowedExts = [".csv", ".xlsx", ".xls"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return apiError("BAD_REQUEST", "File must be CSV or Excel.", 400);
    }
    if (file.size > 50 * 1024 * 1024) {
      return apiError("TOO_LARGE", "File must be under 50 MB.", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseSpreadsheet(buffer, file.name);

    // Return first 5 data rows as preview so the UI can show real values.
    const previewRows = rows.slice(0, 5);

    const mapping = detectActivityColumnMapping(headers);

    return NextResponse.json({
      headers,
      previewRows,
      mapping,
      fields: CANONICAL_FIELDS,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
