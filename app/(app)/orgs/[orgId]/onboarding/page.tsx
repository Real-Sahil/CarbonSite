"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Users,
  CalendarRange,
  Upload,
  Calculator,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type StepId =
  | "org_profile"
  | "first_team_member"
  | "reporting_period"
  | "first_import"
  | "first_calculation";

interface StepDef {
  id: StepId;
  label: string;
  description: string;
  detail: string;
  icon: React.ElementType;
  href: (orgId: string) => string;
  cta: string;
}

const STEP_DEFS: StepDef[] = [
  {
    id: "org_profile",
    label: "Organisation profile",
    description: "Set your industry, country, and reporting currency",
    detail:
      "This ensures emission factors are matched correctly and reports use the right regional standards.",
    icon: Building2,
    href: (orgId) => `/orgs/${orgId}/settings/operations`,
    cta: "Go to settings",
  },
  {
    id: "first_team_member",
    label: "Invite your team",
    description: "Add at least one other member to your organisation",
    detail:
      "Sustainability reporting works best with a team. Invite editors, reviewers, or auditors now.",
    icon: Users,
    href: (orgId) => `/orgs/${orgId}/settings/members`,
    cta: "Invite members",
  },
  {
    id: "reporting_period",
    label: "Create a reporting period",
    description: "Define your first annual or quarterly reporting window",
    detail:
      "All activity records and calculations are scoped to a reporting period. Create one before importing data.",
    icon: CalendarRange,
    href: (orgId) => `/orgs/${orgId}/settings/operations`,
    cta: "Create period",
  },
  {
    id: "first_import",
    label: "Import activity data",
    description: "Upload a CSV or enter records manually",
    detail:
      "Import your first batch of activity records: fuel, electricity, travel, or waste data.",
    icon: Upload,
    href: (orgId) => `/orgs/${orgId}/imports`,
    cta: "Go to imports",
  },
  {
    id: "first_calculation",
    label: "Run your first calculation",
    description: "Calculate CO2e for your activity records",
    detail:
      "Once records are committed, run a calculation to produce emission figures you can publish and report on.",
    icon: Calculator,
    href: (orgId) => `/orgs/${orgId}/calculations`,
    cta: "Go to calculations",
  },
];

interface StepState {
  id: StepId;
  done: boolean;
}

export default function OnboardingPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const router = useRouter();

  const [steps, setSteps] = useState<StepState[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingStep, setMarkingStep] = useState<StepId | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/onboarding`);
      if (!res.ok) return;
      const data = await res.json();
      setSteps(data.steps ?? []);
      if (data.isComplete) {
        router.push(`/orgs/${orgId}/dashboard`);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, router]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  const [skipping, setSkipping] = useState(false);

  const skipAll = async () => {
    setSkipping(true);
    try {
      await fetch(`/api/orgs/${orgId}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipAll: true }),
      });
    } finally {
      router.push(`/orgs/${orgId}/dashboard`);
    }
  };

  const markStepDone = async (stepId: StepId) => {
    setMarkingStep(stepId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSteps(
        STEP_DEFS.map((s) => ({
          id: s.id,
          done: (data.steps as string[]).includes(s.id),
        })),
      );
      if (data.isComplete) {
        router.push(`/orgs/${orgId}/dashboard`);
      }
    } finally {
      setMarkingStep(null);
    }
  };

  const completedCount = steps.filter((s) => s.done).length;
  const total = STEP_DEFS.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const activeStepIndex = steps.findIndex((s) => !s.done);
  const activeStepId = activeStepIndex >= 0 ? steps[activeStepIndex]?.id : null;

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA]">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium tracking-widest uppercase text-[#f97316] mb-3">
            Setup
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-2">
            Get MetricOra ready
          </h1>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Complete these steps to start tracking emissions for your organisation. You can come
            back to this at any time from the dashboard.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#6B7280]">
              {completedCount} of {total} complete
            </span>
            <span className="text-xs font-medium text-[#111827]">{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEP_DEFS.map((def, i) => {
            const stepState = steps.find((s) => s.id === def.id);
            const done = stepState?.done ?? false;
            const isActive = def.id === activeStepId;
            const Icon = def.icon;
            const isMarking = markingStep === def.id;

            return (
              <div
                key={def.id}
                className={`rounded-[14px] border transition-all ${
                  done
                    ? "border-[#D1FAE5] bg-white opacity-60"
                    : isActive
                    ? "border-[#BAE6FD] bg-white shadow-sm"
                    : "border-[#E5E7EB] bg-white"
                }`}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Step number / check */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                      done
                        ? "bg-[#D1FAE5]"
                        : isActive
                        ? "bg-[#FFF7ED] border border-[#FED7AA]"
                        : "bg-[#F3F4F6]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          isActive ? "text-[#f97316]" : "text-[#9CA3AF]"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          done ? "text-emerald-600" : isActive ? "text-[#f97316]" : "text-[#9CA3AF]"
                        }`}
                      />
                      <p
                        className={`text-sm font-medium tracking-[-0.3px] ${
                          done ? "text-[#6B7280] line-through" : "text-[#111827]"
                        }`}
                      >
                        {def.label}
                      </p>
                    </div>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      {isActive ? def.detail : def.description}
                    </p>
                  </div>

                  {/* Actions */}
                  {!done && (
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {isActive && (
                        <Link href={def.href(orgId)}>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-gradient-to-r from-orange-500 to-amber-400 text-white border-0 hover:from-orange-400 hover:to-amber-300"
                          >
                            {def.cta}
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                      <button
                        onClick={() => markStepDone(def.id)}
                        disabled={isMarking}
                        className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors disabled:opacity-40 flex items-center gap-0.5"
                        title="Mark as done"
                      >
                        {isMarking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">Mark done</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip link */}
        <div className="mt-8 text-center">
          <button
            onClick={skipAll}
            disabled={skipping}
            className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors inline-flex items-center gap-1 disabled:opacity-40"
          >
            {skipping ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Skip setup and go to dashboard
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
