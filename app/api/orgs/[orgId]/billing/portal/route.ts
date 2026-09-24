import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { createBillingPortalSession } from "@/lib/billing/stripe";

// POST /api/orgs/[orgId]/billing/portal
// A short-lived link to Stripe's customer portal, where an admin updates the
// card, downloads invoices and VAT receipts, or cancels. Changes made there
// come back through the webhook.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const billing = await prisma.billingSubscription.findUnique({
      where: { organizationId: orgId },
      select: { id: true, stripeCustomerId: true },
    });
    if (!billing?.stripeCustomerId) {
      return apiError("NO_STRIPE_CUSTOMER", "Add a payment method first; there is no billing account to manage yet.", 400);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const url = await createBillingPortalSession(billing.stripeCustomerId, `${origin}/orgs/${orgId}/settings/billing`);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "billing.portal_opened",
      resourceType: "BillingSubscription",
      resourceId: billing.id,
    });

    return NextResponse.json({ url });
  } catch (err) {
    return handleRouteError(err);
  }
}
