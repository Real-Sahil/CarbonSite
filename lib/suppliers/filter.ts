export type SupplierRow = {
  supplierName: string;
  dataQualityScore: number;
  trend: "improving" | "stable" | "declining";
};

export type Health = "healthy" | "at_risk" | "critical";

/** The band the suppliers page shows for a data quality score. */
export function healthOf(score: number): Health {
  if (score >= 80) return "healthy";
  if (score >= 60) return "at_risk";
  return "critical";
}

export const HEALTH_LABELS: Record<Health, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  critical: "Critical",
};

/** Applies the page's filters (q: part of a name, health, trend) to the supplier list. */
export function filterSuppliers<T extends SupplierRow>(rows: T[], filters: Record<string, string>): T[] {
  const q = filters.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.supplierName.toLowerCase().includes(q)) &&
      (!filters.health || healthOf(r.dataQualityScore) === filters.health) &&
      (!filters.trend || r.trend === filters.trend),
  );
}
