export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { checkFilters, filterRefs, isUniqueViolation, mayChangeView, updateViewBody, type Surface } from "@/lib/saved-views";
import { mayShare, viewRoles } from "@/lib/saved-views/roles";

type Ctx = { params: Promise<{ orgId: string; viewId: string }> };

/** The view if the caller may see it (their own, or shared in the organisation). */
async function findVisible(orgId: string, viewId: string, userId: string) {
  return prisma.savedView.findFirst({
    where: { id: viewId, organizationId: orgId, OR: [{ ownerUserId: userId }, { shared: true }] },
  });
}

// PATCH /api/orgs/[orgId]/saved-views/[viewId]
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, viewId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...viewRoles());
    const body = updateViewBody.parse(await req.json());

    const view = await findVisible(orgId, viewId, session.user.id);
    if (!view) return apiError("NOT_FOUND", "View not found.", 404);
    if (!mayChangeView(view, session.user.id, membership.role === "admin")) {
      return apiError("FORBIDDEN", "Only the owner or an admin can change this view.", 403);
    }
    if (body.shared === true && !view.shared && !mayShare(membership.role)) {
      return apiError("FORBIDDEN", "Only editors and admins can share a view with the organisation.", 403);
    }

    const data: { name?: string; filters?: Record<string, string>; shared?: boolean } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.shared !== undefined) data.shared = body.shared;
    if (body.filters !== undefined) {
      const checked = checkFilters(view.surface as Surface, body.filters);
      if ("error" in checked) return apiError("VALIDATION_ERROR", checked.error, 422);
      const bad = await orgRefsError(orgId, filterRefs(checked.filters));
      if (bad) return bad;
      data.filters = checked.filters;
    }

    let done;
    try {
      done = await prisma.savedView.updateMany({ where: { id: viewId, organizationId: orgId }, data });
    } catch (err) {
      if (isUniqueViolation(err)) return apiError("VIEW_EXISTS", "You already have a view with that name.", 409);
      throw err;
    }
    if (done.count === 0) return apiError("NOT_FOUND", "View not found.", 404);

    if (view.shared || data.shared) {
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "saved_view.updated", resourceType: "SavedView", resourceId: viewId,
        metadata: { surface: view.surface, wasShared: view.shared, nowShared: data.shared ?? view.shared },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/saved-views/[viewId]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, viewId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...viewRoles());

    const view = await findVisible(orgId, viewId, session.user.id);
    if (!view) return apiError("NOT_FOUND", "View not found.", 404);
    if (!mayChangeView(view, session.user.id, membership.role === "admin")) {
      return apiError("FORBIDDEN", "Only the owner or an admin can delete this view.", 403);
    }

    const gone = await prisma.savedView.deleteMany({ where: { id: viewId, organizationId: orgId } });
    if (gone.count === 0) return apiError("NOT_FOUND", "View not found.", 404);

    if (view.shared) {
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "saved_view.deleted", resourceType: "SavedView", resourceId: viewId,
        metadata: { surface: view.surface, shared: true },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
