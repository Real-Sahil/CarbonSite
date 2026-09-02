import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Get all supplier accounts for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10), 100);

    // Get all supplier members
    const accounts = await prisma.organizationMembership.findMany({
      where: {
        organizationId: orgId,
        role: "supplier",
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            emailVerified: true,
            accounts: {
              select: {
                passwordChangedAt: true,
              },
              take: 1,
            },
            sessions: {
              select: { createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = accounts.length > take;
    const data = hasMore ? accounts.slice(0, take) : accounts;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    const formattedAccounts = data.map((membership) => ({
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name || "Unknown",
      status: membership.terminatedAt ? ("terminated" as const) : ("active" as const),
      createdAt: membership.createdAt.toISOString(),
      passwordChangedAt: membership.user.accounts[0]?.passwordChangedAt?.toISOString(),
      lastLogin: membership.user.sessions[0]?.createdAt.toISOString(),
      terminatedAt: membership.terminatedAt?.toISOString(),
    }));

    const response = NextResponse.json({
      accounts: formattedAccounts,
      nextCursor,
      hasMore,
    });
    response.headers.set("Cache-Control", "private, max-age=300");
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
