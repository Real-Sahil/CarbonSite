export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { getOrgBasics } from "@/lib/i18n/org-basics";
import { orgFormat } from "@/lib/i18n/org-format";
import { SavedViewsMenu } from "@/components/saved-views/saved-views-menu";
import { mayShare, viewRoles } from "@/lib/saved-views/roles";
import { activeFilters } from "@/lib/saved-views";
import { KPIS, parseKpiIds } from "@/lib/kpis/catalogue";
import { loadKpiReport } from "@/lib/kpis/load";
import { KpiPicker } from "./kpi-picker";

const LEVEL_LABEL = { company: "Company", unit: "Business units", project: "Projects" } as const;
const n = (v: number, d: number) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

export default async function KpiReportPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ k?: string; periodId?: string }> }) {
  const { orgId } = await params;
  const sp = await searchParams;
  let role = "viewer";
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const chosen = parseKpiIds(sp.k);
  const basics = await getOrgBasics(orgId);
  const data = await loadKpiReport(orgId, orgFormat(basics ?? {}).currency, sp.periodId);
  const defs = KPIS.filter((k) => chosen.includes(k.id));
  const filters = activeFilters("kpis", { k: sp.k ? chosen.join(",") : undefined, periodId: sp.periodId });
  const blanks = defs.filter((d) => d.needs && data.rows.some((r) => d.compute(r.agg) == null && r.agg.records > 0));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl tracking-tight text-[#131d29]">KPI report</h1>
          <p className="mt-1 text-sm text-[#5B6A78]">Pick the measures you report on. The table shows the company, then each business unit and project, so you can compare them. Save the choice as a view to run it again.</p>
        </div>
        {viewRoles().includes(role as never) && <SavedViewsMenu orgId={orgId} surface="kpis" filters={filters} canShare={mayShare(role)} isAdmin={role === "admin"} />}
      </div>

      <KpiPicker chosen={chosen} periodId={data.periodId} periods={data.periods} />

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-[#E3E8EE] bg-white p-10 text-center text-sm text-[#5B6A78]">No waste records yet, so there is nothing to report. Add waste under Environment, then Waste.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E3E8EE] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Waste KPIs for {data.periodLabel}, by company, business unit and project</caption>
            <thead className="border-b border-[#E3E8EE]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6A78]">{data.periodLabel}</th>
                {defs.map((d) => (
                  <th key={d.id} scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6A78]">{d.label}{d.unit && <span className="block font-normal normal-case text-[#5B6A78]">{d.unit}</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EE]">
              {(["company", "unit", "project"] as const).map((level) => {
                const rows = data.rows.filter((r) => r.level === level);
                if (rows.length === 0) return null;
                return [
                  level !== "company" && (
                    <tr key={`h-${level}`} className="bg-[#F9FAFC]"><th colSpan={defs.length + 1} scope="colgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5B6A78]">{LEVEL_LABEL[level]}</th></tr>
                  ),
                  ...rows.map((r) => (
                    <tr key={r.key} className={level === "company" ? "font-semibold" : ""}>
                      <th scope="row" className="px-4 py-3 text-left font-medium text-[#131d29]">{r.name}</th>
                      {defs.map((d) => {
                        const v = d.compute(r.agg);
                        return <td key={d.id} className="px-4 py-3 text-right tabular-nums text-[#131d29]">{v == null ? <span title={d.needs ? `Needs ${d.needs}` : undefined} className="text-[#5B6A78]">-</span> : n(v, d.decimals)}</td>;
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {blanks.length > 0 && (
        <ul className="space-y-1 text-xs text-[#5B6A78]">
          {blanks.map((d) => <li key={d.id}>{d.label} is blank where {d.needs} is missing.</li>)}
        </ul>
      )}
      <p className="text-xs text-[#5B6A78]">Diverted means recycled, composted or sent for energy recovery. Business unit figures add up the projects under that unit&apos;s contracts.</p>
    </div>
  );
}
