export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { AttendanceError } from "@/lib/commuting/attendance";
import { deleteCommuteImport } from "@/lib/commuting/import";

/** Deletes a month's commuting import and its records, while none is approved or calculated. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; importId: string }> }) {
  try {
    const { orgId, importId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    await deleteCommuteImport(orgId, session.user.id, importId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AttendanceError) return apiError(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 409);
    return handleRouteError(err);
  }
}
