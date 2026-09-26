// Waste quantities from Scope 3 Category 5 activity records, for the ESRS E5
// report when an organisation keeps no waste register. A record gives tonnes
// (t or kg only); its disposal route and hazard status are taken only from
// what the record itself says (a route word, an EWC code), never from the
// emission factor the calculation picked, which may be a default.
import { wasteHierarchyOf, type WasteHierarchy } from "./hierarchy";

export type WasteRecordLike = {
  amount: number;
  unit: string;
  sourceDescription: string | null;
  fuelType: string | null;
  facilityId: string | null;
};

export type WasteRow = {
  tonnes: number;
  /** A disposalRouteSchema value, or null when the record names none. */
  route: string | null;
  hierarchy: WasteHierarchy | null;
  /** From an EWC code: true for an asterisked (hazardous) code. Null without one. */
  hazardous: boolean | null;
  facilityId: string | null;
};

const ROUTE_WORDS: [RegExp, string][] = [
  [/hazardous\s+landfill/i, "hazardous_landfill"],
  [/landfill/i, "landfill_mixed"],
  [/\befw\b|energy from waste|energy recovery|incinerat/i, "incineration_efw"],
  [/anaerobic|\bAD\b/, "anaerobic_digestion"],
  [/compost/i, "composting_food"],
  [/recycl|reuse|re-use|crush(ed|ing)?\s+on\s+site/i, "recycling_mixed"],
];

export function routeFromText(text: string): string | null {
  for (const [re, route] of ROUTE_WORDS) if (re.test(text)) return route;
  return null;
}

/** EWC codes are six digits in three pairs; an asterisk marks hazardous waste. */
export function hazardFromText(text: string): boolean | null {
  const m = text.match(/\b(\d{2})[ .]?(\d{2})[ .]?(\d{2})(\s?\*)?/);
  if (!m || !/ewc|\*/i.test(text)) return null;
  return !!m[4];
}

export function wasteRowsFromRecords(records: WasteRecordLike[]): { rows: WasteRow[]; skipped: number } {
  const rows: WasteRow[] = [];
  let skipped = 0;
  for (const r of records) {
    const unit = r.unit.trim().toLowerCase();
    const tonnes = ["t", "tonne", "tonnes", "ton", "tons"].includes(unit)
      ? r.amount
      : ["kg", "kilogram", "kilograms"].includes(unit)
        ? r.amount / 1000
        : null;
    if (tonnes == null || !Number.isFinite(tonnes)) {
      skipped++;
      continue;
    }
    const text = [r.sourceDescription, r.fuelType].filter(Boolean).join(" ");
    const route = routeFromText(text);
    rows.push({
      tonnes,
      route,
      hierarchy: route ? wasteHierarchyOf(route) : null,
      hazardous: hazardFromText(text),
      facilityId: r.facilityId,
    });
  }
  return { rows, skipped };
}
