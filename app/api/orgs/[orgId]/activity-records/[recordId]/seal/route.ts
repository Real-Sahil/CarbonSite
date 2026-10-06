export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { sealRecord } from "@/lib/evidence/seal";
import { recordSealStatus } from "@/lib/evidence/record-bundle";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

/** Whether the record is sealed, and what has changed in it or its files since. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const status = await recordSealStatus(orgId, recordId);
    if (!status) return apiError("NOT_FOUND", "Record not found.", 404);
    return NextResponse.json(status);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Seals the record as it stands now, linking to the seal before it. Used after an approved record was corrected. */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);
    const r = await sealRecord(orgId, recordId, session.user.id);
    if (!r.ok) return apiError(r.reason === "Record not found." ? "NOT_FOUND" : "EVIDENCE_CHECKSUM_MISMATCH", r.reason, r.reason === "Record not found." ? 404 : 422);
    return NextResponse.json({ version: r.version, sealHash: r.sealHash, evidenceCount: r.evidenceCount, unverified: r.unverified }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
