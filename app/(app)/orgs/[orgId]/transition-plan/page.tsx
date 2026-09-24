export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadTransitionPlan } from "@/lib/transition-plan/load";
import { ACA_RATE_1_5C } from "@/lib/transition-plan";
import { PathwayChart, PlanForm, ApproveForm } from "./plan-client";

const t = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const TONE = {
  met: "bg-green-50 text-green-800 border-green-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  gap: "bg-red-50 text-red-700 border-red-200",
} as const;
const LABEL = { met: "Done", partial: "Partly", gap: "Missing" } as const;

export default async function TransitionPlanPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-sm text-red-600">You do not have access to the transition plan.</p>;
  }
  const canEdit = ROLE_GROUPS.editor.includes(role);
  const canApprove = ROLE_GROUPS.admins.includes(role);

  const view = await loadTransitionPlan(orgId);
  const { plan, base, target, points, nearTermGap, checklist, unscheduled } = view;
  const done = checklist.filter((c) => c.status === "met").length;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Transition plan</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-[#374151]">
            How you get from your base year to net zero: the target, the initiatives that deliver it, what it costs, and who
            signed it off. The numbers come from your targets, initiatives and published totals; this page adds the
            narrative ESRS E1-1 and the UK Transition Plan Taskforce ask for.
          </p>
          {plan && (
            <p className="mt-2 text-sm">
              <Link href={`/orgs/${orgId}/reports`} className="text-[#111827] underline underline-offset-2">
                Generate the PDF
              </Link>{" "}
              <span className="text-[#6B7280]">from Reports, type &ldquo;Climate transition plan&rdquo;.</span>
            </p>
          )}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            plan?.status === "approved" ? TONE.met : plan ? TONE.partial : TONE.gap
          }`}
        >
          {plan?.status === "approved" ? `Approved ${plan.approvedAt?.toISOString().slice(0, 10) ?? ""}` : plan ? "Draft" : "Not started"}
        </span>
      </div>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">Pathway</h2>
          <p className="mt-1 max-w-[70ch] text-xs text-[#6B7280]">
            {base
              ? `From ${base.source} (${base.year}, ${t(base.tco2e)} tCO2e). The 1.5°C benchmark cuts ${(ACA_RATE_1_5C * 100).toFixed(1)}% of base-year emissions a year down to a 90% cut. Planned is the base less each scheduled initiative's annual saving from the year it starts.`
              : "Set an SBTi target or an active base year to draw the pathway."}
          </p>
        </div>
        {base && points.length > 1 ? (
          <div className="px-2 py-4">
            <PathwayChart points={points} />
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-[#374151]">
            No baseline yet. <Link href={`/orgs/${orgId}/sbti`} className="underline underline-offset-2">Set an SBTi target</Link> or{" "}
            <Link href={`/orgs/${orgId}/base-year`} className="underline underline-offset-2">lock a base year</Link>.
          </p>
        )}
        {nearTermGap && (
          <div className="grid grid-cols-1 gap-4 border-t border-[#F3F4F6] px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#6B7280]">{nearTermGap.against === "target" ? "Target" : "1.5°C benchmark"} for {nearTermGap.year}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{t(nearTermGap.goal)} tCO2e</p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Planned for {nearTermGap.year}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{t(nearTermGap.planned)} tCO2e</p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Still to find</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${nearTermGap.gapTco2e > 0 ? "text-red-600" : "text-green-700"}`}>
                {nearTermGap.gapTco2e > 0 ? `${t(nearTermGap.gapTco2e)} tCO2e a year` : "None"}
              </p>
            </div>
          </div>
        )}
        {unscheduled.length > 0 && (
          <p className="border-t border-[#F3F4F6] bg-amber-50 px-5 py-3 text-sm text-amber-800">
            Not on the planned line because they have no start date: {unscheduled.map((l) => l.name).join(", ")}.{" "}
            <Link href={`/orgs/${orgId}/targets`} className="underline underline-offset-2">Schedule them</Link>
          </p>
        )}
        {target && (
          <p className="border-t border-[#F3F4F6] px-5 py-3 text-xs text-[#6B7280]">
            Target: {target.nearTermReductionPct}% by {target.nearTermYear}, {target.netZeroReductionPct}% by {target.netZeroYear} ({target.pathway}).
          </p>
        )}
      </section>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">ESRS E1-1 checklist</h2>
          <p className="mt-1 text-xs text-[#6B7280]">{done} of {checklist.length} done.</p>
        </div>
        <ul className="divide-y divide-[#F3F4F6]">
          {checklist.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <span className={`mt-0.5 w-16 shrink-0 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${TONE[c.status]}`}>{LABEL[c.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#111827]">
                  {c.label} <span className="ml-1 text-xs font-normal text-[#6B7280]">{c.code}</span>
                </p>
                <p className="mt-0.5 text-sm text-[#374151]">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">The plan</h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            {plan?.status === "approved" ? "Saving changes returns the plan to draft until it is approved again." : "Save as you go; approval comes last."}
          </p>
        </div>
        <PlanForm orgId={orgId} canEdit={canEdit} plan={plan} currency={view.currency} />
      </section>

      {canApprove && plan && (
        <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#F3F4F6] px-5 py-4">
            <h2 className="text-base font-semibold text-[#111827]">Record approval</h2>
            <p className="mt-1 max-w-[65ch] text-xs text-[#6B7280]">
              Once the board (or the equivalent body) has approved this version, record who approved it and when.
            </p>
          </div>
          <ApproveForm orgId={orgId} defaultBody={plan.approvalBody} />
        </section>
      )}
    </div>
  );
}
