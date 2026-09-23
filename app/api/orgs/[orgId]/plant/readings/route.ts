export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { ingestTelematics } from "@/lib/plant/ingest";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { MAX_ROWS } from "@/lib/plant/schemas";
import { periodRow } from "@/lib/plant/telematics";

type Params = { params: Promise<{ orgId: string }> };

const body = z.object({ rows: z.array(periodRow).min(1).max(MAX_ROWS) });

/** Period rows from a provider's CSV export, uploaded on the Plant page. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return apiError("INVALID_ROWS", `Row ${Number(first.path[1] ?? 0) + 1}: ${first.path.slice(2).join(".") || "row"} ${first.message}.`, 422);
    }
    return NextResponse.json(await ingestTelematics(orgId, { kind: "rows", rows: parsed.data.rows }, "csv", session.user.id), { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
