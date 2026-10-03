export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { disclosureSectionsSchema } from "@/lib/climate-disclosure";
import { loadClimateDisclosure } from "@/lib/climate-disclosure/load";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

// GET /api/orgs/[orgId]/climate-disclosure
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    return NextResponse.json(await loadClimateDisclosure(orgId));
  } catch (err) {
    return handleRouteError(err);
  }
}

// PUT /api/orgs/[orgId]/climate-disclosure
// Saving changes to an approved statement returns it to draft: the board
// approved the old text, not the new one. The audit log keeps the approval.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const sections = disclosureSectionsSchema.parse(await req.json());

    const existing = await prisma.climateDisclosure.findUnique({ where: { organizationId: orgId }, select: { id: true, status: true } });
    const reopened = existing?.status === "approved";
    const row = await prisma.climateDisclosure.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, sections, updatedByUserId: session.user.id },
      update: {
        sections,
        updatedByUserId: session.user.id,
        ...(reopened ? { status: "draft", approvedAt: null, approvedByUserId: null } : {}),
      },
      select: { id: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "climate_disclosure.updated",
      resourceType: "ClimateDisclosure",
      resourceId: row.id,
      metadata: { created: !existing, reopenedFromApproved: reopened, scenarios: sections.scenarios.length },
    });

    return NextResponse.json({ reopened });
  } catch (err) {
    return handleRouteError(err);
  }
}
