import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import type { ReportData } from "./template";

export type CalculationRow = Awaited<ReturnType<typeof fetchCalculations>>[number];

export async function fetchCalculations(orgId: string, runId: string, contractId?: string) {
  return prisma.emissionCalculation.findMany({
    where: {
      organizationId: orgId,
      calculationRunId: runId,
      ...(contractId ? { activityRecord: { contractId } } : {}),
    },
    include: {
      activityRecord: {
        include: {
          emissionCategory: { select: { code: true, name: true, scope: true } },
          facility: { select: { name: true } },
        },
      },
    },
    orderBy: { totalCo2e: "desc" },
  });
}

export type Aggregation = {
  scopeKg: Map<number, number>;
  catTotals: Map<string, { name: string; scope: number; totalKg: number; count: number }>;
  facTotals: Map<string, { totalKg: number; count: number }>;
  catCodeMap: Map<string, string>;
  grandKg: number;
  s1kg: number;
  s2kg: number;
  s3kg: number;
  totalCo2Kg: number;
  totalCh4Kg: number;
  totalN2oKg: number;
  totalBiogenicKg: number;
  hasCo2: boolean;
  hasCh4: boolean;
  hasN2o: boolean;
  hasBiogenic: boolean;
};

export function aggregate(calcs: CalculationRow[]): Aggregation {
  const scopeKg = new Map<number, number>();
  const catTotals = new Map<string, { name: string; scope: number; totalKg: number; count: number }>();
  const facTotals = new Map<string, { totalKg: number; count: number }>();
  const catCodeMap = new Map<string, string>();
  let grandKg = 0;
  let totalCo2Kg = 0;
  let totalCh4Kg = 0;
  let totalN2oKg = 0;
  let totalBiogenicKg = 0;
  let hasCo2 = false;
  let hasCh4 = false;
  let hasN2o = false;
  let hasBiogenic = false;

  for (const calc of calcs) {
    const kg = Number(calc.totalCo2e);
    const scope = calc.activityRecord.emissionCategory.scope;
    const catName = calc.activityRecord.emissionCategory.name;
    grandKg += kg;
    scopeKg.set(scope, (scopeKg.get(scope) ?? 0) + kg);
    const c = catTotals.get(catName) ?? { name: catName, scope, totalKg: 0, count: 0 };
    c.totalKg += kg; c.count += 1;
    catTotals.set(catName, c);
    const facName = calc.activityRecord.facility?.name ?? "Unassigned";
    const f = facTotals.get(facName) ?? { totalKg: 0, count: 0 };
    f.totalKg += kg; f.count += 1;
    facTotals.set(facName, f);
    catCodeMap.set(catName, calc.activityRecord.emissionCategory.code);
    if (calc.co2 != null) { totalCo2Kg += Number(calc.co2); hasCo2 = true; }
    if (calc.ch4 != null) { totalCh4Kg += Number(calc.ch4); hasCh4 = true; }
    if (calc.n2o != null) { totalN2oKg += Number(calc.n2o); hasN2o = true; }
    if (calc.biogenicCo2e != null) { totalBiogenicKg += Number(calc.biogenicCo2e); hasBiogenic = true; }
  }

  return {
    scopeKg, catTotals, facTotals, catCodeMap, grandKg,
    s1kg: scopeKg.get(1) ?? 0,
    s2kg: scopeKg.get(2) ?? 0,
    s3kg: scopeKg.get(3) ?? 0,
    totalCo2Kg, totalCh4Kg, totalN2oKg, totalBiogenicKg,
    hasCo2, hasCh4, hasN2o, hasBiogenic,
  };
}

export function splitScope2(calcs: CalculationRow[]): { s2lbKg: number; s2mbKg: number } {
  let s2lbKg = 0;
  let s2mbKg = 0;
  for (const calc of calcs) {
    const code = calc.activityRecord.emissionCategory.code;
    if (code === "s2-electricity-lb") s2lbKg += Number(calc.totalCo2e);
    else if (code === "s2-electricity-mb") s2mbKg += Number(calc.totalCo2e);
  }
  return { s2lbKg, s2mbKg };
}

const SCOPE_LABELS: Record<number, string> = {
  1: "Scope 1 — Direct emissions",
  2: "Scope 2 — Purchased energy",
  3: "Scope 3 — Value chain",
};

const DEFAULT_AUDIT_EVENT_TYPES = [
  "report.generation_triggered",
  "report.published",
  "calculation.run_completed",
  "snapshot.published",
];

export async function fetchReportAuditTrail(
  reportId: string,
  snapshotId: string,
  orgId: string,
  includeEventTypes?: string[],
) {
  const eventTypes = includeEventTypes ?? DEFAULT_AUDIT_EVENT_TYPES;
  return prisma.auditLog.findMany({
    where: {
      organizationId: orgId,
      action: { in: eventTypes },
      OR: [
        { resourceId: reportId },
        { resourceId: snapshotId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

export async function buildBasePdfData(
  report: { organizationId: string; organization: { name: string }; reportingPeriod: { label: string; startDate: Date; endDate: Date }; snapshot: { version: number; publishedAt: Date; calculationRunId: string; calculationRun: { factorLibrary: { name: string; version: string }; methodologyVersion: { name: string; gwpVersion: string } }; publishedBy: { name: string | null; email: string } }; type: string },
  agg: Aggregation,
  calcs: CalculationRow[],
  logoDataUri: string | undefined,
  publishedBy: string,
  factorLibrary: string,
  methodology: string,
  gwpVersion: string,
): Promise<ReportData> {
  const runId = report.snapshot.calculationRunId;
  const orgId = report.organizationId;

  const biogenicAgg = await prisma.emissionCalculation.aggregate({
    where: { calculationRunId: runId, organizationId: orgId, biogenicCo2e: { not: null } },
    _sum: { biogenicCo2e: true },
  });
  const biogenicTotal = Number(biogenicAgg._sum.biogenicCo2e ?? 0);

  return {
    orgName: report.organization.name,
    logoDataUri,
    reportType: report.type,
    periodLabel: report.reportingPeriod.label,
    periodStart: report.reportingPeriod.startDate,
    periodEnd: report.reportingPeriod.endDate,
    snapshotVersion: report.snapshot.version,
    publishedAt: report.snapshot.publishedAt,
    publishedBy,
    factorLibrary,
    methodology,
    gwpVersion,
    grandTotalKg: agg.grandKg,
    recordCount: calcs.length,
    scopes: [1, 2, 3].map((scope) => ({
      scope,
      label: SCOPE_LABELS[scope],
      totalKg: agg.scopeKg.get(scope) ?? 0,
      count: 0,
    })),
    categories: [...agg.catTotals.values()].sort((a, b) => b.totalKg - a.totalKg),
    facilities: [...agg.facTotals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalKg - a.totalKg),
    biogenicCo2eTonnes: biogenicTotal > 0 ? biogenicTotal / 1000 : undefined,
    auditTrail: {
      generatedAt: new Date(),
      generatedBy: publishedBy,
      calculationRunId: runId,
      calculationStatus: "completed",
      totalCalculationsExecuted: calcs.length,
    },
  };
}

export async function loadLogoDataUri(logoKey: string | null | undefined): Promise<string | undefined> {
  if (!logoKey) return undefined;
  try {
    const buf = await getObject(logoKey);
    const ext = logoKey.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : ext === "svg" ? "image/svg+xml"
      : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error("[reports] Failed to load branding logo:", err);
    return undefined;
  }
}
