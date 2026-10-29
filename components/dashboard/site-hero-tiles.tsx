"use client";

// Dashboard hero map on real OpenStreetMap tiles (OpenFreeMap style via MapLibre). Pins are sized by emissions;
// a click or tap picks the site, exactly as on the schematic. If the style cannot load, `onFail` lets the hero fall
// back to the schematic so the pins are never lost.

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { SCOPE_COLORS } from "@/components/charts/palette";
import type { SiteTotal } from "@/lib/map/site-map";
import { buildSiteCollection, cameraFor, keyOf, selectedFilter, type PlacedSite as Placed } from "@/lib/map/tiles-data";

export function SiteHeroTiles({
  sites,
  styleUrl,
  isOn,
  onPick,
  formatKg,
  onFail,
}: {
  sites: Placed[];
  styleUrl: string;
  isOn: (s: SiteTotal) => boolean;
  onPick: (s: SiteTotal) => void;
  formatKg: (kg: number) => string;
  onFail: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const byKey = useMemo(() => new Map(sites.map((s) => [keyOf(s), s])), [sites]);
  const selected = sites.filter(isOn).map(keyOf);
  const selectedKey = selected.join("|");

  // The map is built once; handlers and data are read through refs so a filter change does not rebuild it.
  const live = useRef({ byKey, onPick, onFail, formatKg });
  useEffect(() => {
    live.current = { byKey, onPick, onFail, formatKg };
  });

  const data = useMemo(() => buildSiteCollection(sites, formatKg, { site: SCOPE_COLORS[0], facility: SCOPE_COLORS[1] }), [sites, formatKg]);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
    (mapRef.current?.getSource("sites") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(data);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let map: import("maplibre-gl").Map | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        // Cooperative gestures: one finger scrolls the page, two fingers (or ctrl/cmd + wheel) move the map.
        map = new maplibre.Map({ container: el.current, style: styleUrl, center: [-2, 54], zoom: 4.5, cooperativeGestures: true, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {
          if (!loaded) live.current.onFail();
        });
        map.on("load", () => {
          loaded = true;
          map!.addSource("sites", { type: "geojson", data: dataRef.current });
          map!.addLayer({
            id: "sites",
            type: "circle",
            source: "sites",
            paint: { "circle-radius": ["get", "r"], "circle-color": ["get", "colour"], "circle-opacity": 0.7, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 1.5 },
          });
          map!.addLayer({
            id: "sites-selected",
            type: "circle",
            source: "sites",
            filter: selectedFilter(selectedKey) as import("maplibre-gl").FilterSpecification,
            paint: { "circle-radius": ["+", ["get", "r"], 4], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#111827", "circle-stroke-width": 2.5 },
          });
          map!.on("click", "sites", (e) => {
            const site = live.current.byKey.get(String(e.features?.[0]?.properties?.key));
            if (site) live.current.onPick(site);
          });
          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false });
          map!.on("mousemove", "sites", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            map!.getCanvas().style.cursor = "pointer";
            popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setText(String(f.properties?.label)).addTo(map!);
          });
          map!.on("mouseleave", "sites", () => {
            map!.getCanvas().style.cursor = "";
            popup.remove();
          });
          const cam = cameraFor(dataRef.current);
          if (cam.kind === "bounds") {
            const b = new maplibre.LngLatBounds();
            cam.points.forEach((p) => b.extend(p));
            map!.fitBounds(b, { padding: cam.padding, maxZoom: cam.maxZoom, duration: 0 });
          } else if (cam.kind === "centre") map!.jumpTo({ center: cam.centre, zoom: cam.zoom });
        });
      } catch {
        live.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Built once per style; selection and data have their own effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("sites-selected")) return;
    map.setFilter("sites-selected", selectedFilter(selectedKey) as import("maplibre-gl").FilterSpecification);
  }, [selectedKey]);

  return <div ref={el} className="h-[300px] w-full overflow-hidden rounded-[10px] border border-[#CBD2D9] sm:h-[340px]" role="img" aria-label="Map of sites sized by emissions. The list beside it has the same figures and can also be used to choose a site." />;
}
