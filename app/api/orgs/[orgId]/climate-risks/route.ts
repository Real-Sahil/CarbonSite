export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { riskBody } from "@/lib/climate-disclosure/api";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

// GET /api/orgs/[orgId]/climate-risks
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    const risks = await prisma.climateRisk.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ risks });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/climate-risks
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = riskBody.parse(await req.json());

    const risk = await prisma.climateRisk.create({
      data: { ...body, organizationId: orgId, updatedByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "climate_risk.created",
      resourceType: "ClimateRisk",
      resourceId: risk.id,
      metadata: { kind: risk.kind, horizon: risk.horizon },
    });

    return NextResponse.json({ risk }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
