import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requirePlatformMember();
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey("platform", "orgs-list", session.user.id),
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
    const search = searchParams.get("q") ?? undefined;

    const orgs = await prisma.organization.findMany({
      where: search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined,
      include: {
        branding: { select: { subdomain: true, customDomain: true } },
        _count: { select: { memberships: true, activityRecords: true, contracts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    const hasMore = orgs.length > limit;
    const items = hasMore ? orgs.slice(0, limit) : orgs;

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
