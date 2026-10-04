export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { loadSnapshotSites } from "@/lib/map/load";

type Ctx = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/map-data?snapshotId=
// Per-site totals of one published snapshot of the organisation, for the map's time scrubber.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const snapshotId = new URL(req.url).searchParams.get("snapshotId");
    if (!snapshotId || snapshotId.length > 64) return apiError("VALIDATION_ERROR", "Name a snapshot with ?snapshotId=.", 422);
    const sites = await loadSnapshotSites(orgId, snapshotId);
    if (!sites) return apiError("NOT_FOUND", "Snapshot not found.", 404);
    return NextResponse.json({ sites });
  } catch (err) {
    return handleRouteError(err);
  }
}
