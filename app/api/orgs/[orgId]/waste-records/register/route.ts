export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { loadWasteRegister, registerToCsv } from "@/lib/waste/register";

const querySchema = z.object({
  reportingPeriodId: z.string().optional(),
  facilityId: z.string().optional(),
  gaps: z.enum(["1"]).optional(),
});

// GET /api/orgs/[orgId]/waste-records/register — duty of care register as CSV.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const { rows } = await loadWasteRegister(orgId, {
      reportingPeriodId: q.reportingPeriodId,
      facilityId: q.facilityId,
      gapsOnly: q.gaps === "1",
    }, 50_000);
    return new NextResponse(registerToCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="waste-duty-of-care-register-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
