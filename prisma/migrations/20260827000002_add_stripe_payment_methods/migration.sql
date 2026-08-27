-- Add Stripe fields to billing_subscriptions
ALTER TABLE "billing_subscriptions" ADD COLUMN "stripe_customer_id" TEXT UNIQUE;
ALTER TABLE "billing_subscriptions" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "billing_subscriptions" ADD COLUMN "default_payment_method_id" TEXT;
ALTER TABLE "billing_subscriptions" ADD COLUMN "last_payment_status" TEXT;
ALTER TABLE "billing_subscriptions" ADD COLUMN "last_payment_date" TIMESTAMP(3);
ALTER TABLE "billing_subscriptions" ADD COLUMN "next_billing_date" TIMESTAMP(3);

-- Create payment_methods table
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "billing_subscription_id" TEXT NOT NULL,
    "stripe_payment_method_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expiry_month" INTEGER NOT NULL,
    "expiry_year" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_methods_stripe_payment_method_id_key" UNIQUE ("stripe_payment_method_id"),
    CONSTRAINT "payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
    CONSTRAINT "payment_methods_billing_subscription_id_fkey" FOREIGN KEY ("billing_subscription_id") REFERENCES "billing_subscriptions" ("id") ON DELETE CASCADE
);

-- Create indexes for payment_methods
CREATE INDEX "payment_methods_organization_id_idx" ON "payment_methods"("organization_id");
CREATE INDEX "payment_methods_billing_subscription_id_idx" ON "payment_methods"("billing_subscription_id");
