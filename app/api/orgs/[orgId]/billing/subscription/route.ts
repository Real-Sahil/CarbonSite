import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import {
  createSubscription,
  updateSubscriptionPrice,
  cancelSubscriptionAtPeriodEnd,
  getPriceId,
  type SubscribablePlan,
} from "@/lib/billing/stripe";

const subscribeSchema = z.object({
  plan: z.enum(["starter", "growth"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

// POST /api/orgs/[orgId]/billing/subscription
// Starts (or changes onto) a real, paid Stripe subscription for this org's
// existing default payment method. This is the piece that was missing
// entirely before: Stripe only ever captured a card via SetupIntent, with
// nothing that actually started billing or moved Organization.plan off
// "trial" except a manual internal admin PATCH.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const parsed = subscribeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid plan or interval.", 400, parsed.error.flatten().fieldErrors);
    }
    const { plan, interval } = parsed.data;

    const billing = await prisma.billingSubscription.findUnique({ where: { organizationId: orgId } });
    if (!billing?.stripeCustomerId) {
      return apiError(
        "NO_STRIPE_CUSTOMER",
        "Set up billing first (add a payment method) before subscribing.",
        400,
      );
    }
    if (!billing.defaultPaymentMethodId) {
      return apiError(
        "NO_PAYMENT_METHOD",
        "Add a payment method before subscribing to a paid plan.",
        400,
      );
    }

    const priceId = getPriceId(plan as SubscribablePlan, interval);

    // Already has a Stripe subscription (e.g. switching starter <-> growth) —
    // cancel_at_period_end may have been set previously; a fresh subscribe
    // action means the org wants to keep going, so let the webhook's
    // customer.subscription.updated event reconcile status/dates either way.
    const subscription = billing.stripeSubscriptionId
      ? await updateSubscriptionPrice(billing.stripeSubscriptionId, priceId)
      : await createSubscription({
          customerId: billing.stripeCustomerId,
          priceId,
          paymentMethodId: billing.defaultPaymentMethodId,
        });

    const updated = await prisma.billingSubscription.update({
      where: { id: billing.id },
      data: {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        nextBillingDate: new Date(subscription.current_period_end * 1000),
        trialEndsAt: null,
      },
    });

    await prisma.organization.update({ where: { id: orgId }, data: { plan } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "billing.subscription_started",
      resourceType: "BillingSubscription",
      resourceId: updated.id,
      metadata: { plan, interval, stripeSubscriptionId: subscription.id, status: subscription.status },
    });

    return NextResponse.json({
      plan,
      status: subscription.status,
      currentPeriodEnd: updated.currentPeriodEnd,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/billing/subscription
// Cancels at the end of the current billing period rather than
// immediately — the org keeps its paid-for access through the period it's
// already been billed for, matching the pricing page's own "cancel
// anytime" language.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const billing = await prisma.billingSubscription.findUnique({ where: { organizationId: orgId } });
    if (!billing?.stripeSubscriptionId) {
      return apiError("NO_SUBSCRIPTION", "This organization has no active subscription to cancel.", 400);
    }

    const subscription = await cancelSubscriptionAtPeriodEnd(billing.stripeSubscriptionId);

    await prisma.billingSubscription.update({
      where: { id: billing.id },
      data: { status: subscription.status },
    });

    const effectiveAt = new Date(subscription.current_period_end * 1000);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "billing.subscription_cancel_requested",
      resourceType: "BillingSubscription",
      resourceId: billing.id,
      metadata: { stripeSubscriptionId: billing.stripeSubscriptionId, effectiveAt: effectiveAt.toISOString() },
    });

    return NextResponse.json({
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: effectiveAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
