export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { viewRoles } from "@/lib/saved-views/roles";
import { layoutError, layoutSchema } from "@/lib/dashboard/widgets";
import { SURFACE } from "@/lib/dashboard/layout-store";

type Ctx = { params: Promise<{ orgId: string }> };

const putBody = z.object({ scope: z.enum(["personal", "organisation"]), layout: layoutSchema });

// PUT /api/orgs/[orgId]/dashboard-layout
// Saves the caller's own arrangement, or (admins only) the organisation's default.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...viewRoles());
    const body = putBody.parse(await req.json());
    const bad = layoutError(body.layout);
    if (bad) return apiError("VALIDATION_ERROR", bad, 422);
    if (body.scope === "organisation" && membership.role !== "admin") {
      return apiError("FORBIDDEN", "Only admins can set the organisation's default dashboard.", 403);
    }
    const userKey = body.scope === "organisation" ? "org" : session.user.id;
    await prisma.dashboardLayout.upsert({
      where: { organizationId_surface_userKey: { organizationId: orgId, surface: SURFACE, userKey } },
      create: { organizationId: orgId, surface: SURFACE, userKey, ownerUserId: body.scope === "personal" ? session.user.id : null, layout: body.layout },
      update: { layout: body.layout },
    });
    if (body.scope === "organisation") {
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "dashboard_layout.org_default_changed", resourceType: "DashboardLayout", resourceId: orgId,
        metadata: { widgets: body.layout.order.length, hidden: body.layout.hidden.length },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/dashboard-layout?scope=personal|organisation
// Back to the next level down: personal, then the organisation default, then the role's preset.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...viewRoles());
    const scope = new URL(req.url).searchParams.get("scope") === "organisation" ? "organisation" : "personal";
    if (scope === "organisation" && membership.role !== "admin") {
      return apiError("FORBIDDEN", "Only admins can clear the organisation's default dashboard.", 403);
    }
    await prisma.dashboardLayout.deleteMany({
      where: { organizationId: orgId, surface: SURFACE, userKey: scope === "organisation" ? "org" : session.user.id },
    });
    if (scope === "organisation") {
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "dashboard_layout.org_default_changed", resourceType: "DashboardLayout", resourceId: orgId,
        metadata: { cleared: true },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
