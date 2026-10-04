// Suggests an eGRID subregion for a site from its position: the subregions of
// the five nearest eGRID2023 power plants. EPA's own tool looks a ZIP code up
// (Power Profiler); this is a suggestion for a site that has coordinates, and
// the person confirms it. Subregions follow grid operation, not state lines, so
// near a boundary the nearest plants disagree and no subregion is suggested.

import data from "@/lib/factors/data/egrid-plants-2023.json";

export type PlantData = { subs: string[]; plants: [number, number, number][] };
export type SubregionSuggestion =
  | { kind: "suggested"; code: string; agree: number; of: number; nearestKm: number }
  | { kind: "unsure"; candidates: string[]; nearestKm: number }
  | { kind: "none" };

const EARTH_KM = 6371;
const K = 5;
const MIN_AGREE = 4;
const MAX_KM = 100;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

export function suggestSubregion(lat: number, lon: number, plantData: PlantData = data as unknown as PlantData): SubregionSuggestion {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { kind: "none" };
  const near = plantData.plants
    .map(([plat, plon, idx]) => ({ km: distanceKm(lat, lon, plat, plon), sub: plantData.subs[idx] }))
    .sort((a, b) => a.km - b.km)
    .slice(0, K);
  if (!near.length || near[0].km > MAX_KM) return { kind: "none" };
  const votes = new Map<string, number>();
  for (const n of near) votes.set(n.sub, (votes.get(n.sub) ?? 0) + 1);
  const [code, agree] = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const nearestKm = Math.round(near[0].km);
  if (agree >= MIN_AGREE) return { kind: "suggested", code, agree, of: near.length, nearestKm };
  return { kind: "unsure", candidates: [...votes.keys()].sort(), nearestKm };
}
