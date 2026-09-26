export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { catalogueSummary, loadAdoptions } from "@/lib/management-systems/load";
import type { FrameworkFamily } from "@/lib/management-systems/catalogue";
import { AdoptButton } from "./adopt-button";

const FAMILY_LABELS: Record<FrameworkFamily, string> = {
  management_system: "Management systems",
  privacy: "Privacy and data protection",
  information_security: "Information security",
  cyber: "Cyber security",
  healthcare: "Healthcare",
  payments: "Payments",
  ai: "Artificial intelligence",
};

const STATUS_LABELS: Record<string, string> = {
  implementing: "Implementing",
  certified: "Certified",
  lapsed: "Certificate lapsed",
  withdrawn: "Withdrawn",
};

export default async function ManagementSystemsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...MS_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const canEdit = (MS_EDITORS as string[]).includes(role);
  const catalogue = catalogueSummary();
  const adoptions = await loadAdoptions(orgId);
  const adoptedBySlug = new Map(adoptions.map((a) => [a.frameworkSlug, a]));
  const active = adoptions.filter((a) => a.status !== "withdrawn");
  const families = [...new Set(catalogue.map((f) => f.family))];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Management systems</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-[#6B7280]">
          Work towards ISO certification and other frameworks clause by clause. Each requirement shows what an auditor looks for, figures
          from your own records, and the evidence you have linked. Clauses shared between standards, such as internal audit and
          management review, are shown against each other so the work is done once.
        </p>
      </div>

      {active.length > 0 && (
        <section aria-labelledby="ms-adopted" className="flex flex-col gap-3">
          <h2 id="ms-adopted" className="text-sm font-semibold text-[#111827]">Your frameworks</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((a) => {
              const f = catalogue.find((c) => c.slug === a.frameworkSlug)!;
              const r = a.readiness;
              return (
                <Link
                  key={a.frameworkSlug}
                  href={`/orgs/${orgId}/management-systems/${a.frameworkSlug}`}
                  className="flex flex-col gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#FED7AA]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#111827]">{f.shortName}</p>
                      <p className="text-xs text-[#6B7280]">{f.edition}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#374151]">{STATUS_LABELS[a.status] ?? a.status}</span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-[#374151]">Implemented</span>
                      <span className="font-semibold tabular-nums text-[#111827]">{r.percent == null ? "-" : `${r.percent}%`}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
                      <div className="h-full rounded-full bg-[#c2410c]" style={{ width: `${r.percent ?? 0}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#6B7280] tabular-nums">
                      {r.implemented} implemented, {r.inProgress} in progress, {r.notStarted} not started
                      {r.notApplicable ? `, ${r.notApplicable} not applicable` : ""}
                    </p>
                    {r.implementedWithoutEvidence > 0 && (
                      <p className="mt-1 text-xs text-amber-700">{r.implementedWithoutEvidence} implemented without evidence linked</p>
                    )}
                  </div>
                  {(a.targetDate || a.certifiedUntil) && (
                    <p className="text-xs text-[#6B7280]">
                      {a.certifiedUntil ? `Certificate valid until ${a.certifiedUntil}` : `Target date ${a.targetDate}`}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {families.map((family) => (
        <section key={family} aria-labelledby={`ms-${family}`} className="flex flex-col gap-3">
          <h2 id={`ms-${family}`} className="text-sm font-semibold text-[#111827]">{FAMILY_LABELS[family]}</h2>
          <ul className="flex flex-col divide-y divide-[#E5E7EB] rounded-[14px] border border-[#E5E7EB] bg-white">
            {catalogue
              .filter((f) => f.family === family)
              .map((f) => {
                const adopted = adoptedBySlug.get(f.slug);
                const isActive = adopted && adopted.status !== "withdrawn";
                return (
                  <li key={f.slug} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-[#111827]">
                        {f.name} <span className="text-xs font-normal text-[#6B7280]">{f.edition}</span>
                      </p>
                      <p className="mt-1 max-w-[80ch] text-sm text-[#6B7280]">{f.summary}</p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        {f.requirementCount} requirements · {f.publisher}
                        {f.jurisdiction ? ` · ${f.jurisdiction}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {isActive ? (
                        <Link href={`/orgs/${orgId}/management-systems/${f.slug}`} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#111827] hover:bg-[#F9FAFB]">
                          Open
                        </Link>
                      ) : canEdit ? (
                        <AdoptButton orgId={orgId} slug={f.slug} label={adopted ? "Adopt again" : "Adopt"} />
                      ) : (
                        <Link href={`/orgs/${orgId}/management-systems/${f.slug}`} className="text-sm text-[#374151] underline underline-offset-2">
                          View requirements
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
