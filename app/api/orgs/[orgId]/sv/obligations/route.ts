export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { obligationBody, obligationData, obligationRefsError } from "@/lib/social-value/obligations-api";
import { loadObligations } from "@/lib/social-value/obligations-load";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");
    const siteId = new URL(req.url).searchParams.get("siteId") ?? undefined;
    return NextResponse.json({ data: await loadObligations(orgId, { siteId }) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-obligation-create", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = obligationBody.parse(await req.json());
    const refError = await obligationRefsError(orgId, body);
    if (refError) return apiError("NOT_FOUND", refError, 404);

    const created = await prisma.svPlanningObligation.create({
      data: { ...obligationData(body), title: body.title, organizationId: orgId },
      select: { id: true, title: true },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_planning_obligation.create",
      resourceType: "SvPlanningObligation",
      resourceId: created.id,
      metadata: { title: created.title },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
