export const dynamic = "force-dynamic";

// ISO 14001 clause 6.1.3 compliance obligations register.
//
// The register lists the environmental legislation that applies to the
// organisation and the compliance position against each entry. Clause 9.1.2
// requires the position to be re-evaluated periodically, so an entry past its
// review date counts as unassessed rather than compliant.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { createLegalRegisterEntrySchema } from "@/lib/validation/environment";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "sustainability_manager", "editor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const entries = await prisma.legalRegisterEntry.findMany({
      where: { organizationId: orgId },
      orderBy: [{ complianceStatus: "asc" }, { title: "asc" }],
      include: { owner: { select: { name: true, email: true } } },
    });

    const now = new Date();
    let breaches = 0;
    let atRisk = 0;
    let overdueReviews = 0;
    let unassessed = 0;

    const rows = entries.map((e) => {
      const reviewOverdue = e.nextReviewOn !== null && e.nextReviewOn.getTime() < now.getTime();
      if (e.complianceStatus === "breach") breaches += 1;
      if (e.complianceStatus === "at_risk") atRisk += 1;
      if (e.complianceStatus === "not_assessed") unassessed += 1;
      if (reviewOverdue) overdueReviews += 1;
      return { ...e, reviewOverdue };
    });

    return Response.json({
      data: rows,
      summary: {
        total: entries.length,
        breaches,
        atRisk,
        unassessed,
        overdueReviews,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "legal-register", session.user.id),
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createLegalRegisterEntrySchema.parse(await req.json());

    const entry = await prisma.legalRegisterEntry.create({
      data: {
        organizationId: orgId,
        title: body.title,
        citation: body.citation ?? null,
        jurisdiction: body.jurisdiction ?? null,
        applicability: body.applicability,
        obligation: body.obligation,
        complianceStatus: body.complianceStatus,
        evidenceSummary: body.evidenceSummary ?? null,
        ownerUserId: body.ownerUserId ?? null,
        lastReviewedOn: body.lastReviewedOn ?? null,
        nextReviewOn: body.nextReviewOn ?? null,
        referenceUrl: body.referenceUrl ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "legal_register.entry_created",
      resourceType: "LegalRegisterEntry",
      resourceId: entry.id,
      metadata: { title: entry.title, complianceStatus: entry.complianceStatus },
    });

    return Response.json(entry, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
