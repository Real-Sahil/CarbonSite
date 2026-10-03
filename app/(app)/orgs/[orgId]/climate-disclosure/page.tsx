export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadClimateDisclosure } from "@/lib/climate-disclosure/load";
import { PILLARS, coverage, mayClaimConsistency } from "@/lib/climate-disclosure";
import { ApproveForm, DisclosureForm } from "./disclosure-client";
import { RiskRegister } from "./risk-register";

const TONE = {
  met: "bg-green-50 text-green-800 border-green-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  gap: "bg-red-50 text-red-700 border-red-200",
} as const;
const LABEL = { met: "Done", partial: "Partly", gap: "Missing" } as const;

export default async function ClimateDisclosurePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-sm text-red-600">You do not have access to the climate disclosure.</p>;
  }
  const canEdit = ROLE_GROUPS.editor.includes(role);
  const canApprove = ROLE_GROUPS.admins.includes(role);

  const view = await loadClimateDisclosure(orgId);
  const approved = view.status === "approved" && view.approvedAt != null;
  const cov = coverage(view.checklist);
  const consistent = mayClaimConsistency(view.checklist, approved);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Climate disclosure</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-[#374151]">
            Governance, strategy, risk management, and metrics and targets, in the structure of the TCFD recommendations
            (which IFRS S2 builds on). You write the narrative and keep the risk register; emissions and targets come from your
            published totals. Whether a disclosure is required, and in what form, depends on where you operate.
          </p>
          {view.exists && (
            <p className="mt-2 text-sm">
              <Link href={`/orgs/${orgId}/reports`} className="text-[#111827] underline underline-offset-2">Generate the PDF</Link>{" "}
              <span className="text-[#6B7280]">from Reports, type &ldquo;Climate disclosure&rdquo;.</span>
            </p>
          )}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${approved ? TONE.met : view.exists ? TONE.partial : TONE.gap}`}>
          {approved ? `Approved ${view.approvedAt!.toISOString().slice(0, 10)}` : view.exists ? "Draft" : "Not started"}
        </span>
      </div>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">The eleven recommended disclosures</h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            {cov.met} of {cov.total} done.{" "}
            {consistent
              ? "All are done and the statement is approved, so the PDF states that it is consistent with the recommendations."
              : "The PDF claims consistency only when all are done and the board has approved this version."}
          </p>
        </div>
        {PILLARS.map((p) => (
          <div key={p.value}>
            <p className="bg-[#F9FAFB] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{p.label}</p>
            <ul className="divide-y divide-[#F3F4F6]">
              {view.checklist.filter((c) => c.pillar === p.value).map((c) => (
                <li key={c.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <span className={`mt-0.5 w-16 shrink-0 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${TONE[c.status]}`}>{LABEL[c.status]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827]">{c.label} <span className="ml-1 text-xs font-normal text-[#6B7280]">{c.code}</span></p>
                    <p className="mt-0.5 text-sm text-[#374151]">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">Risk and opportunity register</h2>
          <p className="mt-1 max-w-[70ch] text-xs text-[#6B7280]">
            Score each from 1 to 5 for likelihood and for impact, before and after your response. The score is the product: up to 4 low, up to 9 medium, up to 15 high, above that very high.
          </p>
        </div>
        <RiskRegister orgId={orgId} canEdit={canEdit} risks={view.risks} />
      </section>

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111827]">The statement</h2>
        </div>
        <DisclosureForm orgId={orgId} canEdit={canEdit} sections={view.sections} approved={approved} />
      </section>

      {canApprove && view.exists && (
        <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#F3F4F6] px-5 py-4">
            <h2 className="text-base font-semibold text-[#111827]">Record approval</h2>
            <p className="mt-1 max-w-[65ch] text-xs text-[#6B7280]">
              Once the board (or the equivalent body) has approved this version, record who approved it and when.
            </p>
          </div>
          <ApproveForm orgId={orgId} defaultBody={view.approvalBody} />
        </section>
      )}
    </div>
  );
}
