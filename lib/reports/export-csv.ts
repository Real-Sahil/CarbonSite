export interface ExportAggregate {
  scope: number;
  totalCo2e: { toString(): string } | null;
  recordCount: number;
  intensityPerRevenueUnit: { toString(): string } | null;
  intensityPerFte: { toString(): string } | null;
  intensityPerM2: { toString(): string } | null;
  emissionCategory: { code: string; name: string } | null;
  facility: { name: string } | null;
  businessUnit: { name: string } | null;
  scope2Method: string | null;
}

/** Aggregates hold totals in kg CO2e; the CSV reports tonnes. */
export function aggregatesToCsv(aggregates: ExportAggregate[]): string {
  const headers = [
    "Scope",
    "Category",
    "Facility",
    "Business Unit",
    "Scope 2 Method",
    "CO2e (tonnes)",
    "Record Count",
    "Intensity per Revenue",
    "Intensity per FTE",
    "Intensity per m²",
  ];

  const rows = aggregates.map((a) => [
    a.scope,
    a.emissionCategory?.code || "other",
    a.facility?.name || "",
    a.businessUnit?.name || "",
    a.scope2Method || "",
    (Number(a.totalCo2e) / 1000).toFixed(4),
    a.recordCount,
    a.intensityPerRevenueUnit ? Number(a.intensityPerRevenueUnit).toFixed(8) : "",
    a.intensityPerFte ? Number(a.intensityPerFte).toFixed(4) : "",
    a.intensityPerM2 ? Number(a.intensityPerM2).toFixed(4) : "",
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value.toString();
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
