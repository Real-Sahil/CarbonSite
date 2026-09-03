export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

const PAGE_SIZE = 20;

// GET /api/orgs/[orgId]/notifications — the signed-in user's in-app feed for
// this org, newest first, cursor-paginated, with the current unread count.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId);
    const userId = session.user.id;

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const where = {
      userId,
      organizationId: orgId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          resourceId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId, organizationId: orgId, readAt: null },
      }),
    ]);

    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return NextResponse.json({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        resourceId: n.resourceId,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      nextCursor,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z.object({
  // Mark specific notifications read, or all of the user's unread ones when omitted.
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

// PATCH /api/orgs/[orgId]/notifications — mark notifications as read.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId);
    const userId = session.user.id;

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiError("INVALID_BODY", "Invalid request body", 400, parsed.error.flatten());
    }
    const { ids, markAll } = parsed.data;

    // Always scope the update to the caller's own rows in this org — a user can
    // never mark another user's notifications read.
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        organizationId: orgId,
        readAt: null,
        ...(markAll ? {} : { id: { in: ids ?? [] } }),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return handleRouteError(err);
  }
}
