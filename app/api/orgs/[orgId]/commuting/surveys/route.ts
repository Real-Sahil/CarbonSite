export const dynamic = "force-dynamic";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";

const Body = z.object({ siteId: z.string().min(1), open: z.boolean().default(true) });

/**
 * Creates the site's travel survey link, or opens/closes it. One survey per
 * site; the answers are anonymous and set the site's commuting mode split.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = Body.parse(await req.json());
    const refError = await orgRefsError(orgId, { siteId: body.siteId });
    if (refError) return refError;

    const existing = await prisma.commuteSurvey.findUnique({
      where: { organizationId_siteId: { organizationId: orgId, siteId: body.siteId } },
    });
    const survey = existing
      ? await prisma.commuteSurvey.update({ where: { id: existing.id }, data: { isOpen: body.open } })
      : await prisma.commuteSurvey.create({
          data: {
            organizationId: orgId,
            siteId: body.siteId,
            token: randomBytes(18).toString("base64url"),
            isOpen: body.open,
            createdByUserId: session.user.id,
          },
        });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: existing ? "commuting.survey_updated" : "commuting.survey_created",
      resourceType: "commute_survey",
      resourceId: survey.id,
      metadata: { siteId: body.siteId, open: survey.isOpen },
    });
    return NextResponse.json({ id: survey.id, token: survey.token, isOpen: survey.isOpen }, { status: existing ? 200 : 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
