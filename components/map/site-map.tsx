"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEUTRAL_SERIES_COLOR, SCOPE_COLORS } from "@/components/charts/palette";
import { fitProjection, hasPosition, radiusFor, type SiteTotal, type SnapshotRef } from "@/lib/map/site-map";

const tonnes = (kg: number, locale: string) => `${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} tCO₂e`;
const MARKER = SCOPE_COLORS[1]; // offices and depots
const SITE_MARKER = SCOPE_COLORS[0]; // project sites
const colourOf = (s: SiteTotal) => (s.kind === "site" ? SITE_MARKER : MARKER);
const kindLabel = (s: SiteTotal) => (s.kind === "site" ? "Project site" : "Office or depot");

/** Real map tiles, loaded only when a style is configured (see NEXT_PUBLIC_MAP_STYLE_URL). */
type Me = { latitude: number; longitude: number };

function TileMap({ sites, styleUrl, locale, selectedId, locateKey, me, onSelect }: { sites: SiteTotal[]; styleUrl: string; locale: string; selectedId: string | null; locateKey: number; me: Me | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [failed, setFailed] = useState(false);
  const placed = useMemo(() => sites.filter(hasPosition), [sites]);
  // The map is built once, so it reads the latest selection and handler through refs.
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    selectedRef.current = selectedId;
    onSelectRef.current = onSelect;
  });
  const features = useCallback(() => {
    const max = Math.max(1, ...placed.map((s) => s.kg));
    return {
      type: "FeatureCollection" as const,
      features: placed.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.longitude!, s.latitude!] },
        properties: { id: s.id, name: s.name, kg: s.kg, r: radiusFor(s.kg, max), colour: colourOf(s), label: `${s.name}: ${tonnes(s.kg, locale)}` },
      })),
    };
  }, [placed, locale]);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let map: import("maplibre-gl").Map | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        map = new maplibre.Map({ container: el.current, style: styleUrl, center: [-2, 54], zoom: 4.5, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        // Only a style that never loaded counts as failed. A later error is one tile or sprite, and must not take the map away.
        map.on("error", () => { if (!loaded) setFailed(true); });
        map.on("load", () => {
          loaded = true;
          map!.addSource("sites", { type: "geojson", data: features() });
          map!.addLayer({
            id: "sites",
            type: "circle",
            source: "sites",
            paint: { "circle-radius": ["get", "r"], "circle-color": ["get", "colour"], "circle-opacity": 0.6, "circle-stroke-color": ["get", "colour"], "circle-stroke-width": 1.5 },
          });
          // The chosen pin gets a dark ring so it can be found among the others.
          map!.addLayer({
            id: "sites-selected",
            type: "circle",
            source: "sites",
            filter: ["==", ["get", "id"], selectedRef.current ?? ""],
            paint: { "circle-radius": ["+", ["get", "r"], 4], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#111827", "circle-stroke-width": 2.5 },
          });
          map!.on("click", "sites", (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (id) onSelectRef.current(String(id));
          });
          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false });
          map!.on("mousemove", "sites", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            map!.getCanvas().style.cursor = "pointer";
            popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setText(String(f.properties?.label)).addTo(map!);
          });
          map!.on("mouseleave", "sites", () => { map!.getCanvas().style.cursor = ""; popup.remove(); });
          if (placed.length > 1) {
            const b = new maplibre.LngLatBounds();
            placed.forEach((s) => b.extend([s.longitude!, s.latitude!]));
            map!.fitBounds(b, { padding: 60, maxZoom: 9, duration: 0 });
          } else if (placed.length === 1) map!.jumpTo({ center: [placed[0].longitude!, placed[0].latitude!], zoom: 8 });
        });
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is built once per style; data changes go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("sites-selected")) return;
    map.setFilter("sites-selected", ["==", ["get", "id"], selectedId ?? ""]);
    const hit = placed.find((s) => s.id === selectedId);
    if (hit) map.flyTo({ center: [hit.longitude, hit.latitude], zoom: Math.max(map.getZoom(), 9), duration: 600 });
    // locateKey changes on every Locate press, so pressing Locate on the selected site flies there again.
  }, [selectedId, placed, locateKey]);

  useEffect(() => {
    const src = mapRef.current?.getSource("sites") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData(features());
  }, [features]);

  // Locate me: a blue dot at the viewer's position, then fly there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    const place = () => {
      const data = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [me.longitude, me.latitude] }, properties: {} }] };
      const src = map.getSource("me") as import("maplibre-gl").GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        map.addSource("me", { type: "geojson", data });
        map.addLayer({ id: "me", type: "circle", source: "me", paint: { "circle-radius": 7, "circle-color": "#2563EB", "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2 } });
      }
      map.flyTo({ center: [me.longitude, me.latitude], zoom: Math.max(map.getZoom(), 10), duration: 600 });
    };
    if (map.isStyleLoaded()) place();
    else map.once("load", place);
  }, [me]);

  // The container stays mounted even when tiles fail, so the map never disappears from the page.
  return (
    <div>
      {failed ? <p role="status" className="mb-2 rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The map tiles could not be loaded. The table below has the same figures.</p> : null}
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-[12px] border border-[#E3E8EE]" role="img" aria-label="Map of sites sized by emissions. The table below lists the same figures." />
    </div>
  );
}

/** No tile source: the same positions on a plain grid, with no request leaving the page. */
function Schematic({ sites, locale, selectedId, onSelect }: { sites: SiteTotal[]; locale: string; selectedId: string | null; onSelect: (id: string) => void }) {
  const placed = sites.filter(hasPosition);
  const W = 720, H = 360;
  // Keep the map frame when nothing is placed yet, so the page still reads as a map and says where to add a pin.
  if (placed.length === 0)
    return (
      <div role="img" aria-label="Site map with no positioned sites yet" className="flex aspect-[2/1] w-full items-center justify-center rounded-[12px] border border-dashed border-[#D1D5DB] bg-[#F9FAFC] bg-[linear-gradient(#E5E7EB_1px,transparent_1px),linear-gradient(90deg,#E5E7EB_1px,transparent_1px)] bg-[length:40px_40px] p-6 text-center">
        <p className="max-w-md rounded-[10px] bg-white/90 px-4 py-3 text-sm text-[#41505F] shadow-sm">No site has a position yet. Add an address in Settings, Operations, and choose a suggestion to place it.</p>
      </div>
    );
  const project = fitProjection(placed as { latitude: number; longitude: number }[], W, H, 64);
  const max = Math.max(1, ...placed.map((s) => s.kg));
  return (
    <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-[12px] border border-[#E3E8EE] bg-[#F9FAFC]" role="img" aria-label="Sites placed by latitude and longitude, sized by emissions. The table below lists the same figures.">
      {placed.map((s) => {
        const { x, y } = project(s as { latitude: number; longitude: number });
        return (
          <g key={s.id} tabIndex={0} role="button" aria-label={`${s.name}, ${tonnes(s.kg, locale)}. Show details`} className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-[#111827]" onClick={() => onSelect(s.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.id); } }}>
            <circle cx={x} cy={y} r={radiusFor(s.kg, max)} fill={colourOf(s)} fillOpacity={0.55} stroke={s.id === selectedId ? "#111827" : colourOf(s)} strokeWidth={s.id === selectedId ? 3 : 1.5}>
              <title>{`${s.name}: ${tonnes(s.kg, locale)}`}</title>
            </circle>
            <text x={x} y={y - radiusFor(s.kg, max) - 6} textAnchor="middle" fontSize={11} fill="#374151">{s.name}</text>
          </g>
        );
      })}
    </svg>
    <p className="mt-1 text-xs" style={{ color: NEUTRAL_SERIES_COLOR }}>Schematic, not to a map scale. Set NEXT_PUBLIC_MAP_STYLE_URL for a street map.</p>
    </div>
  );
}

/**
 * Sites sized by their emissions in one published snapshot, with a scrubber
 * across the snapshots and a table that always carries the same figures.
 */
export function SiteMap({
  orgId,
  snapshots,
  initialSnapshotId,
  initialSites,
  styleUrl,
  locale,
}: {
  orgId: string;
  snapshots: SnapshotRef[];
  initialSnapshotId: string;
  initialSites: SiteTotal[];
  styleUrl: string | null;
  locale: string;
}) {
  const [index, setIndex] = useState(Math.max(0, snapshots.findIndex((s) => s.id === initialSnapshotId)));
  const [sites, setSites] = useState(initialSites);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locateKey, setLocateKey] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const cache = useRef(new Map<string, SiteTotal[]>([[initialSnapshotId, initialSites]]));
  const mapSection = useRef<HTMLDivElement>(null);
  const snap = snapshots[index];

  // Locate: select the site, bring the map into view and fly to its pin (TileMap reads locateKey).
  const locate = (id: string) => {
    setSelectedId(id);
    setLocateKey((k) => k + 1);
    mapSection.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Locate me: ask the browser once for the viewer's position. Nothing is sent to the server.
  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("This browser cannot share a location.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setMe({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        mapSection.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED
          ? "Location access is blocked for this site. Allow it in the browser's site settings, then press Locate me again."
          : "Could not find your location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    if (!snap) return;
    const hit = cache.current.get(snap.id);
    if (hit) { setSites(hit); setError(null); return; }
    let cancelled = false;
    fetch(`/api/orgs/${orgId}/map-data?snapshotId=${encodeURIComponent(snap.id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { sites: SiteTotal[] }) : Promise.reject(new Error("Could not load this snapshot."))))
      .then((b) => { if (cancelled) return; cache.current.set(snap.id, b.sites); setSites(b.sites); setError(null); })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [snap, orgId]);

  const placedCount = sites.filter(hasPosition).length;
  const unplaced = sites.filter((s) => !hasPosition(s));
  const selected = sites.find((s) => s.id === selectedId) ?? null;
  // A share is a share of its own kind: an office and the project site it serves count the same tonnes twice if added.
  const totalOf = (kind: "facility" | "site") => sites.filter((s) => (s.kind ?? "facility") === kind).reduce((t, s) => t + s.kg, 0);
  const groups = (["facility", "site"] as const)
    .map((kind) => ({ kind, label: kind === "site" ? "Project sites" : "Offices and depots", rows: sites.filter((s) => (s.kind ?? "facility") === kind), total: totalOf(kind) }))
    .filter((g) => g.rows.length > 0);
  const hasSites = sites.some((s) => s.kind === "site");
  return (
    <div className="space-y-4">
      {snapshots.length > 1 ? (
        <div className="rounded-[14px] border border-[#E3E8EE] bg-white p-4">
          <label htmlFor="snapshot-scrubber" className="mb-2 block text-sm font-medium text-[#131d29]">
            Published snapshot: {snap?.label} <span className="font-normal text-[#5B6A78]">({new Date(snap.publishedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })})</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md border border-[#E3E8EE] px-2 py-1 text-sm disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Earlier snapshot">‹</button>
            <input
              id="snapshot-scrubber"
              type="range"
              min={0}
              max={snapshots.length - 1}
              step={1}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              aria-valuetext={snap?.label}
              className="w-full"
            />
            <button type="button" className="rounded-md border border-[#E3E8EE] px-2 py-1 text-sm disabled:opacity-40" disabled={index === snapshots.length - 1} onClick={() => setIndex(index + 1)} aria-label="Later snapshot">›</button>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[#5B6A78]">
            <span>{snapshots[0].label}</span>
            <span>{snapshots[snapshots.length - 1].label}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#41505F]">Showing {snap?.label}. Publish another period to scrub through time.</p>
      )}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      {sites.length > 0 && placedCount < sites.length ? (
        <div role="status" className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong className="font-semibold">{placedCount} of {sites.length} locations are on the map.</strong>{" "}
          {unplaced.length} {unplaced.length === 1 ? "has" : "have"} no position yet. A project site is placed from its UK postcode; an office or depot from the address chosen in{" "}
          <Link href={`/orgs/${orgId}/settings/operations`} className="font-medium underline underline-offset-2">Settings, Operations</Link>
          {" "}or its postcode. Add one to see its pin.
        </div>
      ) : null}

      <div ref={mapSection} className="scroll-mt-6 space-y-2">
        {styleUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={locateMe} disabled={locating} className="rounded-lg border border-[#E3E8EE] bg-white px-3 py-1.5 text-sm font-medium text-[#131d29] hover:bg-[#F9FAFC] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c2410c]">
              {locating ? "Finding you..." : "Locate me"}
            </button>
            {me ? <span className="text-xs text-[#5B6A78]">Blue dot: your position when you pressed Locate me.</span> : null}
            {geoError ? <span role="status" className="text-sm text-red-700">{geoError}</span> : null}
          </div>
        ) : null}
        {styleUrl ? <TileMap sites={sites} styleUrl={styleUrl} locale={locale} selectedId={selectedId} locateKey={locateKey} me={me} onSelect={setSelectedId} /> : <Schematic sites={sites} locale={locale} selectedId={selectedId} onSelect={setSelectedId} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#41505F]" aria-label="Map key">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: MARKER, opacity: 0.7 }} aria-hidden="true" />Offices and depots</span>
        {hasSites ? <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: SITE_MARKER, opacity: 0.7 }} aria-hidden="true" />Project sites</span> : null}
        <span className="text-[#5B6A78]">Bigger pin, more emissions. Click a pin or a row to see its details.</span>
      </div>

      {selected ? (
        <section aria-live="polite" aria-label={`Details for ${selected.name}`} className="rounded-[14px] border border-[#E3E8EE] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#5B6A78]">{kindLabel(selected)}{selected.detail ? ` · ${selected.detail}` : ""}</p>
              <h2 className="mt-0.5 text-lg font-semibold text-[#131d29]">{selected.name}</h2>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-md border border-[#E3E8EE] px-2 py-1 text-xs text-[#41505F] hover:bg-[#F9FAFC]">Close</button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-[#5B6A78]">Emissions</dt><dd className="font-semibold tabular-nums text-[#131d29]">{tonnes(selected.kg, locale)}</dd></div>
            <div><dt className="text-xs text-[#5B6A78]">Share of {selected.kind === "site" ? "project sites" : "offices and depots"}</dt><dd className="font-semibold tabular-nums text-[#131d29]">{totalOf(selected.kind ?? "facility") > 0 ? `${((selected.kg / totalOf(selected.kind ?? "facility")) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%` : "-"}</dd></div>
            <div><dt className="text-xs text-[#5B6A78]">Records</dt><dd className="font-semibold tabular-nums text-[#131d29]">{selected.recordCount}</dd></div>
            <div><dt className="text-xs text-[#5B6A78]">Position</dt><dd className="text-[#131d29]">{hasPosition(selected) ? `${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}` : "Not placed"}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href={selected.kind === "site" ? `/orgs/${orgId}/dashboard?projectId=${selected.projectId ?? ""}` : `/orgs/${orgId}/dashboard?facilityId=${selected.id}`} className="rounded-lg bg-[#c2410c] px-3 py-1.5 font-medium text-white hover:bg-[#9a3412]">Open on the dashboard</Link>
            {selected.kind !== "site" ? <Link href={`/orgs/${orgId}/records?facilityId=${selected.id}`} className="rounded-lg border border-[#E3E8EE] px-3 py-1.5 font-medium text-[#41505F] hover:bg-[#F9FAFC]">See its records</Link> : null}
            {!hasPosition(selected) ? <Link href={selected.kind === "site" ? `/orgs/${orgId}/contracts` : `/orgs/${orgId}/settings/operations`} className="rounded-lg border border-[#E3E8EE] px-3 py-1.5 font-medium text-[#41505F] hover:bg-[#F9FAFC]">Add its location</Link> : null}
          </div>
        </section>
      ) : null}

      {groups.map((g) => (
        <div key={g.kind} className="overflow-auto rounded-[14px] border border-[#E3E8EE] bg-white">
          <table className="w-full text-left text-sm">
            <caption className="border-b border-[#E3E8EE] px-4 py-2 text-left text-sm font-semibold text-[#131d29]">{g.label} <span className="font-normal text-[#5B6A78]">in {snap?.label}</span></caption>
            <thead>
              <tr className="border-b border-[#E3E8EE] text-xs text-[#5B6A78]">
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">tCO₂e</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Share</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Records</th>
                <th scope="col" className="px-4 py-2 font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((s) => (
                <tr key={s.id} className={`border-b border-[#F3F4F6] ${s.id === selectedId ? "bg-orange-50/60" : ""}`}>
                  <td className="px-4 py-2 text-[#131d29]">
                    <button type="button" onClick={() => setSelectedId(s.id)} aria-pressed={s.id === selectedId} className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c2410c]">{s.name}</button>
                    {s.detail ? <span className="block text-xs text-[#5B6A78]">{s.detail}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{(s.kg / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{g.total > 0 ? `${((s.kg / g.total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%` : "-"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.recordCount}</td>
                  <td className="px-4 py-2 text-[#5B6A78]">
                    {hasPosition(s) ? (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="tabular-nums">{`${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`}</span>
                        <button type="button" onClick={() => locate(s.id)} aria-label={`Locate ${s.name} on the map`} className="rounded-md border border-[#E3E8EE] px-2 py-0.5 text-xs font-medium text-[#41505F] hover:bg-[#F9FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c2410c]">Locate</button>
                      </span>
                    ) : "Not placed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
