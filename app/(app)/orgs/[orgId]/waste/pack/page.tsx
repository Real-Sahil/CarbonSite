export const dynamic = "force-dynamic";

import { Table } from "@/components/ui/table";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { getOrgBasics } from "@/lib/i18n/org-basics";
import { orgFormat } from "@/lib/i18n/org-format";
import { getSelectedProject } from "@/lib/project/selected";
import { loadProjectPack, MONTH, currentMonth } from "@/lib/waste/pack";
import { DISPOSAL_ROUTES } from "@/lib/waste/routes";
import { REGISTER_ATTRIBUTION } from "@/lib/waste/carrier-register";
import { PrintButton } from "./print-button";

const n = (v: number, d = 1) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function ProjectPackPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ projectId?: string; month?: string }> }) {
  const { orgId } = await params;
  const sp = await searchParams;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const projects = await prisma.project.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
  const selected = await getSelectedProject(orgId);
  const projectId = projects.find((p) => p.id === (sp.projectId ?? selected?.id))?.id ?? null;
  const month = sp.month && MONTH.test(sp.month) ? sp.month : currentMonth();
  const currency = orgFormat((await getOrgBasics(orgId)) ?? {}).currency;
  const pack = projectId ? await loadProjectPack(orgId, projectId, month, currency) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8 print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl tracking-tight text-[#131d29]">Monthly waste pack</h1>
        <p className="mt-1 text-sm text-[#5B6A78]">One project, one month, ready to send to a client: loads, KPIs, plan progress and licences to watch. Print it or save it as a PDF.</p>
        <Link href={`/orgs/${orgId}/waste`} className="mt-2 inline-block text-sm font-medium text-[#c2400c] hover:text-[#a33409]">Back to waste</Link>
        <form className="mt-4 flex flex-wrap items-end gap-3" action={`/orgs/${orgId}/waste/pack`}>
          <div><label htmlFor="pk-project" className="block text-xs text-[#5B6A78]">Project</label>
            <select id="pk-project" name="projectId" defaultValue={projectId ?? ""} className="h-9 rounded-md border border-[#E3E8EE] bg-white px-2 text-sm"><option value="" disabled>Choose</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label htmlFor="pk-month" className="block text-xs text-[#5B6A78]">Month</label>
            <input id="pk-month" name="month" type="month" defaultValue={month} className="h-9 rounded-md border border-[#E3E8EE] px-2 text-sm" /></div>
          <button className="h-9 rounded-md border border-[#E3E8EE] px-3 text-sm">Show</button>
          {pack && <PrintButton />}
        </form>
      </div>

      {!pack ? (
        <p className="rounded-xl border border-[#E3E8EE] bg-white p-8 text-center text-sm text-[#5B6A78]">{projects.length === 0 ? "Add a project first (Contracts)." : "Choose a project."}</p>
      ) : (
        <article className="space-y-6">
          <header className="border-b pb-3">
            <h2 className="text-xl font-semibold text-[#131d29]">{pack.project.name}: waste, {monthName(pack.month)}</h2>
            {pack.project.contractName && <p className="text-sm text-[#5B6A78]">{pack.project.contractName}</p>}
          </header>

          <section aria-labelledby="pk-kpi">
            <h3 id="pk-kpi" className="mb-2 text-sm font-semibold text-[#131d29]">Key figures</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pack.kpis.map((k) => (
                <div key={k.id} className="rounded-lg border border-[#E3E8EE] p-3">
                  <dt className="text-xs text-[#5B6A78]">{k.label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{k.value == null ? "-" : n(k.value, k.decimals)} {k.value != null && k.unit}</dd>
                  {k.value == null && k.needs && <dd className="text-[11px] text-[#5B6A78]">Needs {k.needs}</dd>}
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="pk-loads">
            <h3 id="pk-loads" className="mb-2 text-sm font-semibold text-[#131d29]">Loads recorded ({pack.loads.length})</h3>
            {pack.loads.length === 0 ? <p className="text-sm text-[#5B6A78]">No waste was recorded against this project this month.</p> : (
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <thead><tr className="text-left text-xs text-[#5B6A78]"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Waste</th><th className="py-1 pr-3">EWC</th><th className="py-1 pr-3 text-right">Tonnes</th><th className="py-1 pr-3">Route</th><th className="py-1">Carrier / note</th></tr></thead>
                  <tbody className="divide-y divide-[#E3E8EE]">
                    {pack.loads.map((l) => (
                      <tr key={l.id}><td className="py-1.5 pr-3 tabular-nums">{l.recordedAt.toISOString().slice(0, 10)}</td><td className="py-1.5 pr-3">{l.wasteType}{l.hazardous ? " (hazardous)" : ""}</td><td className="py-1.5 pr-3">{l.ewcCode ?? "-"}</td><td className="py-1.5 pr-3 text-right tabular-nums">{n(l.weightTonnes, 2)}</td><td className="py-1.5 pr-3">{DISPOSAL_ROUTES.find((r) => r.value === l.disposalRoute)?.label ?? l.disposalRoute}</td><td className="py-1.5">{[l.carrierName, l.transferNoteReference].filter(Boolean).join(" · ") || "-"}</td></tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>

          <section aria-labelledby="pk-plan">
            <h3 id="pk-plan" className="mb-2 text-sm font-semibold text-[#131d29]">Site Waste Management Plan</h3>
            {!pack.plan.exists ? <p className="text-sm text-[#5B6A78]">No plan has been written for this project yet.</p> : (
              <p className="text-sm text-[#41505F]">
                {pack.plan.status === "approved" ? "Approved" : "Draft"}, version {pack.plan.version}. Target {pack.plan.plan.targetDiversionPct == null ? "not set" : `${n(pack.plan.plan.targetDiversionPct, 0)}% diverted from landfill`}; so far {pack.plan.comparison.actualDiversionPct == null ? "no waste recorded" : `${n(pack.plan.comparison.actualDiversionPct, 0)}% diverted`} across {n(pack.plan.comparison.actualTotal)} t recorded against a forecast of {n(pack.plan.comparison.forecastTotal)} t.
              </p>
            )}
          </section>

          <section aria-labelledby="pk-watch">
            <h3 id="pk-watch" className="mb-2 text-sm font-semibold text-[#131d29]">Licences and permits to watch</h3>
            {pack.watch.length === 0 ? <p className="text-sm text-[#5B6A78]">None expired or expiring within 30 days.</p> : (
              <ul className="space-y-1 text-sm">
                {pack.watch.map((d) => <li key={d.id}><span className={d.state === "expired" ? "font-medium text-red-700" : "font-medium text-amber-800"}>{d.state === "expired" ? "Expired" : "Expires soon"}</span>: {d.kindLabel}, {d.issuer ?? d.title}, {d.validUntil?.toISOString().slice(0, 10)}</li>)}
              </ul>
            )}
          </section>

          {pack.registerChecks.length > 0 && (
            <section aria-labelledby="pk-reg">
              <h3 id="pk-reg" className="mb-2 text-sm font-semibold text-[#131d29]">Carrier register checks</h3>
              <ul className="space-y-1 text-sm">
                {pack.registerChecks.map((c) => <li key={`${c.title}:${c.check.registration ?? ""}:${c.check.checkedAt ?? ""}`}>{c.title}: {c.check.status === "registered" ? `on the England register${c.check.expiryDate ? `, expires ${c.check.expiryDate}` : ""}` : c.check.status === "expired" ? "registration expired" : c.check.status === "not_found" ? "not found on the England register" : "check unavailable"}{c.check.checkedAt ? ` (checked ${c.check.checkedAt.slice(0, 10)})` : ""}</li>)}
              </ul>
              <p className="mt-1 text-xs text-[#5B6A78]">{REGISTER_ATTRIBUTION}.</p>
            </section>
          )}
          <footer className="border-t pt-2 text-xs text-[#5B6A78]">Produced from the project&apos;s records in MetricOra. Figures are as recorded, not independently verified.</footer>
        </article>
      )}
    </div>
  );
}
