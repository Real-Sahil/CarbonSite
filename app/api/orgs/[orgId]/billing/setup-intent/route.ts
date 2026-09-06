import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { createOrGetStripeCustomer, createSetupIntent } from '@/lib/billing/stripe';
import { TRIAL_LENGTH_DAYS } from '@/lib/billing/limits';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    // Get or create billing subscription
    let billing = await prisma.billingSubscription.findUnique({
      where: { organizationId: orgId },
    });

    if (!billing) {
      // Normally created at org-creation time (app/api/orgs/route.ts) —
      // this only runs for an org that predates that, so it doesn't lose
      // billing/trial state.
      const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
      billing = await prisma.billingSubscription.create({
        data: {
          organizationId: orgId,
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      });
    }

    // Get or create Stripe customer
    let stripeCustomerId = billing.stripeCustomerId;

    if (!stripeCustomerId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        return NextResponse.json(
          { code: 'NOT_FOUND', message: 'Organization not found' },
          { status: 404 },
        );
      }

      // Get a member email to use for Stripe customer
      const member = await prisma.organizationMembership.findFirst({
        where: { organizationId: orgId },
        include: { user: true },
      });

      const email = member?.user.email || `org-${orgId}@metricora.co.uk`;

      const stripeCustomer = await createOrGetStripeCustomer(orgId, email);
      stripeCustomerId = stripeCustomer.id;

      // Update billing subscription with Stripe customer ID
      billing = await prisma.billingSubscription.update({
        where: { id: billing.id },
        data: { stripeCustomerId },
      });
    }

    // Create SetupIntent
    if (!stripeCustomerId) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to initialize Stripe customer' },
        { status: 500 },
      );
    }

    const setupIntent = await createSetupIntent(stripeCustomerId);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
