import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { constructWebhookEvent, getSubscriptionPriceId, planForPriceId, subscriptionGrantsPlan, webhookSecrets } from "@/lib/billing/stripe";
import { securityLogger } from "@/lib/logger";

// Stripe requires the exact raw request bytes to verify the signature —
// req.json() would re-serialize and break it, so this reads text() and
// verifies before parsing anything.
//
// Configure this URL as the webhook endpoint in the Stripe Dashboard, with
// these events subscribed: customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted,
// customer.subscription.trial_will_end, invoice.payment_succeeded,
// invoice.payment_failed, invoice.payment_action_required. STRIPE_WEBHOOK_SECRET (documented in
// DEPLOYMENT.md) is what's verified against; it may list the sandbox and
// live endpoints' secrets, comma-separated.
export async function POST(req: NextRequest) {
  const secrets = webhookSecrets(process.env.STRIPE_WEBHOOK_SECRET);
  const signature = req.headers.get("stripe-signature");

  if (secrets.length === 0 || !signature) {
    securityLogger.warn("Stripe webhook rejected: missing secret or signature header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature, secrets);
  } catch (err) {
    securityLogger.warn("Stripe webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Stripe delivers at least once and retries on any non-2xx. Record the
  // event id first; a repeat is acknowledged without being handled again.
  try {
    await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    throw err;
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
      case "invoice.payment_action_required":
        await handleInvoiceNeedsAction(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
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
    // Forget the event so Stripe's retry is handled rather than skipped.
    await prisma.stripeWebhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
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
  // ...and only while the subscription is paid for: an incomplete (waiting on
  // 3-D Secure), past_due or unpaid subscription grants nothing new.
  if (plan && subscriptionGrantsPlan(subscription.status)) {
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
  // Paid features end with the subscription. Enterprise contracts are
  // invoiced outside self-serve billing and are left alone.
  await prisma.organization.updateMany({
    where: { id: billing.organizationId, plan: { in: ["starter", "growth"] } },
    data: { plan: "trial" },
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

// The bank wants the customer to confirm a renewal payment (3-D Secure).
// Stripe emails the customer a confirmation link when "Send emails about
// 3D Secure" is on (Dashboard > Settings > Billing); record it here.
async function handleInvoiceNeedsAction(invoice: Stripe.Invoice): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(invoice.customer!));
  if (!billing) return;
  await prisma.billingSubscription.update({
    where: { id: billing.id },
    data: { lastPaymentStatus: "requires_action" },
  });
  await writeAuditLog({
    organizationId: billing.organizationId,
    action: "billing.payment_action_required",
    resourceType: "BillingSubscription",
    resourceId: billing.id,
    metadata: { stripeInvoiceId: invoice.id, hostedInvoiceUrl: invoice.hosted_invoice_url ?? null },
  });
}

async function handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
  const billing = await findBillingByCustomerId(customerIdOf(subscription.customer));
  if (!billing) return;
  await writeAuditLog({
    organizationId: billing.organizationId,
    action: "billing.trial_will_end",
    resourceType: "BillingSubscription",
    resourceId: billing.id,
    metadata: { trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null },
  });
}
