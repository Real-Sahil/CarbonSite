// Plant performance from telematics: hours, idling, fuel and the carbon that
// fuel represents, per machine and in total, plus a reconciliation of the
// fuel machines burnt against the fuel recorded for each site. Pure.
import { hvoShare } from "@/lib/calculation/fuels";

export type FuelFactor = { externalId: string; kgCo2ePerLitre: number; biogenicKgPerLitre: number | null };
export type PlantFactors = { diesel: FuelFactor; hvo: FuelFactor | null; library: string } | null;

export type AssetInput = { id: string; name: string; category: string | null; fuelType: string; siteId: string | null; siteName: string | null; ownership: string; autoRegistered: boolean };
export type ReadingInput = { assetId: string; operatingHours: number | null; idleHours: number | null; fuelLitres: number | null; idleFuelLitres: number | null };

export type AssetSummary = {
  asset: AssetInput;
  hours: number;
  idleHours: number;
  idleShare: number | null;
  fuelLitres: number;
  idleFuelLitres: number | null;
  litresPerHour: number | null;
  hvoShare: number;
  co2eKg: number | null;
  biogenicKg: number | null;
};

/** kgCO2e per litre for a fuel, blending HVO and diesel by volume. Null for electric or unknown factors. */
export function fuelFactor(fuelType: string, f: PlantFactors): { co2e: number; biogenic: number | null; share: number } | null {
  if (!f || /electric|battery/i.test(fuelType)) return null;
  const share = hvoShare(fuelType) ?? 0;
  if (share > 0 && !f.hvo) return null;
  const hvo = f.hvo ?? { kgCo2ePerLitre: 0, biogenicKgPerLitre: 0, externalId: "" };
  const bio = (x: FuelFactor | typeof hvo) => x.biogenicKgPerLitre ?? 0;
  return {
    co2e: share * hvo.kgCo2ePerLitre + (1 - share) * f.diesel.kgCo2ePerLitre,
    biogenic: share * bio(hvo) + (1 - share) * bio(f.diesel),
    share,
  };
}

export function summarisePlant(assets: AssetInput[], readings: ReadingInput[], factors: PlantFactors) {
  const byAsset = new Map<string, ReadingInput[]>();
  for (const r of readings) byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r]);

  const summaries: AssetSummary[] = assets.map((asset) => {
    const rs = byAsset.get(asset.id) ?? [];
    const sum = (k: keyof ReadingInput) => rs.reduce((t, r) => t + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
    const hours = sum("operatingHours");
    const idleHours = sum("idleHours");
    const fuelLitres = sum("fuelLitres");
    const hasIdleFuel = rs.some((r) => r.idleFuelLitres != null);
    const f = fuelFactor(asset.fuelType, factors);
    const electric = /electric|battery/i.test(asset.fuelType);
    return {
      asset,
      hours,
      idleHours,
      idleShare: hours > 0 ? idleHours / hours : null,
      fuelLitres,
      idleFuelLitres: hasIdleFuel ? sum("idleFuelLitres") : null,
      litresPerHour: hours > 0 && fuelLitres > 0 ? fuelLitres / hours : null,
      hvoShare: f?.share ?? 0,
      co2eKg: electric ? 0 : f ? fuelLitres * f.co2e : null,
      biogenicKg: f?.biogenic != null ? fuelLitres * f.biogenic : null,
    };
  });

  const total = (pick: (s: AssetSummary) => number | null) => summaries.reduce((t, s) => t + (pick(s) ?? 0), 0);
  const fuel = total((s) => s.fuelLitres);
  const hvoLitres = total((s) => s.fuelLitres * s.hvoShare);
  const hours = total((s) => s.hours);
  const idle = total((s) => s.idleHours);
  return {
    assets: summaries.sort((a, b) => b.fuelLitres - a.fuelLitres),
    totals: {
      hours,
      idleHours: idle,
      idleShare: hours > 0 ? idle / hours : null,
      fuelLitres: fuel,
      hvoLitres,
      hvoShare: fuel > 0 ? hvoLitres / fuel : null,
      co2eKg: total((s) => s.co2eKg),
      biogenicKg: total((s) => s.biogenicKg),
      /** Scope 1 avoided by HVO against running the same litres on diesel. */
      hvoSavingKg: factors?.hvo ? hvoLitres * (factors.diesel.kgCo2ePerLitre - factors.hvo.kgCo2ePerLitre) : 0,
      withoutFactor: summaries.filter((s) => s.co2eKg == null && s.fuelLitres > 0).map((s) => s.asset.name),
    },
  };
}

export type SiteReconciliation = { siteId: string; siteName: string; telematicsLitres: number; recordedLitres: number; gapLitres: number; gapShare: number | null };

/**
 * Fuel burnt by a site's machines (telematics) against fuel recorded for the
 * site in the inventory. More burnt than recorded usually means unrecorded
 * fuel (a missing delivery note or fuel card); more recorded than burnt is
 * normal when some plant has no telematics or fuel is still in the bowser.
 */
export function reconcileSites(
  summaries: AssetSummary[],
  recordedBySite: Map<string, number>,
  siteNames: Map<string, string>,
): SiteReconciliation[] {
  const burnt = new Map<string, number>();
  for (const s of summaries) {
    if (!s.asset.siteId || s.fuelLitres <= 0) continue;
    burnt.set(s.asset.siteId, (burnt.get(s.asset.siteId) ?? 0) + s.fuelLitres);
  }
  const ids = new Set([...burnt.keys(), ...recordedBySite.keys()]);
  return [...ids]
    .map((siteId) => {
      const telematicsLitres = burnt.get(siteId) ?? 0;
      const recordedLitres = recordedBySite.get(siteId) ?? 0;
      const gapLitres = telematicsLitres - recordedLitres;
      return {
        siteId,
        siteName: siteNames.get(siteId) ?? "Unknown site",
        telematicsLitres,
        recordedLitres,
        gapLitres,
        gapShare: recordedLitres > 0 ? gapLitres / recordedLitres : null,
      };
    })
    .sort((a, b) => b.gapLitres - a.gapLitres);
}
