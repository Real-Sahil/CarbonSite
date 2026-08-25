export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformMember();

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const statusFilter = url.searchParams.get("status");
    const take = 20;

    const where = statusFilter
      ? { status: statusFilter as "pending" | "processing" | "completed" | "failed" | "rejected" }
      : {};

    const [requests, total] = await Promise.all([
      prisma.dsarRequest.findMany({
        where,
        include: {
          user: { select: { email: true, name: true } },
          requestedByUser: { select: { email: true, name: true } },
        },
        orderBy: { dueBy: "asc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.dsarRequest.count({ where }),
    ]);

    const hasMore = requests.length > take;
    const data = hasMore ? requests.slice(0, take) : requests;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1].id : null, total });
  } catch (err) {
    return handleRouteError(err);
  }
}
