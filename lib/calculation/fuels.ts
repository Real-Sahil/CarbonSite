// HVO (hydrotreated vegetable oil, "renewable diesel") on a record's fuel
// type. Sites buy it neat (HVO100) or blended with diesel (HVO50, "30% HVO").
// DEFRA publishes one HVO factor per litre, most of whose CO2 is biogenic and
// reported outside of scopes, so treating HVO as diesel overstates Scope 1
// roughly seventy-fold, and treating a blend as neat HVO understates it.

/** Share of HVO in the fuel, 0-1, or null when the text does not mention HVO. */
export function hvoShare(fuelText: string | null | undefined): number | null {
  const t = (fuelText ?? "").toLowerCase();
  if (!t.trim()) return null;
  const named = /\bhvo\b|\bhvo\d|hydrotreated vegetable oil|renewable diesel/.test(t);
  if (!named) return null;
  const suffix = t.match(/\bhvo\s*-?\s*(\d{1,3})\b/);
  const percent = t.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*(?:hvo|renewable diesel)/);
  const raw = suffix ? Number(suffix[1]) : percent ? Number(percent[1]) : 100;
  if (!Number.isFinite(raw) || raw <= 0 || raw > 100) return 1;
  return raw / 100;
}
