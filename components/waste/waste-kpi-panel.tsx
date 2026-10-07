import type { WasteKpi, WasteKpiSet } from "@/lib/waste/kpis";

const n = (v: number, d = 1) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

function Tiles({ k }: { k: WasteKpi }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div><div className="text-xs text-gray-500">Waste</div><div className="text-xl font-semibold tabular-nums">{n(k.tonnes)} t</div></div>
      <div><div className="text-xs text-gray-500">Diverted from landfill</div><div className="text-xl font-semibold tabular-nums">{k.divertedPct == null ? "-" : `${n(k.divertedPct, 0)}%`}</div></div>
      <div>
        <div className="text-xs text-gray-500">Tonnes per 100k</div>
        <div className="text-xl font-semibold tabular-nums">{k.perHundredK == null ? "-" : n(k.perHundredK, 2)}</div>
        <div className="text-[11px] text-gray-500">{k.basis}</div>
      </div>
    </div>
  );
}

/** Company and per-project waste KPIs. `onlyProjectId` narrows to one project (the sidebar's choice). */
export function WasteKpiPanel({ set, onlyProjectId, orgId }: { set: WasteKpiSet; onlyProjectId?: string | null; orgId: string }) {
  const projects = onlyProjectId ? set.projects.filter((p) => p.id === onlyProjectId) : set.projects;
  if (!set.company && projects.length === 0) {
    return <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No waste records yet, so there are no waste KPIs.</p>;
  }
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      {!onlyProjectId && set.company && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Company, {set.company.label}</h3>
          <Tiles k={set.company} />
        </div>
      )}
      {projects.map((p) => (
        <div key={p.id} className="border-t border-gray-100 pt-4 first:border-0 first:pt-0">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">{p.name}</h3>
          <Tiles k={p} />
        </div>
      ))}
      {onlyProjectId && projects.length === 0 && <p className="text-sm text-gray-500">This project has no waste records yet.</p>}
      <p className="text-[11px] text-gray-500">
        Diverted means recycled, composted or sent for energy recovery. Add revenue to the reporting period or a value to the contract to get the per 100k figure.{" "}
        <a className="underline underline-offset-2" href={`/orgs/${orgId}/waste`}>Open waste</a>
      </p>
    </div>
  );
}
