import { headers } from "next/headers";
import { auth } from "./index";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@prisma/client";

export async function getSession() {
  const requestHeaders = await headers();
  const browserSession = await auth.api.getSession({ headers: requestHeaders });
  if (browserSession) return browserSession;

  const bearerToken = extractBearerToken(requestHeaders.get("authorization"));
  if (!bearerToken) return null;

  const session = await prisma.session.findUnique({
    where: { token: bearerToken },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.revokedAt !== null) return null;

  return {
    session: {
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: session.id,
      token: session.token,
      updatedAt: session.updatedAt,
      userId: session.userId,
    },
    user: {
      createdAt: session.user.createdAt,
      email: session.user.email,
      emailVerified: Boolean(session.user.emailVerifiedAt),
      id: session.user.id,
      name: session.user.name ?? "",
      updatedAt: session.user.updatedAt,
    },
  };
}

function extractBearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
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

export async function requirePlatformMember() {
  const session = await requireSession();
  const pm = await prisma.platformMembership.findUnique({
    where: { userId: session.user.id },
  });
  if (!pm) throw new AuthError("NOT_PLATFORM_MEMBER", 403);
  return { session, platformMembership: pm };
}

// Named role groups for common permission patterns
export const ROLE_GROUPS = {
  admins: ["admin"] as import("@prisma/client").OrgRole[],
  sustainability: [
    "admin", "sustainability_director", "sustainability_manager", "editor",
  ] as import("@prisma/client").OrgRole[],
  contractManagers: [
    "admin", "sustainability_director", "contract_manager",
  ] as import("@prisma/client").OrgRole[],
  reviewers: [
    "admin", "sustainability_director", "sustainability_manager", "reviewer",
  ] as import("@prisma/client").OrgRole[],
  // SECURITY: field_worker is intentionally absent. Field workers see only their
  // own submissions via the field-submissions endpoint (own-only WHERE clause).
  // Adding field_worker here would grant dashboard/calculation access to external
  // subcontractors — do not add it.
  anyMember: [
    "admin", "sustainability_director", "sustainability_manager", "operations_manager",
    "editor", "reviewer", "viewer", "auditor", "contract_manager", "project_manager",
    "site_manager", "supervisor", "employee", "client_viewer",
  ] as import("@prisma/client").OrgRole[],
} as const;

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
