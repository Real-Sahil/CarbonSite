"use client";

// Dashboard hero: where the emissions are, by site, for the period on the dashboard. A pin or a row sets the site
// filter for the whole page. The Project choice stays here as the fallback for keyboards, phones and sites with no
// position. Figures are live, so they match the tiles below; the published view is on the Site map.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { fitProjection, hasPosition, radiusFor, type SiteTotal } from "@/lib/map/site-map";
import { filtersAfterPin, filtersAfterProject, pinFilter, spreadCoincident, toQuery } from "@/lib/map/site-hero";
import { SCOPE_COLORS } from "@/components/charts/palette";

const tonnes = (kg: number, locale: string) => `${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} tCO₂e`;
const FIELD = "h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-amber-400/50";

export function SiteHero({
  orgId,
  sites,
  failed,
  projects,
  filters,
  periodLabel,
  locale,
}: {
  orgId: string;
  sites: SiteTotal[];
  failed: boolean;
  projects: { id: string; label: string }[];
  filters: Record<string, string>;
  periodLabel: string;
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const placed = sites.filter(hasPosition);
  const selectedProject = filters.projectId ?? "";
  const selectedFacility = filters.facilityId ?? "";
  const active = selectedProject || selectedFacility;
  const activeLabel = selectedProject
    ? projects.find((p) => p.id === selectedProject)?.label ?? "Selected project"
    : sites.find((s) => s.id === selectedFacility)?.name ?? "Selected site";

  // The sidebar's project choice follows the dashboard, so a project change is saved as the sidebar's choice too.
  function go(next: Record<string, string>) {
    if ((next.projectId ?? "") !== selectedProject) {
      void fetch(`/api/orgs/${orgId}/selected-project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: next.projectId || null }),
      }).catch(() => null);
    }
    startTransition(() => router.replace(`${pathname}${toQuery(next)}`));
  }

  const max = Math.max(1, ...placed.map((s) => s.kg));
  const W = 720, H = 300;
  const project = placed.length ? fitProjection(placed as { latitude: number; longitude: number }[], W, H, 56) : null;
  const spots = project ? spreadCoincident(placed.map((s) => ({ ...project(s as { latitude: number; longitude: number }), site: s }))) : [];
  const top = [...sites].sort((a, b) => b.kg - a.kg).slice(0, 8);
  const unplaced = sites.length - placed.length;
  const isOn = (s: SiteTotal) => {
    const pin = pinFilter(s);
    return pin !== null && filters[pin.key] === pin.value;
  };
  const pick = (s: SiteTotal) => {
    if (!pinFilter(s)) return;
    go(filtersAfterPin(filters, s));
  };

  return (
    <section aria-labelledby="site-hero-title" className="mb-6 overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <div>
          <h2 id="site-hero-title" className="text-base font-semibold text-[#111827]">Sites</h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Live figures for {periodLabel}. Choose a site to filter the whole dashboard. Figures move as records change; the published view is on the <Link href={`/orgs/${orgId}/map`} className="underline underline-offset-2">Site map</Link>.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="site-hero-project" className="text-xs text-[#6B7280]">Choose a project</label>
          <select
            id="site-hero-project"
            className={FIELD}
            value={selectedProject}
            disabled={pending}
            onChange={(e) => go(filtersAfterProject(filters, e.target.value))}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {active ? (
        <div className="flex items-center justify-between gap-3 bg-[#FFF7ED] px-5 py-2 text-sm text-[#9a3412]">
          <span>Showing <strong className="font-semibold">{activeLabel}</strong></span>
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium underline underline-offset-2 hover:bg-white" onClick={() => go(filtersAfterProject(filters, ""))}>
            Clear
          </button>
        </div>
      ) : null}

      {failed ? (
        <p role="status" className="px-5 py-6 text-sm text-red-700">Site figures could not be loaded just now. The rest of the dashboard is unaffected.</p>
      ) : sites.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#374151]">
          No sites yet. Sites appear once they have a position or a UK postcode. <Link href={`/orgs/${orgId}/settings/operations`} className="underline underline-offset-2">Add one in Settings, Operations</Link>.
        </p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            {project ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB]" role="group" aria-label="Sites on a schematic, sized by emissions. The list beside it gives the same figures.">
                {spots.map(({ x, y, site: s }) => {
                  const r = radiusFor(s.kg, max);
                  const on = isOn(s);
                  const clickable = pinFilter(s) !== null;
                  const colour = s.kind === "site" ? SCOPE_COLORS[0] : SCOPE_COLORS[1];
                  return (
                    <g key={s.id} role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : -1} aria-pressed={clickable ? on : undefined} aria-label={`${s.name}, ${tonnes(s.kg, locale)}`} className={clickable ? "cursor-pointer outline-none focus-visible:[&>circle]:stroke-[#111827]" : undefined} onClick={() => pick(s)} onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(s); } }}>
                      <circle cx={x} cy={y} r={r} fill={colour} fillOpacity={on ? 0.85 : 0.5} stroke={on ? "#111827" : colour} strokeWidth={on ? 3 : 1.5}>
                        <title>{`${s.name}: ${tonnes(s.kg, locale)}`}</title>
                      </circle>
                      <text x={x} y={y - r - 6} textAnchor="middle" fontSize={11} fill="#374151">{s.name}</text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <p className="rounded-[10px] border border-dashed border-[#D1D5DB] p-4 text-sm text-[#374151]">
                None of your sites has a position yet, so none can be pinned. Use the list or the project choice above.
              </p>
            )}
            {project ? <p className="mt-1 text-xs text-[#6B7280]">Schematic, not to a map scale. Sites at the same place are spread out so each can be chosen.</p> : null}
          </div>

          <div>
            <ul className="divide-y divide-[#E5E7EB]" aria-label="Sites by emissions">
              {top.map((s) => {
                const clickable = pinFilter(s) !== null;
                const on = isOn(s);
                return (
                  <li key={`${s.kind}-${s.id}`}>
                    <button
                      type="button"
                      disabled={!clickable || pending}
                      aria-pressed={clickable ? on : undefined}
                      onClick={() => pick(s)}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm disabled:cursor-default ${on ? "bg-[#FFF7ED]" : "hover:bg-[#F9FAFB]"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#111827]">{s.name}</span>
                        <span className="block text-xs text-[#6B7280]">{s.kind === "site" ? "Project site" : "Office or depot"}{!clickable ? " · no project to filter by" : ""}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#111827]">{tonnes(s.kg, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {unplaced > 0 ? (
              <p className="mt-2 px-2 text-xs text-[#6B7280]">
                {unplaced} {unplaced === 1 ? "site is" : "sites are"} not on the map. <Link href={`/orgs/${orgId}/settings/operations`} className="underline underline-offset-2">Add a postcode or position</Link>.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
