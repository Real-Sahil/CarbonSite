import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import {
  confirmSetupIntent,
  getPaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  extractPaymentMethodData,
  getCustomerPaymentMethods,
} from '@/lib/billing/stripe';
import { writeAuditLog } from '@/lib/db/audit';

const setupIntentSchema = z.object({
  setupIntentId: z.string().min(1),
});

// GET /api/orgs/[orgId]/billing/payment-methods
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      paymentMethods,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/billing/payment-methods
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = setupIntentSchema.parse(await req.json());

    // Confirm the SetupIntent
    const setupIntent = await confirmSetupIntent(body.setupIntentId);

    if (!setupIntent.payment_method) {
      return NextResponse.json(
        { code: 'INVALID_SETUP_INTENT', message: 'No payment method attached to SetupIntent' },
        { status: 400 },
      );
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    // Get payment method details from Stripe
    const stripePaymentMethod = await getPaymentMethod(paymentMethodId);
    const pmData = extractPaymentMethodData(stripePaymentMethod);

    // Get billing subscription
    const billing = await prisma.billingSubscription.findUnique({
      where: { organizationId: orgId },
    });

    if (!billing) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Billing subscription not found' },
        { status: 404 },
      );
    }

    // Check if this is the first payment method
    const existingMethods = await prisma.paymentMethod.findMany({
      where: { organizationId: orgId },
    });

    const isDefault = existingMethods.length === 0;

    // Create payment method record
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        organizationId: orgId,
        billingSubscriptionId: billing.id,
        stripePaymentMethodId: paymentMethodId,
        brand: pmData.brand,
        last4: pmData.last4,
        expiryMonth: pmData.expiryMonth,
        expiryYear: pmData.expiryYear,
        isDefault,
      },
    });

    // If default, update Stripe customer
    if (isDefault && billing.stripeCustomerId) {
      await setDefaultPaymentMethod(billing.stripeCustomerId, paymentMethodId);
      await prisma.billingSubscription.update({
        where: { id: billing.id },
        data: { defaultPaymentMethodId: paymentMethodId },
      });
    }

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'billing.payment_method_added',
      resourceType: 'PaymentMethod',
      resourceId: paymentMethod.id,
      metadata: {
        brand: pmData.brand,
        last4: pmData.last4,
        isDefault,
      },
    });

    return NextResponse.json({
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
