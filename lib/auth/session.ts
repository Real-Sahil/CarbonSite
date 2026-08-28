import { headers } from "next/headers";
import { auth } from "./index";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@prisma/client";

export async function getSession() {
  const requestHeaders = await headers();

  // Primary: let Better Auth verify the signed session cookie with its secret.
  const browserSession = await auth.api.getSession({ headers: requestHeaders }).catch((err: unknown) => {
    console.error("[getSession] auth.api.getSession threw:", err);
    return null;
  });
  if (browserSession) return browserSession;

  // Cookie fallback: Better Auth signs session cookies with BETTER_AUTH_SECRET.
  // If that env var is absent the library generates a random per-process secret.
  // On serverless platforms (Vercel) every cold start is a new process with a
  // new secret, so getSignedCookie() always returns null even for valid sessions.
  //
  // The signed cookie format is "{rawToken}.{44-char-base64-hmac}".
  // We extract the raw token (the part before the trailing signature), look it
  // up in the DB, and validate expiry ourselves.
  //
  // We use an explicit `select` (no `include`) so the query works even when
  // the revoked_at column has not yet been added by the migration — SELECT *
  // would fail with "column does not exist" on an outdated schema.
  const cookieHeader = requestHeaders.get("cookie");
  if (cookieHeader) {
    // Better Auth uses "__Secure-" prefix in production (secure:true), plain name otherwise.
    const signedValue =
      readRawCookie(cookieHeader, "__Secure-better-auth.session_token") ??
      readRawCookie(cookieHeader, "better-auth.session_token");

    if (signedValue) {
      const token = extractTokenFromSignedCookie(signedValue);
      if (token) {
        const dbSession = await prisma.session
          .findUnique({
            where: { token },
            select: {
              id: true,
              token: true,
              expiresAt: true,
              revokedAt: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  emailVerifiedAt: true,
                  name: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          })
          .catch(() => null);

        if (dbSession && dbSession.expiresAt > new Date() && dbSession.revokedAt === null) {
          return buildSessionResult(dbSession);
        }
      }
    }
  }

  // Bearer token fallback (mobile / API clients).
  const bearerToken = extractBearerToken(requestHeaders.get("authorization"));
  if (!bearerToken) return null;

  const session = await prisma.session
    .findUnique({
      where: { token: bearerToken },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        revokedAt: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
    .catch(() => null);
  if (!session || session.expiresAt <= new Date() || session.revokedAt !== null) return null;

  return buildSessionResult(session);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DbSession = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  token: string;
  updatedAt: Date;
  userId: string;
  user: {
    createdAt: Date;
    email: string;
    emailVerifiedAt: Date | null;
    id: string;
    name: string | null;
    updatedAt: Date;
  };
};

function buildSessionResult(session: DbSession) {
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

function readRawCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      } catch {
        return trimmed.slice(name.length + 1);
      }
    }
  }
  return null;
}

function extractTokenFromSignedCookie(value: string): string | null {
  // Better Auth signs cookies as "{token}.{hmac}" using base64url encoding (RFC 4648 §5),
  // which produces 43 chars without "=" padding — not the 44-char padded base64 the
  // previous check expected. Removing the strict format check lets the cookie fallback
  // work regardless of the exact signature encoding the library version produces.
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 1) return value; // no dot — treat whole value as the token
  return value.substring(0, lastDot);
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
  editor: [
    "admin", "sustainability_director", "sustainability_manager", "editor",
  ] as import("@prisma/client").OrgRole[],
  contractManagers: [
    "admin", "sustainability_director", "contract_manager",
  ] as import("@prisma/client").OrgRole[],
  reviewers: [
    "admin", "sustainability_director", "sustainability_manager", "reviewer",
  ] as import("@prisma/client").OrgRole[],
  // SECURITY: field_worker and supplier are intentionally absent.
  // field_worker — sees only own submissions via /field-submissions (own-only WHERE clause).
  // supplier — sees only own EPDs via /supplier-portal/epds (own-only WHERE clause).
  // Adding either here would grant dashboard/calculation access to external parties — do not.
  anyMember: [
    "admin", "sustainability_director", "sustainability_manager", "operations_manager",
    "editor", "reviewer", "viewer", "auditor", "contract_manager", "project_manager",
    "site_manager", "supervisor", "employee", "client_viewer",
  ] as import("@prisma/client").OrgRole[],
} as const;

export async function requireProjectAccess(
  orgId: string,
  projectId: string,
  ...allowedRoles: string[]
) {
  const session = await requireSession();

  // Check org membership first
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: session.user.id },
    },
  });
  if (!membership) throw new AuthError("NOT_MEMBER", 403);

  // If user is admin, grant access to all projects
  if (membership.role === "admin") {
    return { session, membership, hasProjectRole: true };
  }

  // Check project-level role assignment
  const projectRole = await prisma.projectRoleAssignment.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
  });

  if (!projectRole) {
    throw new AuthError("PROJECT_ACCESS_DENIED", 403);
  }

  if (allowedRoles.length && !allowedRoles.includes(projectRole.role)) {
    throw new AuthError("INSUFFICIENT_PROJECT_ROLE", 403);
  }

  return { session, membership, projectRole, hasProjectRole: true };
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
