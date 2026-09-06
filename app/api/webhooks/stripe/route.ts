import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { constructWebhookEvent, getSubscriptionPriceId, planForPriceId } from "@/lib/billing/stripe";
import { securityLogger } from "@/lib/logger";

// Stripe requires the exact raw request bytes to verify the signature —
// req.json() would re-serialize and break it, so this reads text() and
// verifies before parsing anything.
//
// Configure this URL as the webhook endpoint in the Stripe Dashboard, with
// these events subscribed: customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_succeeded,
// invoice.payment_failed. STRIPE_WEBHOOK_SECRET (documented in
// DEPLOYMENT.md, previously unused) is what's verified against.
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    securityLogger.warn("Stripe webhook rejected: missing secret or signature header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    securityLogger.warn("Stripe webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Every other event type is either irrelevant to billing state or
        // already reflected by one we do handle — safe to ignore.
        break;
    }
  } catch (err) {
    // Stripe retries on non-2xx, which is exactly what we want for a
    // transient failure (DB hiccup) — log and return 500 rather than
    // swallowing it as a 200, which would silently drop the event forever.
    securityLogger.error("Stripe webhook handler failed", {
      eventType: event.type,
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function findBillingByCustomerId(customerId: string) {
  return prisma.billingSubscription.findUnique({ where: { stripeCustomerId: customerId } });
}

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(subscription.customer));
  if (!billing) {
    securityLogger.warn("Stripe subscription event for unknown customer", {
      stripeCustomerId: customerIdOf(subscription.customer),
    });
    return;
  }

  const priceId = getSubscriptionPriceId(subscription);
  const plan = priceId ? planForPriceId(priceId) : null;

  await prisma.billingSubscription.update({
    where: { id: billing.id },
    data: {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      nextBillingDate: subscription.cancel_at_period_end
        ? null
        : new Date(subscription.current_period_end * 1000),
      // A subscription actually running (not incomplete/past_due-only)
      // means the org is no longer on a bare trial, whatever plan it maps
      // to — only clear this once, never re-set it once cleared.
      trialEndsAt: subscription.status === "active" || subscription.status === "trialing" ? null : billing.trialEndsAt,
    },
  });

  // Only move Organization.plan when the price maps to a plan we recognize
  // (planForPriceId returns null if the env vars for it aren't configured,
  // or the price doesn't match any of ours) — never silently blank a plan
  // out from a webhook we can't fully interpret.
  if (plan) {
    await prisma.organization.update({ where: { id: billing.organizationId }, data: { plan } });
  }

  await writeAuditLog({
    organizationId: billing.organizationId,
    action: "billing.subscription_synced",
    resourceType: "BillingSubscription",
    resourceId: billing.id,
    metadata: { stripeSubscriptionId: subscription.id, status: subscription.status, plan },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(subscription.customer));
  if (!billing) return;

  await prisma.billingSubscription.update({
    where: { id: billing.id },
    data: { status: "canceled", nextBillingDate: null },
  });

  await writeAuditLog({
    organizationId: billing.organizationId,
    action: "billing.subscription_ended",
    resourceType: "BillingSubscription",
    resourceId: billing.id,
    metadata: { stripeSubscriptionId: subscription.id },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(invoice.customer!));
  if (!billing) return;

  await prisma.billingSubscription.update({
    where: { id: billing.id },
    data: {
      lastPaymentStatus: "succeeded",
      lastPaymentDate: new Date(),
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(invoice.customer!));
  if (!billing) return;

  await prisma.billingSubscription.update({
    where: { id: billing.id },
    data: { lastPaymentStatus: "failed" },
  });

  await writeAuditLog({
    organizationId: billing.organizationId,
    action: "billing.payment_failed",
    resourceType: "BillingSubscription",
    resourceId: billing.id,
    metadata: { stripeInvoiceId: invoice.id, attemptCount: invoice.attempt_count },
  });
}
