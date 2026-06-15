"use client";

import { useState, useTransition } from "react";

const VALID_PLANS = ["trial", "starter", "professional", "enterprise"] as const;
type Plan = (typeof VALID_PLANS)[number];

const PLAN_CLASSES: Record<Plan, string> = {
  trial: "bg-amber-100 text-amber-800 border border-amber-300",
  starter: "bg-blue-100 text-blue-800 border border-blue-300",
  professional: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  enterprise: "bg-purple-100 text-purple-800 border border-purple-300",
};

function isPlan(value: string): value is Plan {
  return (VALID_PLANS as readonly string[]).includes(value);
}

export function PlanSelector({
  orgId,
  currentPlan,
}: {
  orgId: string;
  currentPlan: string;
}) {
  const [plan, setPlan] = useState<string>(currentPlan);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const planClass = isPlan(plan)
    ? PLAN_CLASSES[plan]
    : "bg-zinc-100 text-zinc-800 border border-zinc-300";

  async function handleChange(newPlan: string) {
    setPlan(newPlan);
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/platform/orgs/${orgId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: newPlan }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.message ?? "Failed to update plan.");
          setPlan(currentPlan);
          return;
        }
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      } catch {
        setError("Network error. Could not update plan.");
        setPlan(currentPlan);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${planClass}`}
        >
          {plan}
        </span>
        <select
          value={plan}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className="rounded-[7px] border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm text-[#0f3e17] tracking-[-0.42px] focus:outline-none focus:ring-2 focus:ring-[#0f3e17] disabled:opacity-50"
        >
          {VALID_PLANS.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        {isPending && (
          <span className="text-xs text-[#333333]">Saving…</span>
        )}
        {saved && !isPending && (
          <span className="text-xs text-emerald-700">Saved</span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
