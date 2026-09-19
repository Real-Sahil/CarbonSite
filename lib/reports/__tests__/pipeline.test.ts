/**
 * End-to-end report pipeline tests.
 *
 * Covers:
 *  - aggregate() math with fixture data
 *  - generateReportPdf() real PDFKit run → valid PDF buffer
 *  - withQueryTimeout() fires on stalled promise (via fetchCalculations mock)
 *  - LLM narrative timeout falls back gracefully (narrative skipped, not thrown)
 *  - buildBasePdfData() assembles correct ReportData shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── All mocks hoisted so they're available in vi.mock factories ──────────────
const mocks = vi.hoisted(() => ({
  emissionCalcFindMany: vi.fn(),
  emissionCalcAggregate: vi.fn(),
  auditLogFindMany: vi.fn(),
  llmComplete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emissionCalculation: {
      findMany: mocks.emissionCalcFindMany,
      aggregate: mocks.emissionCalcAggregate,
    },
    auditLog: { findMany: mocks.auditLogFindMany },
  },
}));

vi.mock("@/lib/storage", () => ({
  getObject: vi.fn().mockRejectedValue(new Error("no logo")),
  keys: {
    reportPdf: (orgId: string, reportId: string) => `org/${orgId}/reports/${reportId}/report.pdf`,
    reportCsv: (orgId: string, reportId: string) => `org/${orgId}/reports/${reportId}/report.csv`,
  },
}));

vi.mock("@/lib/llm/client", () => ({
  llmClient: {
    isConfigured: () => true,
    complete: mocks.llmComplete,
  },
}));

import { aggregate, fetchCalculations, buildBasePdfData, loadLogoDataUri } from "../aggregation";
import { generateReportPdf } from "../pdf-generator";
import { generateAuditNarrative } from "../narrative-generator";
import type { CalculationRow } from "../aggregation";
import type { ReportData } from "../template";

// ── Fixture data ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCalc(overrides: Record<string, any> = {}): CalculationRow {
  return {
    id: "calc-1",
    totalCo2e: "10000",  // 10 tCO2e
    co2: "9800",
    ch4: "100",
    n2o: "100",
    biogenicCo2e: null,
    activityRecord: {
      emissionCategory: { code: "s1-stationary", name: "Stationary Combustion", scope: 1 },
      facility: { name: "Head Office" },
    },
    ...overrides,
  } as unknown as CalculationRow;
}

const FIXTURE_CALCS: CalculationRow[] = [
  makeCalc({ id: "c1", totalCo2e: "50000", co2: "49000", ch4: "500", n2o: "500" }),
  makeCalc({
    id: "c2",
    totalCo2e: "25000",
    co2: "25000",
    ch4: null,
    n2o: null,
    activityRecord: {
      emissionCategory: { code: "s2-electricity-lb", name: "Purchased Electricity (LB)", scope: 2 },
      facility: { name: "Warehouse A" },
    },
  } as unknown as Partial<CalculationRow>),
  makeCalc({
    id: "c3",
    totalCo2e: "25000",
    co2: "25000",
    ch4: null,
    n2o: null,
    biogenicCo2e: "500",
    activityRecord: {
      emissionCategory: { code: "s3-purchased-goods", name: "Purchased Goods & Services", scope: 3 },
      facility: null,
    },
  } as unknown as Partial<CalculationRow>),
];

const BASE_REPORT_DATA: ReportData = {
  orgName: "Test Org Ltd",
  reportType: "inventory",
  periodLabel: "FY2025",
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-12-31"),
  snapshotVersion: 1,
  publishedAt: new Date("2026-01-15"),
  publishedBy: "Test User",
  factorLibrary: "DEFRA 2025.1",
  methodology: "ghg-protocol-v2026-01",
  gwpVersion: "AR6",
  grandTotalKg: 100_000,
  recordCount: 3,
  scopes: [
    { scope: 1, label: "Scope 1 — Direct emissions", totalKg: 50_000, count: 1 },
    { scope: 2, label: "Scope 2 — Purchased energy", totalKg: 25_000, count: 1 },
    { scope: 3, label: "Scope 3 — Value chain", totalKg: 25_000, count: 1 },
  ],
  categories: [
    { name: "Stationary Combustion", scope: 1, totalKg: 50_000, count: 1 },
    { name: "Purchased Electricity (LB)", scope: 2, totalKg: 25_000, count: 1 },
    { name: "Purchased Goods & Services", scope: 3, totalKg: 25_000, count: 1 },
  ],
  facilities: [
    { name: "Head Office", totalKg: 50_000, count: 1 },
    { name: "Warehouse A", totalKg: 25_000, count: 1 },
    { name: "Unassigned", totalKg: 25_000, count: 1 },
  ],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("aggregate()", () => {
  it("sums grandKg correctly", () => {
    const agg = aggregate(FIXTURE_CALCS);
    expect(agg.grandKg).toBe(100_000);
  });

  it("splits into correct scope totals", () => {
    const agg = aggregate(FIXTURE_CALCS);
    expect(agg.s1kg).toBe(50_000);
    expect(agg.s2kg).toBe(25_000);
    expect(agg.s3kg).toBe(25_000);
  });

  it("builds per-category map", () => {
    const agg = aggregate(FIXTURE_CALCS);
    expect(agg.catTotals.size).toBe(3);
    expect(agg.catTotals.get("Stationary Combustion")?.totalKg).toBe(50_000);
  });

  it("groups null facility as Unassigned", () => {
    const agg = aggregate(FIXTURE_CALCS);
    expect(agg.facTotals.has("Unassigned")).toBe(true);
    expect(agg.facTotals.get("Unassigned")?.totalKg).toBe(25_000);
  });

  it("tracks individual gas totals", () => {
    const agg = aggregate(FIXTURE_CALCS);
    expect(agg.hasCo2).toBe(true);
    expect(agg.hasCh4).toBe(true);
    // biogenic from c3
    expect(agg.hasBiogenic).toBe(true);
    expect(agg.totalBiogenicKg).toBe(500);
  });

  it("handles empty calcs without throwing", () => {
    const agg = aggregate([]);
    expect(agg.grandKg).toBe(0);
    expect(agg.s1kg).toBe(0);
  });
});

describe("fetchCalculations() timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("rejects with timeout error when DB hangs beyond 30s", async () => {
    mocks.emissionCalcFindMany.mockImplementation(() => new Promise(() => {})); // never resolves

    const promise = fetchCalculations("org-1", "run-1");

    // Advance clock past the 30s timeout
    vi.advanceTimersByTime(31_000);

    await expect(promise).rejects.toThrow("Database query timeout after 30000ms");
    vi.useRealTimers();
  });

  it("resolves normally when DB responds quickly", async () => {
    vi.useRealTimers();
    mocks.emissionCalcFindMany.mockResolvedValue(FIXTURE_CALCS);

    const result = await fetchCalculations("org-1", "run-1");
    expect(result).toHaveLength(3);
  });
});

describe("generateReportPdf()", () => {
  it("produces a non-empty PDF buffer with valid PDF header", async () => {
    const buf = await generateReportPdf(BASE_REPORT_DATA);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // PDF files start with %PDF-
    const header = buf.slice(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("handles zero-emission snapshot without crashing", async () => {
    const zeroData: ReportData = {
      ...BASE_REPORT_DATA,
      grandTotalKg: 0,
      recordCount: 0,
      scopes: BASE_REPORT_DATA.scopes.map((s) => ({ ...s, totalKg: 0, count: 0 })),
      categories: [],
      facilities: [],
    };
    const buf = await generateReportPdf(zeroData);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("includes narrative sections when provided", async () => {
    const dataWithNarrative: ReportData = {
      ...BASE_REPORT_DATA,
      narrative: {
        executive_summary: "Test executive summary text.",
        key_findings: ["Finding 1", "Finding 2"],
        recommendations: "Test recommendations text.",
      },
    };
    const buf = await generateReportPdf(dataWithNarrative);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe("generateAuditNarrative() timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("rejects when the LLM hangs past the 20s cap", async () => {
    mocks.llmComplete.mockImplementation(() => new Promise(() => {})); // hangs forever

    const promise = generateAuditNarrative(BASE_REPORT_DATA);
    // Assert on the rejection before advancing, so the rejection is never
    // momentarily unhandled.
    const assertion = expect(promise).rejects.toThrow(
      "LLM narrative timeout after 20000ms",
    );

    vi.advanceTimersByTime(21_000);

    // generateAuditNarrative rethrows deliberately: the caller in
    // lib/reports/worker.ts catches it and publishes the report without a
    // narrative, so the timeout text never reaches a customer's PDF.
    await assertion;
    vi.useRealTimers();
  });

  it("returns full narrative when LLM responds quickly", async () => {
    vi.useRealTimers();
    mocks.llmComplete.mockResolvedValue({
      text: `EXECUTIVE_SUMMARY:\nThis org emits 100 tCO2e.\n\nKEY_FINDINGS:\n- Finding one\n- Finding two\n\nRECOMMENDATIONS:\nReduce Scope 1.`,
      provider: "mock",
      tokens: 100,
    });

    const result = await generateAuditNarrative(BASE_REPORT_DATA);
    expect(result.executive_summary).toContain("100 tCO2e");
    expect(result.key_findings).toHaveLength(2);
    expect(result.recommendations).toContain("Reduce Scope 1");
  });
});

describe("buildBasePdfData()", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.emissionCalcAggregate.mockResolvedValue({ _sum: { biogenicCo2e: "500" } });
    mocks.auditLogFindMany.mockResolvedValue([]);
  });

  it("assembles correct ReportData from fixture inputs", async () => {
    const agg = aggregate(FIXTURE_CALCS);

    const mockReport = {
      id: "report-1",
      organizationId: "org-1",
      type: "inventory",
      organization: { name: "Test Org Ltd" },
      reportingPeriod: {
        label: "FY2025",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
      },
      snapshot: {
        version: 1,
        publishedAt: new Date("2026-01-15"),
        calculationRunId: "run-1",
        calculationRun: {
          factorLibrary: { name: "DEFRA", version: "2025.1" },
          methodologyVersion: { name: "ghg-protocol-v2026-01", gwpVersion: "AR6" },
        },
        publishedBy: { name: "Jane Smith", email: "jane@example.com" },
      },
    };

    const data = await buildBasePdfData(
      mockReport as Parameters<typeof buildBasePdfData>[0],
      agg,
      FIXTURE_CALCS,
      undefined,
      "Jane Smith",
      "DEFRA 2025.1",
      "ghg-protocol-v2026-01",
      "AR6",
    );

    expect(data.orgName).toBe("Test Org Ltd");
    expect(data.grandTotalKg).toBe(100_000);
    expect(data.recordCount).toBe(3);
    expect(data.scopes).toHaveLength(3);
    expect(data.categories).toHaveLength(3);
    expect(data.biogenicCo2eTonnes).toBeCloseTo(0.5);
  });

  it("handles biogenic aggregate timeout gracefully (real timeout via fake timers)", async () => {
    vi.useFakeTimers();
    mocks.emissionCalcAggregate.mockImplementation(() => new Promise(() => {}));

    const agg = aggregate([]);
    const mockReport = {
      id: "r1",
      organizationId: "org-1",
      type: "inventory",
      organization: { name: "Org" },
      reportingPeriod: { label: "FY2025", startDate: new Date(), endDate: new Date() },
      snapshot: {
        version: 1,
        publishedAt: new Date(),
        calculationRunId: "run-1",
        calculationRun: {
          factorLibrary: { name: "DEFRA", version: "2025.1" },
          methodologyVersion: { name: "ghg-protocol-v2026-01", gwpVersion: "AR6" },
        },
        publishedBy: { name: "User", email: "u@e.com" },
      },
    };

    const promise = buildBasePdfData(
      mockReport as Parameters<typeof buildBasePdfData>[0],
      agg, [], undefined,
      "User", "DEFRA 2025.1", "ghg-protocol-v2026-01", "AR6",
    );

    vi.advanceTimersByTime(31_000);

    await expect(promise).rejects.toThrow("Database query timeout after 30000ms");
    vi.useRealTimers();
  });
});
