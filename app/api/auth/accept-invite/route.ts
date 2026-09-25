export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { acceptInviteSchema } from "@/lib/validation/org";

export async function POST(req: NextRequest) {
  try {
    const body = acceptInviteSchema.parse(await req.json());

    // Demo reviewer access for Google Play / App Store review only: set
    // DEMO_REVIEWER_TOKEN (24+ characters) on Vercel and give reviewers the
    // link. Checked before the rate limit, because store reviewers share
    // network addresses and retry the same link.
    const demoToken = process.env.DEMO_REVIEWER_TOKEN;
    if (demoToken && demoToken.length >= 24 && body.token === demoToken) {
      return handleDemoReviewerLogin(body.name ?? "Reviewer");
    }

    // Rate-limit by IP, not by token — prevents enumeration via per-token buckets.
    // Sites share one connection, so a crew joining together needs headroom.
    const limited = await rateLimitRequest(req, {
      key: "invite_accept",
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (limited) return limited;

    // 1. Look up and validate the invite link
    const invite = await prisma.inviteLink.findUnique({
      where: { token: body.token },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return apiError("INVITE_NOT_FOUND", "Invite link not found.", 404);
    }

    const now = new Date();

    if (invite.expiresAt <= now) {
      return apiError("INVITE_EXPIRED", "This invite link has expired.", 400);
    }

    if (invite.usedAt !== null) {
      return apiError("INVITE_ALREADY_USED", "This invite link has already been used.", 400);
    }
    if (!invite.email && invite.role !== "field_worker") {
      return apiError(
        "INVITE_REQUIRES_EMAIL",
        "Privileged organisation roles must be accepted through an email-bound invite.",
        400,
      );
    }

    const requestedEmail = body.email?.trim().toLowerCase();
    if (invite.email && requestedEmail && requestedEmail !== invite.email.toLowerCase()) {
      // Return the same message as INVITE_NOT_FOUND to prevent email enumeration.
      return apiError(
        "INVALID_INVITE",
        "This invite link is invalid or has expired.",
        400,
      );
    }
    if (invite.email && !requestedEmail && invite.role !== "field_worker") {
      return apiError(
        "INVITE_EMAIL_REQUIRED",
        "This invite must be accepted with the invited email address.",
        400,
      );
    }

    // 2. Determine the email for this invite acceptance
    const email =
      invite.email?.toLowerCase() ??
      requestedEmail ??
      `fw-${randomUUID().substring(0, 8)}@field.metricora.co.uk`;

    // 3. Find or create the user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const userId = randomUUID();
      user = await prisma.user.create({
        data: {
          id: userId,
          email,
          emailVerified: Boolean(invite.email),
          emailVerifiedAt: invite.email ? now : null,
          name: body.name,
        },
      });

      // Create a credential account (no password — JWT-only auth for field workers)
      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: email,
          providerId: "credential",
          password: null,
        },
      });
    }

    // 4. Check user is not already a member of this org
    const existingMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
    });

    if (existingMembership && !invite.reusable) {
      return apiError(
        "ALREADY_MEMBER",
        "This user is already a member of the organization.",
        409,
      );
    }

    // 5. Create membership (if needed), mark invite used (if not reusable),
    //    create session — all in a transaction
    const sessionToken = randomUUID();
    const sessionId = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + 30 * 86_400_000); // 30 days

    const membership = await prisma.$transaction(async (tx) => {
      let mem = existingMembership;

      if (!mem) {
        mem = await tx.organizationMembership.create({
          data: {
            organizationId: invite.organizationId,
            userId: user!.id,
            role: invite.role,
          },
        });

        // Site-scoped invite: auto-assign the worker to the site so they land
        // straight on their assigned project — no manual admin step required.
        if (invite.siteId) {
          await tx.fieldWorkerSiteAssignment.upsert({
            where: {
              organizationId_userId_siteId: {
                organizationId: invite.organizationId,
                userId: user!.id,
                siteId: invite.siteId,
              },
            },
            update: {},
            create: {
              organizationId: invite.organizationId,
              userId: user!.id,
              siteId: invite.siteId,
              assignedByUserId: invite.usedByUserId ?? user!.id,
            },
          });
        }
      }

      if (!invite.reusable) {
        await tx.inviteLink.update({
          where: { id: invite.id },
          data: { usedAt: now, usedByUserId: user!.id },
        });
      }

      await tx.session.create({
        data: {
          id: sessionId,
          token: sessionToken,
          userId: user!.id,
          expiresAt: sessionExpiresAt,
        },
      });

      return mem;
    });

    // 6. Audit log
    await writeAuditLog({
      organizationId: invite.organizationId,
      actorUserId: user.id,
      action: "org.member.invite_accepted",
      resourceType: "invite_link",
      resourceId: invite.id,
      metadata: {
        acceptedByUserId: user.id,
        email,
        role: invite.role,
        membershipId: membership.id,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      sessionToken,
      org: {
        id: invite.organization.id,
        name: invite.organization.name,
      },
      role: invite.role,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ---------------------------------------------------------------------------
// Demo reviewer account — Google Play / App Store review access only.
// Upserts a permanent demo org + field worker. Session never expires.
// Activated only when DEMO_REVIEWER_TOKEN env var is set and matched.
// ---------------------------------------------------------------------------
async function handleDemoReviewerLogin(name: string) {
  const DEMO_ORG_ID   = "demo-reviewer-org-00000000000000";
  const DEMO_USER_ID  = "demo-reviewer-user-0000000000000";
  const DEMO_EMAIL    = "reviewer@metricora-demo.app";
  const DEMO_ORG_NAME = "MetricOra Demo";

  const now = new Date();
  // Session expires 10 years out — effectively permanent for reviewers.
  const sessionExpiresAt = new Date(now.getTime() + 10 * 365 * 86_400_000);

  // Upsert demo org. A pilot, so billing never blocks the reviewer.
  const org = await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: { isPilot: true },
    create: {
      id: DEMO_ORG_ID,
      name: DEMO_ORG_NAME,
      isPilot: true,
    },
  });

  // Upsert demo user
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { name },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      name,
      emailVerified: true,
      emailVerifiedAt: now,
    },
  });

  // Ensure credential account exists (no password)
  const existingAccount = await prisma.account.findFirst({
    where: { userId: DEMO_USER_ID, providerId: "credential" },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: DEMO_USER_ID,
        accountId: DEMO_EMAIL,
        providerId: "credential",
        password: null,
      },
    });
  }

  // Ensure org membership exists
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
      },
    },
    update: {},
    create: {
      organizationId: DEMO_ORG_ID,
      userId: DEMO_USER_ID,
      role: "field_worker",
    },
  });

  await ensureDemoWorkspace(DEMO_ORG_ID, DEMO_USER_ID, now);

  // Always issue a fresh session token so multiple review cycles work
  const sessionToken = randomUUID();
  await prisma.session.create({
    data: {
      id: randomUUID(),
      token: sessionToken,
      userId: DEMO_USER_ID,
      expiresAt: sessionExpiresAt,
    },
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    sessionToken,
    org: { id: org.id, name: org.name },
    role: "field_worker",
  });
}

