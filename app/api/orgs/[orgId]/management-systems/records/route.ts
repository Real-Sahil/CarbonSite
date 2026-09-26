export const dynamic = "force-dynamic";

// Records of one kind the organisation can link as evidence, for the picker.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";
import { isRecordKind, searchRecords } from "@/lib/management-systems/evidence";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...MS_EDITORS);
    const kind = req.nextUrl.searchParams.get("kind") ?? "";
    if (!isRecordKind(kind)) return apiError("VALIDATION_ERROR", "Unknown record kind.", 422);
    return Response.json({ data: await searchRecords(orgId, kind, req.nextUrl.searchParams.get("q") ?? "") });
  } catch (err) {
    return handleRouteError(err);
  }
}
