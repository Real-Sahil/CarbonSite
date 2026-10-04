"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEUTRAL_SERIES_COLOR, SCOPE_COLORS } from "@/components/charts/palette";
import { fitProjection, hasPosition, radiusFor, type SiteTotal, type SnapshotRef } from "@/lib/map/site-map";

const tonnes = (kg: number, locale: string) => `${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} tCO₂e`;
const MARKER = SCOPE_COLORS[1];

/** Real map tiles, loaded only when a style is configured (see NEXT_PUBLIC_MAP_STYLE_URL). */
function TileMap({ sites, styleUrl, locale }: { sites: SiteTotal[]; styleUrl: string; locale: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [failed, setFailed] = useState(false);
  const placed = useMemo(() => sites.filter(hasPosition), [sites]);
  const features = useCallback(() => {
    const max = Math.max(1, ...placed.map((s) => s.kg));
    return {
      type: "FeatureCollection" as const,
      features: placed.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.longitude!, s.latitude!] },
        properties: { id: s.id, name: s.name, kg: s.kg, r: radiusFor(s.kg, max), label: `${s.name}: ${tonnes(s.kg, locale)}` },
      })),
    };
  }, [placed, locale]);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        map = new maplibre.Map({ container: el.current, style: styleUrl, center: [-2, 54], zoom: 4.5, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => setFailed(true));
        map.on("load", () => {
          map!.addSource("sites", { type: "geojson", data: features() });
          map!.addLayer({
            id: "sites",
            type: "circle",
            source: "sites",
            paint: { "circle-radius": ["get", "r"], "circle-color": MARKER, "circle-opacity": 0.55, "circle-stroke-color": MARKER, "circle-stroke-width": 1.5 },
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
    const src = mapRef.current?.getSource("sites") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData(features());
  }, [features]);

  if (failed) return <p role="status" className="rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The map tiles could not be loaded. The table below has the same figures.</p>;
  return <div ref={el} className="h-[420px] w-full overflow-hidden rounded-[12px] border border-[#E5E7EB]" role="img" aria-label="Map of sites sized by emissions. The table below lists the same figures." />;
}

/** No tile source: the same positions on a plain grid, with no request leaving the page. */
function Schematic({ sites, locale }: { sites: SiteTotal[]; locale: string }) {
  const placed = sites.filter(hasPosition);
  const W = 720, H = 360;
  if (placed.length === 0) return <p className="rounded-[10px] border border-[#E5E7EB] p-4 text-sm text-[#374151]">No site has a position yet. Add an address in Settings, Operations, and choose a suggestion to place it.</p>;
  const project = fitProjection(placed as { latitude: number; longitude: number }[], W, H, 64);
  const max = Math.max(1, ...placed.map((s) => s.kg));
  return (
    <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB]" role="img" aria-label="Sites placed by latitude and longitude, sized by emissions. The table below lists the same figures.">
      {placed.map((s) => {
        const { x, y } = project(s as { latitude: number; longitude: number });
        return (
          <g key={s.id}>
            <circle cx={x} cy={y} r={radiusFor(s.kg, max)} fill={MARKER} fillOpacity={0.5} stroke={MARKER} strokeWidth={1.5}>
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
  const cache = useRef(new Map<string, SiteTotal[]>([[initialSnapshotId, initialSites]]));
  const snap = snapshots[index];

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

  const total = sites.reduce((t, s) => t + s.kg, 0);
  const unplaced = sites.filter((s) => !hasPosition(s));
  return (
    <div className="space-y-4">
      {snapshots.length > 1 ? (
        <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-4">
          <label htmlFor="snapshot-scrubber" className="mb-2 block text-sm font-medium text-[#111827]">
            Published snapshot: {snap?.label} <span className="font-normal text-[#6B7280]">({new Date(snap.publishedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })})</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Earlier snapshot">‹</button>
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
            <button type="button" className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm disabled:opacity-40" disabled={index === snapshots.length - 1} onClick={() => setIndex(index + 1)} aria-label="Later snapshot">›</button>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[#6B7280]">
            <span>{snapshots[0].label}</span>
            <span>{snapshots[snapshots.length - 1].label}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#374151]">Showing {snap?.label}. Publish another period to scrub through time.</p>
      )}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {styleUrl ? <TileMap sites={sites} styleUrl={styleUrl} locale={locale} /> : <Schematic sites={sites} locale={locale} />}
      <div className="overflow-auto rounded-[14px] border border-[#E5E7EB] bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Emissions by site in {snap?.label}</caption>
          <thead>
            <tr className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
              <th scope="col" className="px-4 py-2 font-medium">Site</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">tCO₂e</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Share</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Records</th>
              <th scope="col" className="px-4 py-2 font-medium">Position</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-b border-[#F3F4F6]">
                <td className="px-4 py-2 text-[#111827]">{s.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">{(s.kg / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 text-right tabular-nums">{total > 0 ? `${((s.kg / total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%` : "-"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.recordCount}</td>
                <td className="px-4 py-2 text-[#6B7280]">{hasPosition(s) ? `${s.latitude!.toFixed(4)}, ${s.longitude!.toFixed(4)}` : "Not placed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unplaced.length > 0 ? <p className="text-xs text-[#6B7280]">{unplaced.length} {unplaced.length === 1 ? "site is" : "sites are"} not placed on the map because no address with a position has been chosen.</p> : null}
    </div>
  );
}
