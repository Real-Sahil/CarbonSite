import Stripe from 'stripe';

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }
  return stripe;
}

export { getStripe };

// One Stripe customer per organisation. The idempotency key makes a retried
// or doubled request (two tabs, a timeout) return the same customer instead
// of creating a second one; the search catches one created more than 24h ago
// whose id was never stored.
export async function createOrGetStripeCustomer(orgId: string, email: string) {
  const found = await getStripe().customers.search({ query: `metadata['organizationId']:'${orgId.replace(/'/g, "")}'`, limit: 1 });
  if (found.data[0]) return found.data[0];
  return getStripe().customers.create(
    { email, metadata: { organizationId: orgId } },
    { idempotencyKey: `metricora-customer-${orgId}` },
  );
}

export async function createSetupIntent(customerId: string) {
  // Create a SetupIntent for capturing payment method details
  const setupIntent = await getStripe().setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });

  return setupIntent;
}

export async function confirmSetupIntent(setupIntentId: string) {
  // Retrieve and confirm a SetupIntent
  const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);

  if (setupIntent.status !== 'succeeded') {
    throw new Error(`SetupIntent not in succeeded state: ${setupIntent.status}`);
  }

  return setupIntent;
}

export async function getPaymentMethod(paymentMethodId: string) {
  // Retrieve payment method details from Stripe
  const paymentMethod = await getStripe().paymentMethods.retrieve(paymentMethodId);
  return paymentMethod;
}

export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
  // Set a payment method as default for a customer
  const customer = await getStripe().customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  return customer;
}

export async function detachPaymentMethod(paymentMethodId: string) {
  // Detach a payment method from a customer
  const paymentMethod = await getStripe().paymentMethods.detach(paymentMethodId);
  return paymentMethod;
}

export async function getCustomerPaymentMethods(customerId: string) {
  // List all payment methods for a customer
  const paymentMethods = await getStripe().paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  return paymentMethods.data;
}

export interface PaymentMethodData {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export function extractPaymentMethodData(paymentMethod: Stripe.PaymentMethod): PaymentMethodData {
  const card = paymentMethod.card;
  if (!card) {
    throw new Error('Payment method is not a card');
  }

  return {
    brand: card.brand,
    last4: card.last4 || '',
    expiryMonth: card.exp_month || 0,
    expiryYear: card.exp_year || 0,
  };
}

// Self-serve subscription plans and their billing intervals. Enterprise has
// no self-serve price (PLAN_PRICES.enterprise is 0/0, "contact sales") and
// trial has nothing to subscribe to, so only these two are ever passed here.
export type SubscribablePlan = 'starter' | 'growth';
export type BillingInterval = 'monthly' | 'annual';

// Stripe Price IDs are created in the Stripe Dashboard, not something this
// codebase can generate — one env var per (plan, interval) combination.
const PRICE_ENV_VARS: Record<SubscribablePlan, Record<BillingInterval, string>> = {
  starter: { monthly: 'STRIPE_PRICE_STARTER_MONTHLY', annual: 'STRIPE_PRICE_STARTER_ANNUAL' },
  growth: { monthly: 'STRIPE_PRICE_GROWTH_MONTHLY', annual: 'STRIPE_PRICE_GROWTH_ANNUAL' },
};

export function getPriceId(plan: SubscribablePlan, interval: BillingInterval): string {
  const envVar = PRICE_ENV_VARS[plan][interval];
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not set — cannot subscribe an organization to ${plan}/${interval} without it.`);
  }
  return priceId;
}

// 'default_incomplete' leaves a first payment that needs the customer's bank
// to confirm it (3-D Secure, required for most UK and EU cards under SCA) as
// an incomplete subscription with a client secret, instead of failing it.
// The plan is only granted once Stripe reports it active (the webhook).
export async function createSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  idempotencyKey: string;
}): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.create(
    {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      default_payment_method: params.paymentMethodId,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    },
    { idempotencyKey: params.idempotencyKey },
  );
}

/** Client secret of the first invoice's payment when the bank must confirm it, else null. */
export function pendingPaymentClientSecret(subscription: Stripe.Subscription): string | null {
  if (subscription.status !== 'incomplete') return null;
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return null;
  const pi = invoice.payment_intent;
  if (!pi || typeof pi === 'string') return null;
  return pi.status === 'requires_action' || pi.status === 'requires_confirmation' ? pi.client_secret : null;
}

/** Stripe-hosted page where the customer updates cards, downloads invoices and cancels. */
export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

/** Statuses that pay for a plan. incomplete, past_due, unpaid and canceled do not. */
export function subscriptionGrantsPlan(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing';
}

export async function updateSubscriptionPrice(
  subscriptionId: string,
  priceId: string,
): Promise<Stripe.Subscription> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const currentItem = subscription.items.data[0];
  return getStripe().subscriptions.update(subscriptionId, {
    items: [{ id: currentItem.id, price: priceId }],
    proration_behavior: 'create_prorations',
  });
}

// Cancels at the end of the current billing period rather than
// immediately, so an org that's already paid for the period keeps access
// through it — matches the pricing page's own "cancel anytime" language.
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export function constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// A Stripe subscription price can be on either the subscription item or
// (for older API shapes) elsewhere; this always reads it off the first
// item, which is how createSubscription()/updateSubscriptionPrice() above
// always shape a subscription (exactly one price per org).
export function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price.id ?? null;
}

// Reverse lookup from a Stripe price ID back to our plan name, for syncing
// webhook events (which carry Stripe's price ID, not our plan string) back
// onto Organization.plan/BillingSubscription.plan.
export function planForPriceId(priceId: string): SubscribablePlan | null {
  for (const plan of Object.keys(PRICE_ENV_VARS) as SubscribablePlan[]) {
    for (const interval of Object.keys(PRICE_ENV_VARS[plan]) as BillingInterval[]) {
      if (process.env[PRICE_ENV_VARS[plan][interval]] === priceId) return plan;
    }
  }
  return null;
}
