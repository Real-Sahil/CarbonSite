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

export async function createOrGetStripeCustomer(orgId: string, email: string) {
  // Create a new Stripe customer for the organization
  const customer = await getStripe().customers.create({
    email,
    metadata: {
      organizationId: orgId,
    },
  });

  return customer;
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
