"use client";

// Dashboard hero: where the emissions are, by site, for the period on the dashboard. A pin or a row sets the site
// filter for the whole page. The Project choice stays here as the fallback for keyboards, phones and sites with no
// position. Figures are live, so they match the tiles below; the published view is on the Site map.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { fitProjection, hasPosition, type SiteTotal } from "@/lib/map/site-map";
import { compareRows, filtersAfterPin, filtersAfterProject, pinFilter, spreadCoincident, toQuery, type CompareKey } from "@/lib/map/site-hero";
import { MAP_H, MAP_W, SiteHeroMap } from "@/components/dashboard/site-hero-map";
import { mapStyleUrl } from "@/lib/map/style";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SiteHeroTiles = dynamic(() => import("@/components/dashboard/site-hero-tiles").then((m) => m.SiteHeroTiles), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded-[10px] bg-[#F1F4F7] sm:h-[340px]" aria-hidden />,
});

const tonnes = (kg: number, locale: string) => `${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} tCO₂e`;
const FIELD = "h-9 w-full rounded-[10px] border border-[#CBD2D9] bg-white px-3 text-sm text-[#131d29] focus:outline-none focus:ring-2 focus:ring-[#c2400c]/40";

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
  const [tilesFailed, setTilesFailed] = useState(false);
  const [sort, setSort] = useState<{ key: CompareKey; dir: "asc" | "desc" }>({ key: "kg", dir: "desc" });
  const placed = sites.filter(hasPosition);
  const selectedProject = filters.projectId ?? "";
  const selectedFacility = filters.facilityId ?? "";
  const selectedSite = filters.siteId ?? "";
  const active = selectedProject || selectedFacility || selectedSite;
  const projectLabel = projects.find((p) => p.id === selectedProject)?.label;
  const siteName = sites.find((s) => s.kind === "site" && s.id === selectedSite)?.name ?? "Selected site";
  const activeLabel = selectedSite
    ? selectedProject && projectLabel ? `${siteName} in ${projectLabel}` : siteName
    : selectedProject
      ? projects.find((p) => p.id === selectedProject)?.label ?? "Selected project"
      : sites.find((s) => s.kind !== "site" && s.id === selectedFacility)?.name ?? "Selected site";

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

  const fmtKg = useCallback((kg: number) => tonnes(kg, locale), [locale]);
  const max = Math.max(1, ...placed.map((s) => s.kg));
  const project = placed.length ? fitProjection(placed as { latitude: number; longitude: number }[], MAP_W, MAP_H, 56) : null;
  const spots = project ? spreadCoincident(placed.map((s) => ({ ...project(s as { latitude: number; longitude: number }), site: s }))) : [];
  const top = [...sites].sort((a, b) => b.kg - a.kg).slice(0, 8);
  const unplaced = sites.length - placed.length;
  const isOn = (s: SiteTotal) => {
    const pin = pinFilter(s);
    return filters[pin.key] === pin.value;
  };
  // A project site also becomes the sidebar's project, so the two controls agree.
  const pick = (s: SiteTotal) => {
    const next = filtersAfterPin(filters, s);
    if (s.kind === "site" && s.projectId && next.siteId && !next.projectId) {
      void fetch(`/api/orgs/${orgId}/selected-project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: s.projectId }),
      }).catch(() => null);
    }
    go(next);
  };
  // Names show on the three biggest pins only; the rest give theirs on hover and in the list.
  const labelled = new Set([...placed].sort((a, b) => b.kg - a.kg).slice(0, 3).map((s) => s.id));

  return (
    <section aria-labelledby="site-hero-title" className="mb-6 overflow-hidden rounded-[14px] border border-[#CBD2D9] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#CBD2D9] px-5 py-4">
        <div>
          <h2 id="site-hero-title" className="text-base font-semibold text-[#131d29]">Sites</h2>
          <p className="mt-0.5 text-xs text-[#5B6A78]">
            {periodLabel ? `Live figures for ${periodLabel}.` : "Live figures."} Choose a site to filter the whole dashboard. Figures move as records change; the published view is on the <Link href={`/orgs/${orgId}/map`} className="underline underline-offset-2">Site map</Link>.
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-72">
          <label htmlFor="site-hero-project" className="text-xs text-[#5B6A78]">Choose a project</label>
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
        <p className="px-5 py-6 text-sm text-[#41505F]">
          No sites yet. Sites appear once they have a position or a UK postcode. <Link href={`/orgs/${orgId}/settings/operations`} className="underline underline-offset-2">Add one in Settings, Operations</Link>.
        </p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {project ? (
              tilesFailed ? (
                <SiteHeroMap spots={spots} max={max} labelled={labelled} isOn={isOn} onPick={pick} formatKg={(kg) => tonnes(kg, locale)} />
              ) : (
                <SiteHeroTiles sites={placed as (SiteTotal & { latitude: number; longitude: number })[]} styleUrl={mapStyleUrl()} isOn={isOn} onPick={pick} formatKg={fmtKg} onFail={() => setTilesFailed(true)} />
              )
            ) : (
              <p className="rounded-[10px] border border-dashed border-[#CBD2D9] p-4 text-sm text-[#41505F]">
                None of your sites has a position yet, so none can be pinned. Use the list or the project choice above.
              </p>
            )}
            {project ? (
              <p className="mt-1 text-xs text-[#5B6A78]">
                {tilesFailed
                  ? "The street map could not be loaded, so this is a schematic, not to a map scale. Drag to pan, use + and - or ctrl/cmd + scroll to zoom. Sites at the same place are spread out so each can be chosen."
                  : "Map data from OpenStreetMap contributors, tiles by OpenFreeMap. Pins are placed from each site's saved position or postcode. Use two fingers (or ctrl/cmd + scroll) to move the map; tap a pin to filter the dashboard."}
              </p>
            ) : null}
          </div>

          <div>
            <ul className="divide-y divide-[#E5E7EB]" aria-label="Sites by emissions">
              {top.map((s) => {
                const on = isOn(s);
                return (
                  <li key={`${s.kind}-${s.id}`}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={on}
                      onClick={() => pick(s)}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm disabled:cursor-default ${on ? "bg-[#FFF7ED]" : "hover:bg-[#F9FAFC]"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#131d29]">{s.name}</span>
                        <span className="block text-xs text-[#5B6A78]">{s.kind === "site" ? "Project site" : "Office or depot"}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#131d29]">{tonnes(s.kg, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {unplaced > 0 ? (
              <p className="mt-2 px-2 text-xs text-[#5B6A78]">
                {unplaced} {unplaced === 1 ? "site is" : "sites are"} not on the map. <Link href={`/orgs/${orgId}/settings/operations`} className="underline underline-offset-2">Add a postcode or position</Link>.
              </p>
            ) : null}
          </div>
        </div>
      )}
      {!failed && sites.length > 1 ? (
        <details className="border-t border-[#CBD2D9] px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium text-[#131d29]">Compare all {sites.length} sites</summary>
          <div className="mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  {([["name", "Site"], ["kg", "Emissions"], ["share", "Share of its kind"], ["recordCount", "Records"]] as [CompareKey, string][]).map(([key, label]) => (
                    <TableHead key={key} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => setSort((c) => ({ key, dir: c.key === key && c.dir === "desc" ? "asc" : "desc" }))}>
                        {label}{sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {compareRows(sites, sort.key, sort.dir).map(({ site: s, share }) => (
                  <TableRow key={`${s.kind}-${s.id}`}>
                    <TableCell>
                      <button type="button" aria-pressed={isOn(s)} disabled={pending} className="text-left font-medium hover:underline" onClick={() => pick(s)}>{s.name}</button>
                      <span className="block text-xs text-[#5B6A78]">{s.kind === "site" ? "Project site" : "Office or depot"}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{tonnes(s.kg, locale)}</TableCell>
                    <TableCell className="tabular-nums">{share == null ? "-" : `${(share * 100).toLocaleString(locale, { maximumFractionDigits: 0 })}%`}</TableCell>
                    <TableCell className="tabular-nums">{s.recordCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-[#5B6A78]">Shares are within offices and depots, or within project sites; the two kinds overlap, so they are never added together.</p>
          </div>
        </details>
      ) : null}
    </section>
  );
}
