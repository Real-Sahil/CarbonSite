"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS } from "@/lib/billing/limits";
import { Loader2 } from "lucide-react";

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
      onChanged();
    } catch {
      setError("Network error. Could not start the subscription.");
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
