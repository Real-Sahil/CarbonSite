/**
 * What a failed renewal does to an organisation. Stripe keeps retrying the
 * card (Smart Retries); MetricOra gives GRACE_DAYS of full access from the
 * first failure, showing admins a banner, then blocks new work (the same
 * gate as an expired trial: reading and exporting stay open) until the
 * invoice is paid. An unpaid or expired-incomplete subscription is blocked
 * straight away.
 */
export const PAYMENT_GRACE_DAYS = 14;

export type PaymentState =
  | { state: "ok" }
  | { state: "grace"; failedAt: Date; blocksOn: Date }
  | { state: "blocked"; failedAt: Date | null };

export function paymentState(sub: { status: string; paymentFailedAt: Date | null } | null, now = new Date()): PaymentState {
  if (!sub) return { state: "ok" };
  if (sub.status === "unpaid" || sub.status === "incomplete_expired") return { state: "blocked", failedAt: sub.paymentFailedAt };
  if (!sub.paymentFailedAt || (sub.status !== "past_due" && sub.status !== "active")) return { state: "ok" };
  // "active" with a failure recorded: a failed invoice Stripe is still retrying
  // before the subscription itself turns past_due.
  const blocksOn = new Date(sub.paymentFailedAt.getTime() + PAYMENT_GRACE_DAYS * 86_400_000);
  if (sub.status === "past_due" && now >= blocksOn) return { state: "blocked", failedAt: sub.paymentFailedAt };
  return { state: "grace", failedAt: sub.paymentFailedAt, blocksOn };
}
