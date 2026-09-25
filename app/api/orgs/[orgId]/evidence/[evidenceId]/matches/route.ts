export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { findRecordMatches } from "@/lib/evidence/match";
import { BILL_EXTRACTOR_VERSION, type BillExtraction } from "@/lib/evidence/bill-extractor";

type Params = { params: Promise<{ orgId: string; evidenceId: string }> };

// GET /api/orgs/[orgId]/evidence/[evidenceId]/matches
//
// The activity records a bill already read by POST /evidence/bill could
// evidence, best first, with the reasons for each. Attaching is a separate
// POST /records/{id}/evidence the person confirms.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, evidenceId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, organizationId: orgId },
      select: {
        id: true,
        classifications: {
          where: { modelVersion: BILL_EXTRACTOR_VERSION },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { extractedFields: true },
        },
      },
    });
    if (!evidence) return apiError("NOT_FOUND", "Evidence not found.", 404);
    const bill = evidence.classifications[0]?.extractedFields as BillExtraction | undefined;
    if (!bill) return apiError("NOT_READ", "This file has not been read as a bill yet.", 409);

    const matches = await findRecordMatches(orgId, evidenceId, bill);
    return NextResponse.json({ matches });
  } catch (err) {
    return handleRouteError(err);
  }
}
