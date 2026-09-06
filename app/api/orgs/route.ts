export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError } from "@/lib/validation/api";
import { createOrgSchema } from "@/lib/validation/org";
import { TRIAL_LENGTH_DAYS } from "@/lib/billing/limits";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const limited = await rateLimitRequest(req, {
      key: `org-create:${session.user.id}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createOrgSchema.parse(await req.json());

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: body.name,
          industry: body.industry ?? null,
          hqCountry: body.hqCountry ?? null,
        },
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: created.id,
          userId: session.user.id,
          role: "admin",
        },
      });

      // Without this row, trialEndsAt is never set at all — the pricing
      // page's "30-day free trial" and the trial-expiry gate
      // (requireActiveBilling in lib/billing/limits.ts) both depend on it
      // existing from the moment the org is created, not lazily on first
      // payment-method add (setup-intent's own fallback covers that path
      // too, but shouldn't be the only place a trial window gets set).
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
      await tx.billingSubscription.create({
        data: {
          organizationId: created.id,
          plan: "trial",
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });

      return created;
    });

    await writeAuditLog({
      organizationId: org.id,
      actorUserId: session.user.id,
      action: "org.created",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { name: org.name },
    });

    return NextResponse.json(org, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
