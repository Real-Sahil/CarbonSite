// Fuel stores, deliveries, issues and dips rolled up for one month. Pure.
// Convention: a dip is the level at the end of its day, after that day's
// deliveries and issues. Receipts and bills stay the inventory; these figures
// allocate fuel to stores, machines and sites and check that they agree.

/** A gap is flagged above this share of the litres issued in the window, and never for less than the floor. */
export const VARIANCE_FLAG_SHARE = 0.02;
export const VARIANCE_FLAG_MIN_LITRES = 20;

export type StoreIn = { id: string; name: string; kind: string; fuelType: string; capacityLitres: number; siteId: string | null; siteName: string | null; ownership: string; active: boolean };
export type DeliveryIn = { storeId: string; on: Date; fuelType: string; litres: number };
export type IssueIn = { storeId: string; on: Date; litres: number; plantAssetId: string | null; vehicleLabel: string | null };
export type DipIn = { storeId: string; on: Date; litres: number };

export type StoreSummary = {
  store: StoreIn;
  inByType: Record<string, number>;
  litresIn: number;
  litresOut: number;
  /** Last dip on or before the month's end, with its date. */
  lastDip: { on: Date; litres: number } | null;
  /** Level expected on the last dip's date from the previous dip and the movements since; null without two dips to span. */
  expected: number | null;
  /** Measured minus expected: negative is fuel unaccounted for. */
  variance: number | null;
  flagged: boolean;
  overCapacity: boolean;
};

const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

export function summariseStores(stores: StoreIn[], deliveries: DeliveryIn[], issues: IssueIn[], dips: DipIn[], from: Date, to: Date): StoreSummary[] {
  return stores.map((store) => {
    const inMonth = (d: Date) => d >= from && d < to;
    const ds = deliveries.filter((d) => d.storeId === store.id);
    const is = issues.filter((i) => i.storeId === store.id);
    const dp = dips.filter((p) => p.storeId === store.id).sort((a, b) => a.on.getTime() - b.on.getTime());

    const monthDeliveries = ds.filter((d) => inMonth(d.on));
    const inByType: Record<string, number> = {};
    for (const d of monthDeliveries) inByType[d.fuelType] = (inByType[d.fuelType] ?? 0) + d.litres;
    const litresOut = sum(is.filter((i) => inMonth(i.on)).map((i) => i.litres));

    const last = [...dp].reverse().find((p) => p.on < to) ?? null;
    // Baseline: the dip before the last one in the window (it may fall before the month started).
    const baseline = last ? [...dp].reverse().find((p) => p.on < last.on) ?? null : null;
    let expected: number | null = null;
    let variance: number | null = null;
    let flagged = false;
    if (last && baseline && last.on >= from) {
      const between = (d: Date) => d > baseline.on && d <= last.on;
      const issued = sum(is.filter((i) => between(i.on)).map((i) => i.litres));
      expected = baseline.litres + sum(ds.filter((d) => between(d.on)).map((d) => d.litres)) - issued;
      variance = last.litres - expected;
      flagged = Math.abs(variance) > Math.max(VARIANCE_FLAG_MIN_LITRES, VARIANCE_FLAG_SHARE * issued);
    }
    return {
      store,
      inByType,
      litresIn: sum(Object.values(inByType)),
      litresOut,
      lastDip: last ? { on: last.on, litres: last.litres } : null,
      expected,
      variance,
      flagged,
      overCapacity: !!last && last.litres > store.capacityLitres,
    };
  });
}

export type MachineRow = { id: string | null; label: string; issued: number; telematicsLitres: number | null; hours: number | null; idleShare: number | null };

/** Litres issued per machine (or free-text vehicle) beside what its telematics reported. A machine with a feed and no issues still appears. */
export function summariseMachines(
  assets: { id: string; name: string }[],
  issues: IssueIn[],
  telematics: Map<string, { litres: number; hours: number; idleHours: number }>,
): MachineRow[] {
  const rows = new Map<string, MachineRow>();
  const names = new Map(assets.map((a) => [a.id, a.name]));
  for (const i of issues) {
    const key = i.plantAssetId ? `a:${i.plantAssetId}` : `v:${(i.vehicleLabel ?? "Unnamed").trim().toLowerCase()}`;
    const row = rows.get(key) ?? { id: i.plantAssetId, label: i.plantAssetId ? names.get(i.plantAssetId) ?? "Machine" : (i.vehicleLabel ?? "Unnamed").trim(), issued: 0, telematicsLitres: null, hours: null, idleShare: null };
    row.issued += i.litres;
    rows.set(key, row);
  }
  for (const [assetId, t] of telematics) {
    if (t.litres <= 0 && t.hours <= 0) continue;
    const key = `a:${assetId}`;
    const row = rows.get(key) ?? { id: assetId, label: names.get(assetId) ?? "Machine", issued: 0, telematicsLitres: null, hours: null, idleShare: null };
    row.telematicsLitres = t.litres;
    row.hours = t.hours;
    row.idleShare = t.hours > 0 ? t.idleHours / t.hours : null;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => Math.max(b.issued, b.telematicsLitres ?? 0) - Math.max(a.issued, a.telematicsLitres ?? 0));
}

export type SiteRow = { siteId: string | null; siteName: string; delivered: number; issued: number; recorded: number | null; gap: number | null };

/** Delivered into each site's stores against approved diesel and HVO records for the site (null when the site has no stores' fuel type to compare). */
export function summariseSites(stores: StoreSummary[], recordedBySite: Map<string, number>): SiteRow[] {
  const by = new Map<string, SiteRow>();
  for (const s of stores) {
    const key = s.store.siteId ?? "none";
    const row = by.get(key) ?? { siteId: s.store.siteId, siteName: s.store.siteName ?? "No site", delivered: 0, issued: 0, recorded: null, gap: null };
    row.delivered += s.litresIn;
    row.issued += s.litresOut;
    by.set(key, row);
  }
  for (const row of by.values()) {
    if (!row.siteId) continue;
    row.recorded = recordedBySite.get(row.siteId) ?? 0;
    row.gap = row.delivered - row.recorded;
  }
  return [...by.values()].sort((a, b) => b.delivered - a.delivered);
}
