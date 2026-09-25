export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { requireActiveBilling } from "@/lib/billing/limits";
import { orgRefsError } from "@/lib/security/org-refs";
import { RouteDistanceError } from "@/lib/geo/route-distance";
import { AttendanceError, employerSummary, groupAttendance } from "@/lib/commuting/attendance";
import { importAttendance, readAttendanceFile } from "@/lib/commuting/import";

const MAX_BYTES = 10 * 1024 * 1024;
const Fields = z.object({
  siteId: z.string().min(1),
  ownEmployers: z.array(z.string().max(200)).max(500).default([]),
  confirm: z.boolean().default(false),
});

/**
 * Site attendance export -> commuting records. Without confirm it returns a
 * preview (employers, months, warnings) so the person can say which
 * employers are their own staff; with confirm it creates the records in
 * review. The file is read in memory and never stored.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "commuting-attendance", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose an attendance export.", 400);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Files up to 10 MB can be read.", 413);
    const fields = Fields.parse({
      siteId: form.get("siteId"),
      ownEmployers: JSON.parse(String(form.get("ownEmployers") ?? "[]")),
      confirm: form.get("confirm") === "true",
    });
    const refError = await orgRefsError(orgId, { siteId: fields.siteId });
    if (refError) return refError;

    const parsed = readAttendanceFile(Buffer.from(await file.arrayBuffer()));
    if (!fields.confirm) {
      const months = groupAttendance(parsed.rows, fields.ownEmployers).map((m) => ({
        month: m.month,
        days: [...m.own, ...m.subcontractor].reduce((n, d) => n + d.days, 0),
      }));
      return NextResponse.json({ employers: employerSummary(parsed.rows), months, columns: parsed.columns, warnings: parsed.warnings });
    }

    const billingBlock = await requireActiveBilling(orgId);
    if (billingBlock) return billingBlock;
    const result = await importAttendance({
      orgId,
      userId: session.user.id,
      siteId: fields.siteId,
      parsed,
      ownEmployers: fields.ownEmployers,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof AttendanceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "ALREADY_IMPORTED" ? 409 : 422;
      return apiError(err.code, err.message, status);
    }
    if (err instanceof RouteDistanceError) return apiError(err.code, err.message, err.status);
    if (err instanceof SyntaxError) return apiError("BAD_REQUEST", "ownEmployers must be a JSON list.", 400);
    return handleRouteError(err);
  }
}
