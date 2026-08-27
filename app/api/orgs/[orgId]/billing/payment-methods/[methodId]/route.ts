import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { detachPaymentMethod, setDefaultPaymentMethod } from '@/lib/billing/stripe';
import { writeAuditLog } from '@/lib/db/audit';

// DELETE /api/orgs/[orgId]/billing/payment-methods/[methodId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; methodId: string }> },
) {
  try {
    const { orgId, methodId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: methodId },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Payment method not found' },
        { status: 404 },
      );
    }

    if (paymentMethod.organizationId !== orgId) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Unauthorized' },
        { status: 403 },
      );
    }

    // Check if this is the default payment method and if there are other methods
    if (paymentMethod.isDefault) {
      const otherMethods = await prisma.paymentMethod.findMany({
        where: {
          organizationId: orgId,
          id: { not: methodId },
        },
      });

      if (otherMethods.length === 0) {
        return NextResponse.json(
          { code: 'INVALID_OPERATION', message: 'Cannot delete the only payment method' },
          { status: 400 },
        );
      }

      // Set another method as default
      const newDefault = otherMethods[0];
      const billing = await prisma.billingSubscription.findUnique({
        where: { organizationId: orgId },
      });

      if (billing?.stripeCustomerId) {
        await setDefaultPaymentMethod(billing.stripeCustomerId, newDefault.stripePaymentMethodId);
        await prisma.billingSubscription.update({
          where: { id: billing.id },
          data: { defaultPaymentMethodId: newDefault.stripePaymentMethodId },
        });
      }

      await prisma.paymentMethod.update({
        where: { id: newDefault.id },
        data: { isDefault: true },
      });
    }

    // Detach from Stripe
    await detachPaymentMethod(paymentMethod.stripePaymentMethodId);

    // Delete from database
    await prisma.paymentMethod.delete({
      where: { id: methodId },
    });

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'billing.payment_method_deleted',
      resourceType: 'PaymentMethod',
      resourceId: methodId,
      metadata: {
        brand: paymentMethod.brand,
        last4: paymentMethod.last4,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/orgs/[orgId]/billing/payment-methods/[methodId]/set-default
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; methodId: string }> },
) {
  try {
    const { orgId, methodId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: methodId },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Payment method not found' },
        { status: 404 },
      );
    }

    if (paymentMethod.organizationId !== orgId) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Unauthorized' },
        { status: 403 },
      );
    }

    // Update current default to false
    await prisma.paymentMethod.updateMany({
      where: { organizationId: orgId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const updatedMethod = await prisma.paymentMethod.update({
      where: { id: methodId },
      data: { isDefault: true },
    });

    // Update Stripe customer
    const billing = await prisma.billingSubscription.findUnique({
      where: { organizationId: orgId },
    });

    if (billing?.stripeCustomerId) {
      await setDefaultPaymentMethod(billing.stripeCustomerId, paymentMethod.stripePaymentMethodId);
      await prisma.billingSubscription.update({
        where: { id: billing.id },
        data: { defaultPaymentMethodId: paymentMethod.stripePaymentMethodId },
      });
    }

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'billing.payment_method_set_default',
      resourceType: 'PaymentMethod',
      resourceId: methodId,
      metadata: {
        brand: paymentMethod.brand,
        last4: paymentMethod.last4,
      },
    });

    return NextResponse.json({
      id: updatedMethod.id,
      brand: updatedMethod.brand,
      last4: updatedMethod.last4,
      expiryMonth: updatedMethod.expiryMonth,
      expiryYear: updatedMethod.expiryYear,
      isDefault: updatedMethod.isDefault,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
