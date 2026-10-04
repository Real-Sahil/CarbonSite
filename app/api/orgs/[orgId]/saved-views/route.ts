export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import {
  MAX_VIEWS_PER_USER_PER_SURFACE,
  SURFACE_KEYS,
  checkFilters,
  createViewBody,
  filterRefs,
  isUniqueViolation,
  viewHref,
  type Surface,
} from "@/lib/saved-views";
import { mayShare, viewRoles } from "@/lib/saved-views/roles";

type Ctx = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/saved-views?surface=dashboard
// The caller's own views plus every view shared in the organisation.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...viewRoles());
    const surface = new URL(req.url).searchParams.get("surface");
    if (!surface || !(SURFACE_KEYS as string[]).includes(surface)) {
      return apiError("VALIDATION_ERROR", "Name a page with ?surface=.", 422);
    }
    const rows = await prisma.savedView.findMany({
      where: { organizationId: orgId, surface, OR: [{ ownerUserId: session.user.id }, { shared: true }] },
      orderBy: [{ shared: "asc" }, { name: "asc" }],
      include: { owner: { select: { name: true } } },
    });
    return NextResponse.json({
      views: rows.map((v) => {
        const filters = (v.filters ?? {}) as Record<string, string>;
        return {
          id: v.id,
          name: v.name,
          surface: v.surface,
          shared: v.shared,
          filters,
          ownedByMe: v.ownerUserId === session.user.id,
          ownerName: v.shared ? (v.owner.name ?? null) : null,
          updatedAt: v.updatedAt,
          href: viewHref(orgId, v.surface as Surface, filters),
        };
      }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/saved-views
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...viewRoles());
    const body = createViewBody.parse(await req.json());

    if (body.shared && !mayShare(membership.role)) {
      return apiError("FORBIDDEN", "Only editors and admins can share a view with the organisation.", 403);
    }
    const checked = checkFilters(body.surface, body.filters);
    if ("error" in checked) return apiError("VALIDATION_ERROR", checked.error, 422);
    const bad = await orgRefsError(orgId, filterRefs(checked.filters));
    if (bad) return bad;

    const kept = await prisma.savedView.count({
      where: { organizationId: orgId, ownerUserId: session.user.id, surface: body.surface },
    });
    if (kept >= MAX_VIEWS_PER_USER_PER_SURFACE) {
      return apiError("VIEW_LIMIT", `You can keep up to ${MAX_VIEWS_PER_USER_PER_SURFACE} views on a page. Delete one first.`, 422);
    }

    let created;
    try {
      created = await prisma.savedView.create({
        data: {
          organizationId: orgId,
          ownerUserId: session.user.id,
          surface: body.surface,
          name: body.name,
          filters: checked.filters,
          shared: body.shared,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) return apiError("VIEW_EXISTS", "You already have a view with that name.", 409);
      throw err;
    }

    if (created.shared) {
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "saved_view.created", resourceType: "SavedView", resourceId: created.id,
        metadata: { surface: created.surface, shared: true },
      });
    }
    return NextResponse.json({ view: { id: created.id, href: viewHref(orgId, body.surface, checked.filters) } }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
