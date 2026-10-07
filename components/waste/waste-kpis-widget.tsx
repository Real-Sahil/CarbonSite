import { loadWasteKpis } from "@/lib/waste/kpis";
import { getOrgBasics } from "@/lib/i18n/org-basics";
import { orgFormat } from "@/lib/i18n/org-format";
import { getSelectedProject } from "@/lib/project/selected";
import { WasteKpiPanel } from "./waste-kpi-panel";

/** Dashboard widget: waste KPIs for the company, or for the project picked in the sidebar. */
export async function WasteKpisWidget({ orgId }: { orgId: string }) {
  const [basics, project] = await Promise.all([getOrgBasics(orgId), getSelectedProject(orgId)]);
  const set = await loadWasteKpis(orgId, orgFormat(basics ?? {}).currency);
  return (
    <section aria-label="Waste KPIs" className="mt-8">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">Waste KPIs</p>
      <WasteKpiPanel set={set} onlyProjectId={project?.id ?? null} orgId={orgId} />
    </section>
  );
}
