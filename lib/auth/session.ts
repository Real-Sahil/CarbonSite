import { headers } from "next/headers";
import { auth } from "./index";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@prisma/client";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED", 401);
  return session;
}

export async function requireOrgMember(orgId: string, ...allowedRoles: OrgRole[]) {
  const session = await requireSession();
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: session.user.id },
    },
  });
  if (!membership) throw new AuthError("NOT_MEMBER", 403);
  if (allowedRoles.length && !allowedRoles.includes(membership.role)) {
    throw new AuthError("INSUFFICIENT_ROLE", 403);
  }
  return { session, membership };
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
