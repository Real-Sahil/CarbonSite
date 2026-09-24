// Heat and cooling networks. ADEME publishes one factor per named network
// (activityType heat_network / cooling_network) beside national defaults for
// "other networks" (purchased_heat / district_cooling). Hundreds of network
// rows would otherwise tie on every score and fall to the id tie-break, so a
// network factor is only used when the record names it (in its fuel type /
// detail field: the network name as ADEME gives it, or "ADEME <id>"). Every
// other heat record uses the default.

import type { EmissionFactor } from "@prisma/client";

const NETWORK = /^(heat|cooling)_network$/;
export const isNetworkFactor = (f: Pick<EmissionFactor, "activityType">) => NETWORK.test(f.activityType ?? "");

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The network name a factor's notes carry: `Heat network "<name>" (...)`. */
export function networkName(f: Pick<EmissionFactor, "usageNotes">): string | null {
  return (f.usageNotes ?? "").match(/network "(.+?)" \(/)?.[1] ?? null;
}

export type NetworkPick<T> = { kind: "matched"; factor: T } | { kind: "rest"; candidates: T[] };

/**
 * The named network the record's hint points at, or the candidates without
 * any network rows. A hint mentioning cooling ("froid", "cool") prefers the
 * cooling network of that name when a heat network shares it.
 */
export function pickHeatNetwork<T extends Pick<EmissionFactor, "activityType" | "usageNotes" | "externalId">>(
  candidates: T[],
  hint: string | null | undefined,
): NetworkPick<T> {
  const networks = candidates.filter(isNetworkFactor);
  if (!networks.length) return { kind: "rest", candidates };
  const rest = candidates.filter((f) => !isNetworkFactor(f));
  const h = fold(hint ?? "");
  if (!h) return { kind: "rest", candidates: rest };
  const byId = h.match(/\bademe (\d+)\b/)?.[1];
  const named = networks.filter((f) =>
    byId ? f.externalId === `ademe-${byId}` : (networkName(f) != null && fold(networkName(f)!) === h.replace(/\b(froid|cooling|cool)\b/g, "").trim()),
  );
  if (!named.length) return { kind: "rest", candidates: rest };
  const wantsCooling = /\b(froid|cooling|cool)\b/.test(h);
  const chosen = named.find((f) => (f.activityType === "cooling_network") === wantsCooling) ?? named[0];
  return { kind: "matched", factor: chosen };
}