/**
 * Gives the demo reviewer something to use: a site they are assigned to (the
 * app lists it under Projects) and a reporting period covering today, so a
 * photographed ticket can be submitted end to end.
 */
async function ensureDemoWorkspace(orgId: string, userId: string, now: Date) {
  const year = now.getUTCFullYear();
  const periodId = `demo-reviewer-period-${year}`;
  await prisma.reportingPeriod.upsert({
    where: { id: periodId },
    update: {},
    create: {
      id: periodId,
      organizationId: orgId,
      type: "year",
      label: `FY${year}`,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
    },
  });
  await prisma.contract.upsert({
    where: { id: "demo-reviewer-contract" },
    update: {},
    create: { id: "demo-reviewer-contract", organizationId: orgId, name: "Demo highways contract", createdByUserId: userId },
  });
  await prisma.project.upsert({
    where: { id: "demo-reviewer-project" },
    update: {},
    create: { id: "demo-reviewer-project", organizationId: orgId, contractId: "demo-reviewer-contract", name: "Demo road scheme" },
  });
  await prisma.site.upsert({
    where: { id: "demo-reviewer-site" },
    update: {},
    create: {
      id: "demo-reviewer-site",
      organizationId: orgId,
      projectId: "demo-reviewer-project",
      name: "Demo site compound",
      city: "Demo",
      country: "GB",
    },
  });
  await prisma.fieldWorkerSiteAssignment.upsert({
    where: { organizationId_userId_siteId: { organizationId: orgId, userId, siteId: "demo-reviewer-site" } },
    update: {},
    create: { organizationId: orgId, userId, siteId: "demo-reviewer-site", assignedByUserId: userId },
  });
}
