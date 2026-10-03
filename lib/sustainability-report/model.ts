// Annual sustainability report: the pure parts. Every figure comes from a
// published snapshot or the organisation's own records (see load.ts); nothing
// here estimates, and a row the organisation has no data for says so instead
// of claiming "not applicable".

import { change, type ScopeTotals } from "@/lib/bids/carbon-pack";
import type { Formatters } from "@/lib/i18n/org-format";
import { hvoShare } from "@/lib/calculation/fuels";

/** The 15 GHG Protocol Scope 3 categories, in order, with the seeded category code. */
export const SCOPE3_CATEGORIES = [
  { code: "s3-purchased-goods", label: "1. Purchased goods and services" },
  { code: "s3-capital-goods", label: "2. Capital goods" },
  { code: "s3-fuel-energy", label: "3. Fuel and energy related activities" },
  { code: "s3-upstream-transport", label: "4. Upstream transportation and distribution" },
  { code: "s3-waste", label: "5. Waste generated in operations" },
  { code: "s3-business-travel", label: "6. Business travel" },
  { code: "s3-commuting", label: "7. Employee commuting" },
  { code: "s3-upstream-leased", label: "8. Upstream leased assets" },
  { code: "s3-downstream-transport", label: "9. Downstream transportation and distribution" },
  { code: "s3-processing-sold", label: "10. Processing of sold products" },
  { code: "s3-use-sold", label: "11. Use of sold products" },
  { code: "s3-end-of-life", label: "12. End-of-life treatment of sold products" },
  { code: "s3-downstream-leased", label: "13. Downstream leased assets" },
  { code: "s3-franchises", label: "14. Franchises" },
  { code: "s3-investments", label: "15. Investments" },
] as const;

export type Scope3Status = "reported" | "no_records" | "not_relevant" | "not_yet_measured";

/** The organisation's own note on a category, from its Carbon Reduction Plan. */
export type Scope3Note = { code: string; status: "reported" | "not_relevant" | "not_yet_measured"; explanation: string };

export type Scope3Row = {
  code: string;
  label: string;
  tonnes: number | null;
  status: Scope3Status;
  explanation: string;
};

/**
 * One row per Scope 3 category. A category with records is reported. One
 * without takes the organisation's own status and reason when it wrote one;
 * otherwise it says "no records", never "not applicable": only the
 * organisation can say a category is not relevant to it.
 */
export function scope3Disclosure(categories: { code: string; tonnes: number }[], notes: Scope3Note[]): Scope3Row[] {
  const tonnesBy = new Map<string, number>();
  for (const c of categories) tonnesBy.set(c.code, (tonnesBy.get(c.code) ?? 0) + c.tonnes);
  const noteBy = new Map(notes.map((n) => [n.code, n]));
  return SCOPE3_CATEGORIES.map(({ code, label }) => {
    const tonnes = tonnesBy.get(code);
    const note = noteBy.get(code);
    if (tonnes != null && tonnes > 0) return { code, label, tonnes, status: "reported", explanation: note?.explanation ?? "" };
    if (note && note.status !== "reported") return { code, label, tonnes: null, status: note.status, explanation: note.explanation };
    return { code, label, tonnes: null, status: "no_records", explanation: note?.explanation ?? "" };
  });
}

export type YearRow = { label: string; kind: "base" | "previous" | "current"; s1: number | null; s2: number | null; s3: number | null; total: number | null };

type History = { periodLabel: string; totals: ScopeTotals }[];
type BaseYear = { label: string; s1: number | null; s2: number | null; s3: number | null; total: number | null } | null;

/** Base year, the period before this one, and this one. The base year row is dropped when it is the previous period itself. */
export function yearTable(baseYear: BaseYear, history: History, current: ScopeTotals, currentLabel: string): YearRow[] {
  const prior = history.filter((h) => h.periodLabel !== currentLabel);
  const prev = prior.length ? prior[prior.length - 1] : null;
  const rows: YearRow[] = [];
  const isBaseYear = (label: string) => baseYear != null && baseYear.label.toLowerCase().includes(label.toLowerCase());
  if (baseYear && !isBaseYear(currentLabel) && !(prev && isBaseYear(prev.periodLabel))) rows.push({ ...baseYear, kind: "base" });
  if (prev) rows.push({ label: prev.periodLabel, kind: "previous", s1: prev.totals.s1, s2: prev.totals.s2, s3: prev.totals.s3, total: prev.totals.total });
  rows.push({ label: currentLabel, kind: "current", s1: current.s1, s2: current.s2, s3: current.s3, total: current.total });
  return rows;
}

export type Intensity = { currency: string; perMillionTotal: number; perMillionS12: number; perFte: number | null };

/** Tonnes per million of revenue, from the reporting period's own revenue. Null without one. */
export function intensity(total: number, s12: number, revenue: { amount: number; currency: string } | null, fte: number | null): Intensity | null {
  if (!revenue || !(revenue.amount > 0)) return null;
  const million = revenue.amount / 1_000_000;
  return {
    currency: revenue.currency,
    perMillionTotal: total / million,
    perMillionS12: s12 / million,
    perFte: fte && fte > 0 ? total / fte : null,
  };
}

export type Tile = { value: string; label: string };

const pct = (fmt: Formatters, c: number) => `${c <= 0 ? "−" : "+"}${fmt.percent(Math.abs(c))}`;

