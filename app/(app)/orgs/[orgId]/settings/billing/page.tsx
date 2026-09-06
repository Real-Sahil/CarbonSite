"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowUpRight, Zap, FileText, Upload, Calculator, Key, Users, Building2, Check, X as XIcon } from "lucide-react";
import { getLimits, hasFeature, PLAN_LABELS, PLAN_PRICES, usagePercent, type PlanFeature } from "@/lib/billing/limits";
import { PaymentMethodsSection } from "./payment-methods-section";
import { SubscriptionActions } from "./subscription-actions";

// Captured once at module load — pure constant, safe for React Compiler.
const PAGE_LOAD_TIME = Date.now();

type Plan = "trial" | "starter" | "growth" | "enterprise";

interface UsageData {
  plan: Plan;
  subscription: {
    status: string;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  usage: Record<string, number>;
  limits: Record<string, number>;
}

const METER_CONFIG = [
  { key: "field_submission.submitted", limitKey: "fieldSubmissionsPerMonth", label: "Field submissions", icon: Zap },
  { key: "report.generated",           limitKey: "reportsPerMonth",          label: "Reports generated", icon: FileText },
  { key: "import.committed",           limitKey: "importsPerMonth",          label: "Imports committed", icon: Upload },
  { key: "calculation.run",            limitKey: "calculationRunsPerMonth",  label: "Calculation runs",  icon: Calculator },
  { key: "api.request",               limitKey: "apiRequestsPerMonth",      label: "API requests",      icon: Key },
  { key: "members",                   limitKey: "members",                  label: "Team members",      icon: Users },
  { key: "facilities",                limitKey: "facilities",               label: "Facilities",        icon: Building2 },
];

const PLANS: Plan[] = ["trial", "starter", "growth", "enterprise"];

const FEATURE_CONFIG: { key: PlanFeature; label: string }[] = [
  { key: "accountingIntegrations", label: "Accounting software sync" },
  { key: "invoiceAnomalyDetection", label: "Invoice anomaly detection" },
  { key: "liveDashboard",          label: "Live real-time dashboard" },
  { key: "sso",                    label: "SSO / SAML" },
];

function formatLimit(n: number): string {
  if (!isFinite(n)) return "Unlimited";
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

function MeterBar({ used, limit, label, icon: Icon }: { used: number; limit: number; label: string; icon: React.ElementType }) {
  const pct = usagePercent(used, limit);
  const isUnlimited = !isFinite(limit);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-400" : "bg-[#f97316]";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Icon className="h-4 w-4 text-gray-500 shrink-0" />
          {label}
        </div>
        <span className="text-xs text-gray-500 tabular-nums shrink-0">
          {used.toLocaleString()} / {isUnlimited ? "Unlimited" : formatLimit(limit)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        {!isUnlimited && (
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        )}
        {isUnlimited && (
          <div className="h-full rounded-full bg-[#BAE6FD] w-full" />
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchUsage = useCallback(() => {
    fetch(`/api/orgs/${orgId}/billing/usage`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    refetchUsage();
  }, [refetchUsage]);

  const plan = (data?.plan ?? "trial") as Plan;
  const trialDaysLeft = data?.subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(data.subscription.trialEndsAt).getTime() - PAGE_LOAD_TIME) / 86_400_000))
    : null;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Current plan and usage for this billing period.</p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {PLAN_LABELS[plan] ?? plan}
              </span>
              {plan === "trial" && trialDaysLeft !== null && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {trialDaysLeft}d left
                </span>
              )}
              {data?.subscription?.status === "active" && plan !== "trial" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Active
                </span>
              )}
            </div>
            {PLAN_PRICES[plan].monthly > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                £{PLAN_PRICES[plan].monthly}/mo per organisation
              </p>
            )}
            {plan === "trial" && (
              <p className="text-sm text-gray-500 mt-0.5">Free during trial</p>
            )}
          </div>
          {plan === "enterprise" && (
            <a
              href="mailto:hello@carbonsite.io?subject=Enterprise%20enquiry"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c] transition-colors shrink-0"
            >
              Contact sales
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {data?.subscription && (
          <p className="mt-3 text-xs text-gray-500">
            Billing period:{" "}
            {new Date(data.subscription.currentPeriodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {" - "}
            {new Date(data.subscription.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}

        {plan !== "enterprise" && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <SubscriptionActions
              orgId={orgId}
              currentPlan={plan}
              hasActiveSubscription={data?.subscription?.status === "active"}
              onChanged={refetchUsage}
            />
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <PaymentMethodsSection orgId={orgId} />

      {/* Usage meters */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Usage this period</h2>
        {loading ? (
          <div className="space-y-5">
            {METER_CONFIG.map((m) => (
              <div key={m.key} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {METER_CONFIG.map((m) => (
              <MeterBar
                key={m.key}
                label={m.label}
                icon={m.icon}
                used={data?.usage[m.key] ?? 0}
                limit={data?.limits[m.limitKey] ?? Infinity}
              />
            ))}
          </div>
        )}
      </div>

      {/* Plan comparison */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Available plans</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-6 text-left font-medium text-gray-500 w-48"></th>
                {PLANS.map((p) => (
                  <th
                    key={p}
                    className={`py-3 px-4 text-center font-semibold ${p === plan ? "text-[#f97316]" : "text-gray-700"}`}
                  >
                    {PLAN_LABELS[p]}
                    {p === plan && (
                      <span className="ml-1.5 text-[10px] font-medium text-[#f97316] uppercase tracking-wide">current</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-3 px-6 text-gray-500">Price</td>
                {PLANS.map((p) => (
                  <td key={p} className="py-3 px-4 text-center text-gray-700 tabular-nums">
                    {PLAN_PRICES[p].monthly === 0 ? (p === "enterprise" ? "Custom" : "Free") : `£${PLAN_PRICES[p].monthly}/mo`}
                  </td>
                ))}
              </tr>
              {METER_CONFIG.map((m) => (
                <tr key={m.key}>
                  <td className="py-3 px-6 text-gray-500">{m.label}</td>
                  {PLANS.map((p) => {
                    const lims = getLimits(p);
                    const val = lims[m.limitKey as keyof typeof lims] as number;
                    return (
                      <td key={p} className="py-3 px-4 text-center text-gray-700 tabular-nums">
                        {formatLimit(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {FEATURE_CONFIG.map((f) => (
                <tr key={f.key}>
                  <td className="py-3 px-6 text-gray-500">{f.label}</td>
                  {PLANS.map((p) => (
                    <td key={p} className="py-3 px-4 text-center">
                      {hasFeature(p, f.key) ? (
                        <Check className="h-4 w-4 mx-auto text-emerald-600" />
                      ) : (
                        <XIcon className="h-4 w-4 mx-auto text-gray-400" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Switch between Starter and Growth any time above. For Enterprise —
        custom contracts, SSO, and dedicated support — contact{" "}
        <a href="mailto:hello@carbonsite.io" className="text-[#f97316] hover:underline">
          hello@carbonsite.io
        </a>
        .
      </p>
    </div>
  );
}
