// Pure data building for the dashboard's street map (components/dashboard/site-hero-tiles.tsx), kept apart from
// MapLibre so the pin sizes, selection filter and camera choice can be tested without a browser.

import { radiusFor, type SiteTotal } from "@/lib/map/site-map";

export type PlacedSite = SiteTotal & { latitude: number; longitude: number };

export type SiteFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { key: string; r: number; colour: string; label: string };
};

export type SiteCollection = { type: "FeatureCollection"; features: SiteFeature[] };

export const keyOf = (s: SiteTotal) => `${s.kind ?? "facility"}:${s.id}`;

export function buildSiteCollection(
  sites: PlacedSite[],
  formatKg: (kg: number) => string,
  colours: { site: string; facility: string },
): SiteCollection {
  const max = Math.max(1, ...sites.map((s) => s.kg));
  return {
    type: "FeatureCollection",
    features: sites.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
      properties: {
        key: keyOf(s),
        r: radiusFor(s.kg, max, 18, 6),
        colour: s.kind === "site" ? colours.site : colours.facility,
        label: `${s.name}: ${formatKg(s.kg)}`,
      },
    })),
  };
}

// Keys joined with "|" are what the component compares between renders; this turns them back into the layer filter.
export function selectedFilter(selectedKey: string) {
  return ["in", ["get", "key"], ["literal", selectedKey ? selectedKey.split("|") : []]];
}

export type Camera =
  | { kind: "none" }
  | { kind: "centre"; centre: [number, number]; zoom: number }
  | { kind: "bounds"; points: [number, number][]; padding: number; maxZoom: number };

// Several pins are fitted into view; one pin is centred at street-ish zoom; none leaves the default view.
export function cameraFor(collection: SiteCollection): Camera {
  const points = collection.features.map((f) => f.geometry.coordinates);
  if (points.length > 1) return { kind: "bounds", points, padding: 50, maxZoom: 11 };
  if (points.length === 1) return { kind: "centre", centre: points[0], zoom: 10 };
  return { kind: "none" };
}
