"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS } from "@/lib/billing/limits";
import { Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

type SubscribablePlan = "starter" | "growth";

export function SubscriptionActions({
  orgId,
  currentPlan,
  hasActiveSubscription,
  onChanged,
}: {
  orgId: string;
  currentPlan: string;
  hasActiveSubscription: boolean;
  onChanged: () => void;
}) {
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/billing/payment-methods`)
      .then((r) => r.json())
      .then((d) => setHasPaymentMethod((d.paymentMethods ?? []).length > 0))
      .catch(() => setHasPaymentMethod(false));
  }, [orgId]);

  async function subscribe(plan: SubscribablePlan) {
    setError(null);
    setPending(plan);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "monthly" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Could not start the subscription.");
        return;
      }
      // The bank wants the customer to confirm the first payment (3-D Secure).
      if (body?.clientSecret) {
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        const stripe = key ? await loadStripe(key) : null;
        if (!stripe) {
          setError("Card confirmation could not load. Refresh and try again.");
          return;
        }
        const { error: confirmError } = await stripe.confirmCardPayment(body.clientSecret);
        if (confirmError) {
          setError(confirmError.message ?? "Your bank did not confirm the payment.");
          return;
        }
      }
      onChanged();
    } catch {
      setError("Network error. Could not start the subscription.");
    } finally {
      setPending(null);
    }
  }

  async function manageBilling() {
    setError(null);
    setPending("portal");
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/portal`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.url) {
        setError(body?.message ?? "Could not open billing management.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error. Could not open billing management.");
    } finally {
      setPending(null);
    }
  }

  async function cancel() {
    setError(null);
    setPending("cancel");
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/subscription`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Could not cancel the subscription.");
        return;
      }
      onChanged();
    } catch {
      setError("Network error. Could not cancel the subscription.");
    } finally {
      setPending(null);
    }
  }

  const subscribablePlans: SubscribablePlan[] = ["starter", "growth"].filter(
    (p) => p !== currentPlan,
  ) as SubscribablePlan[];

  return (
    <div className="flex flex-col gap-2">
      {hasPaymentMethod === false && (
        <p className="text-xs text-gray-500">Add a payment method above before subscribing to a paid plan.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {subscribablePlans.map((plan) => (
          <Button
            key={plan}
            size="sm"
            variant="outline"
            disabled={!hasPaymentMethod || pending !== null}
            onClick={() => subscribe(plan)}
          >
            {pending === plan && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Subscribe to {PLAN_LABELS[plan]}
          </Button>
        ))}
        {hasPaymentMethod && (
          <Button size="sm" variant="outline" disabled={pending !== null} onClick={manageBilling}>
            {pending === "portal" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Invoices and billing details
          </Button>
        )}
        {hasActiveSubscription && (
          <Button size="sm" variant="ghost" disabled={pending !== null} onClick={cancel}>
            {pending === "cancel" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Cancel subscription
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
