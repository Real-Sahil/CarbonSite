// Units a supplier can report in through the data request form
// (app/supplier-data/[token]). One list for the form, the submit route and the
// step that turns an accepted report into an activity record, so they cannot
// drift apart again.
//
// Three kinds: what the supplier knows about their own emissions (tCO2e,
// kgCO2e), activity data we can price (kg, tonne, kWh, ...) and spend in a
// currency. The calculation method follows from the unit.

export type SupplierMethod = "direct_measurement" | "activity_based" | "spend_based";

export const EMISSION_UNITS = ["tCO2e", "kgCO2e"] as const;
export const ACTIVITY_UNITS = ["kg", "tonne", "kWh", "MWh", "litre", "m3", "piece"] as const;

/** An ISO 4217-shaped code. The calculation converts it at the ECB rate for the record's date. */
export const isSupplierCurrency = (unit: string) => /^[A-Z]{3}$/.test(unit);

export const isSupplierUnit = (unit: string) =>
  (EMISSION_UNITS as readonly string[]).includes(unit) ||
  (ACTIVITY_UNITS as readonly string[]).includes(unit) ||
  isSupplierCurrency(unit);

export function methodForUnit(unit: string): SupplierMethod {
  if ((EMISSION_UNITS as readonly string[]).includes(unit)) return "direct_measurement";
  if (isSupplierCurrency(unit)) return "spend_based";
  return "activity_based";
}
