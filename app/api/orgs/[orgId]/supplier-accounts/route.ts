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
            sessions: {
              select: { createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedAccounts = accounts.map((account) => ({
      userId: account.userId,
      email: account.user.email,
      name: account.user.name || "Unknown",
      status: account.terminatedAt ? ("terminated" as const) : ("active" as const),
      createdAt: account.createdAt.toISOString(),
      lastLogin: account.user.sessions[0]?.createdAt.toISOString(),
      terminatedAt: account.terminatedAt?.toISOString(),
    }));

    return NextResponse.json({ accounts: formattedAccounts });
  } catch (err) {
    return handleRouteError(err);
  }
}