export type HighlightInput = {
  periodLabel: string;
  current: ScopeTotals;
  baseYear: BaseYear;
  intensity: Intensity | null;
  waste: { diversionRate: number | null } | null;
  /** Tonnes of waste per million of revenue, when both exist. */
  wasteIntensity?: number | null;
  fuel?: Fuel | null;
  socialValuePounds: number;
  topCategory: { name: string; tonnes: number } | null;
  /** The organisation's number formatting. */
  fmt: Formatters;
};

/** Headline tiles. A tile appears only when its figure exists. */
export function highlights(i: HighlightInput): Tile[] {
  const fmt = i.fmt;
  const tiles: Tile[] = [{ value: fmt.tonnes(i.current.total), label: `tCO₂e total, ${i.periodLabel}` }];
  const s12 = i.current.s1 + i.current.s2;
  const baseS12 = i.baseYear?.s1 != null && i.baseYear?.s2 != null ? i.baseYear.s1 + i.baseYear.s2 : null;
  const vsBase = change(baseS12, s12);
  if (vsBase != null && i.baseYear) tiles.push({ value: pct(fmt, vsBase), label: `Scope 1 and 2 vs ${i.baseYear.label}` });
  if (i.current.total > 0) tiles.push({ value: fmt.percent(i.current.s3 / i.current.total, 0), label: "of emissions are Scope 3" });
  if (i.topCategory && i.current.total > 0) {
    tiles.push({ value: fmt.percent(i.topCategory.tonnes / i.current.total, 0), label: `from ${i.topCategory.name}, the largest source` });
  }
  if (i.intensity) tiles.push({ value: fmt.tonnes(i.intensity.perMillionTotal), label: `tCO₂e per million ${i.intensity.currency} revenue` });
  if (i.waste?.diversionRate != null) tiles.push({ value: fmt.percent(i.waste.diversionRate), label: "of waste diverted from landfill" });
  if (i.fuel && i.fuel.hvoShare > 0) tiles.push({ value: fmt.percent(i.fuel.hvoShare), label: "of fuel litres is HVO" });
  if (i.wasteIntensity != null && i.intensity) tiles.push({ value: fmt.tonnes(i.wasteIntensity), label: `tonnes of waste per million ${i.intensity.currency} revenue` });
  if (i.socialValuePounds > 0) tiles.push({ value: fmt.money(i.socialValuePounds, "GBP"), label: "National TOMs (UK) social value recorded, GBP" });
  return tiles.slice(0, 9);
}

/** ESRS disclosure each section of the report speaks to; only sections present are listed. */
export const ESRS_SECTION_REFS: Record<string, string> = {
  emissions: "ESRS E1-6: Gross Scopes 1, 2, 3 and total GHG emissions (including intensity)",
  targets: "ESRS E1-4: Targets related to climate change mitigation",
  measures: "ESRS E1-3: Actions and resources in relation to climate change",
  waste: "ESRS E5-5: Resource outflows (waste)",
  water: "ESRS E3-4: Water consumption (withdrawal, discharge, consumption)",
  fuel: "ESRS E1-5: Energy consumption and mix (fuel only; electricity is not covered here)",
  social: "Social value (National TOMs); no ESRS equivalent",
};

export const ESRS_STATEMENT =
  "Prepared with reference to the European Sustainability Reporting Standards (ESRS) and the GHG Protocol Corporate Standard. It is not presented as compliant with ESRS and should not be read as such. The index lists where each disclosure is addressed.";

export type Waste = { totalTonnes: number; divertedTonnes: number; diversionRate: number | null };

/** Diversion is a share of all tonnes; no tonnes gives no rate. */
export function wasteSummary(rows: { tonnes: number; diverted: boolean }[]): Waste | null {
  if (rows.length === 0) return null;
  const totalTonnes = rows.reduce((s, r) => s + r.tonnes, 0);
  const divertedTonnes = rows.reduce((s, r) => s + (r.diverted ? r.tonnes : 0), 0);
  return { totalTonnes, divertedTonnes, diversionRate: totalTonnes > 0 ? divertedTonnes / totalTonnes : null };
}

export type Fuel = { totalLitres: number; hvoLitres: number; hvoShare: number };

/**
 * HVO's share of site and fleet fuel, in litres. A record whose fuel type does
 * not name HVO counts as fossil fuel; one that names a blend counts its HVO
 * part (HVO50 is half). Null with no litres recorded.
 */
export function fuelSummary(rows: { litres: number; fuelType: string | null }[]): Fuel | null {
  const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
  if (!(totalLitres > 0)) return null;
  const hvoLitres = rows.reduce((s, r) => s + r.litres * (hvoShare(r.fuelType) ?? 0), 0);
  return { totalLitres, hvoLitres, hvoShare: hvoLitres / totalLitres };
}

export type Water = { withdrawalM3: number; dischargeM3: number; consumptionM3: number };

export function waterSummary(rows: { metric: "withdrawal" | "discharge" | "consumption"; m3: number }[]): Water | null {
  if (rows.length === 0) return null;
  const sum = (m: "withdrawal" | "discharge" | "consumption") => rows.filter((r) => r.metric === m).reduce((s, r) => s + r.m3, 0);
  return { withdrawalM3: sum("withdrawal"), dischargeM3: sum("discharge"), consumptionM3: sum("consumption") };
}

/** A quantity per million of the period's revenue; null without revenue. */
export function perMillion(value: number, revenue: { amount: number } | null): number | null {
  return revenue && revenue.amount > 0 ? value / (revenue.amount / 1_000_000) : null;
}
