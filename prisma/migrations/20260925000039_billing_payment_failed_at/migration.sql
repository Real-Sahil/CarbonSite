-- First unpaid renewal failure, for the 14-day grace period. Additive.
-- AlterTable
ALTER TABLE "billing_subscriptions" ADD COLUMN     "payment_failed_at" TIMESTAMP(3);

