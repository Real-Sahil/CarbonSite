// Reports worker — generates PDF + CSV for a Report from its PublishedSnapshot.
// Dispatches to a type-specific HTML template based on report.type.
// PDF via Puppeteer (headless Chromium). Totals here must match dashboard totals
// for the same snapshot — both derive from the same calculation run.

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { putObject, getObject, keys } from "@/lib/storage";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import { renderReportHtml, type ReportData } from "./template";
import { renderSecrHtml, type SecrData } from "./templates/secr";
import { renderPpn0621Html, type Ppn0621Data } from "./templates/ppn-0621";
import { renderNhsEvergreenHtml, type NhsEvergreenData } from "./templates/nhs-evergreen";
import { renderNationalTomsHtml, type NationalTomsData, type TomsThemeSummary } from "./templates/national-toms";
import { renderBreeamEvidenceHtml, type BreeamData } from "./templates/breeam-evidence";
import { renderCsrdEsrsE1Html, type CsrdEsrsE1Data } from "./templates/csrd-esrs-e1";
import { renderContractCarbonHtml, type ContractCarbonData } from "./templates/contract-carbon";

const REPORT_INCLUDE = {
  organization: {
    select: {
      name: true,
      branding: { select: { reportHeaderLogoKey: true } },
    },
  },
  reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
  contract: { select: { name: true } },
  snapshot: {
    include: {
      calculationRun: {
        include: {
          factorLibrary: { select: { name: true, version: true } },
          methodologyVersion: { select: { name: true, gwpVersion: true } },
        },
      },
      publishedBy: { select: { name: true, email: true } },
    },
  },
  createdBy: { select: { name: true, email: true } },
} as const;

type ReportWithIncludes = Prisma.ReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

const SCOPE_LABELS: Record<number, string> = {
  1: "Scope 1 — Direct emissions",
  2: "Scope 2 — Purchased energy",
  3: "Scope 3 — Value chain",
};

export async function processReport(reportId: string, orgId: string): Promise<void> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: REPORT_INCLUDE,
  });

  if (report.organizationId !== orgId) throw new Error("Org mismatch on report job.");
  if (report.status === "ready") return;

  await prisma.report.update({ where: { id: reportId }, data: { status: "generating" } });

  try {
    const html = await renderForType(report);

    // CSV only for carbon-based reports (not TOMS)
    let csvBuffer: Buffer | null = null;
    if (report.type !== "national_toms") {
      const calculations = await fetchCalculations(orgId, report.snapshot.calculationRunId, report.contractId ?? undefined);
      csvBuffer = buildCsv(calculations, report);
    }

    const pdfBuffer = await renderPdf(html);
    const pdfKey = keys.reportPdf(orgId, reportId);
    const pdfChecksum = createHash("sha256").update(pdfBuffer).digest("hex");
    await putObject(pdfKey, pdfBuffer, "application/pdf");

    let csvKey: string | undefined;
    let csvChecksum: string | undefined;
    if (csvBuffer) {
      csvKey = keys.reportCsv(orgId, reportId);
      csvChecksum = createHash("sha256").update(csvBuffer).digest("hex");
      await putObject(csvKey, csvBuffer, "text/csv");
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "ready",
        pdfStorageKey: pdfKey,
        csvStorageKey: csvKey ?? null,
        pdfChecksum,
        csvChecksum: csvChecksum ?? null,
        publishedAt: new Date(),
      },
      select: { createdByUserId: true, type: true },
    });

    enqueueNotification({
      type: "report_ready",
      recipientUserId: updated.createdByUserId,
      orgId,
      resourceId: reportId,
      metadata: { reportLabel: `${updated.type.replaceAll("_", " ")} — ${report.reportingPeriod.label}` },
    }).catch((err) => console.error("[reports] Failed to enqueue notification:", err));

  } catch (err) {
    console.error(`[reports] Error generating report ${reportId}:`, err);
    await prisma.report.update({ where: { id: reportId }, data: { status: "failed" } });
    throw err;
  }
}

// ── Template dispatch ──────────────────────────────────────────────────────────

/// Loads the org's report header logo as a base64 data URI. Returns undefined
/// when no logo is set or the object can't be read — the report still renders
/// (just without the logo), so a missing logo never fails generation.
async function loadLogoDataUri(logoKey: string | null | undefined): Promise<string | undefined> {
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

async function renderForType(report: ReportWithIncludes): Promise<string> {
  const orgId = report.organizationId;
  const runId = report.snapshot.calculationRunId;
  const opts = (report.options ?? {}) as Record<string, unknown>;
  const logoDataUri = await loadLogoDataUri(report.organization.branding?.reportHeaderLogoKey);

  const calcs = report.type !== "national_toms"
    ? await fetchCalculations(orgId, runId, report.contractId ?? undefined)
    : [];

  // Aggregate totals
  const scopeKg = new Map<number, number>();
  const catTotals = new Map<string, { name: string; scope: number; totalKg: number; count: number }>();
  const facTotals = new Map<string, { totalKg: number; count: number }>();
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
    if (calc.co2 != null) { totalCo2Kg += Number(calc.co2); hasCo2 = true; }
    if (calc.ch4 != null) { totalCh4Kg += Number(calc.ch4); hasCh4 = true; }
    if (calc.n2o != null) { totalN2oKg += Number(calc.n2o); hasN2o = true; }
    if (calc.biogenicCo2e != null) { totalBiogenicKg += Number(calc.biogenicCo2e); hasBiogenic = true; }
  }

  const s1kg = scopeKg.get(1) ?? 0;
  const s2kg = scopeKg.get(2) ?? 0;
  const s3kg = scopeKg.get(3) ?? 0;
  const factorLibrary = `${report.snapshot.calculationRun.factorLibrary.name} ${report.snapshot.calculationRun.factorLibrary.version}`;
  const methodology = report.snapshot.calculationRun.methodologyVersion.name;
  const gwpVersion = report.snapshot.calculationRun.methodologyVersion.gwpVersion;
  const publishedBy = report.snapshot.publishedBy.name ?? report.snapshot.publishedBy.email;

  // ── SECR ─────────────────────────────────────────────────────────────────
  if (report.type === "secr") {
    const intensityValue = Number(opts.intensityDenominatorValue ?? 1);
    const data: SecrData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      gasKwh: Number(opts.gasKwh ?? 0),
      electricityKwh: Number(opts.electricityKwh ?? 0),
      transportFuelKwh: Number(opts.transportFuelKwh ?? 0),
      totalUkEnergyKwh: Number(opts.totalUkEnergyKwh ?? 0),
      scope1Tonnes: s1kg / 1000,
      scope2Tonnes: s2kg / 1000,
      totalTonnes: (s1kg + s2kg) / 1000,
      intensityMetric: String(opts.intensityMetric ?? "tCO₂e per employee"),
      intensityValue: intensityValue > 0 ? (s1kg + s2kg) / 1000 / intensityValue : 0,
      intensityDenominator: String(opts.intensityDenominator ?? ""),
      efficiencyMeasures: Array.isArray(opts.efficiencyMeasures) ? opts.efficiencyMeasures as string[] : [],
      recordCount: calcs.length,
    };
    return renderSecrHtml(data);
  }

  // ── PPN 06/21 ─────────────────────────────────────────────────────────────
  if (report.type === "ppn_06_21") {
    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      select: { name: true, expectedImpactCo2e: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    const data: Ppn0621Data = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: s1kg / 1000,
      scope2Tonnes: s2kg / 1000,
      scope3Tonnes: s3kg / 1000,
      totalTonnes: grandKg / 1000,
      baselineYear: opts.baselineYear as string | undefined,
      baselineTonnes: opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined,
      netZeroTargetYear: Number(opts.netZeroTargetYear ?? 2050),
      interimTargetYear: opts.interimTargetYear !== undefined ? Number(opts.interimTargetYear) : undefined,
      interimReductionPct: opts.interimReductionPct !== undefined ? Number(opts.interimReductionPct) : undefined,
      initiatives: initiatives.map((i) => ({
        name: i.name,
        expectedImpactTonnes: i.expectedImpactCo2e !== null ? Number(i.expectedImpactCo2e) / 1000 : undefined,
        status: i.status,
      })),
      scopesReported: ["Scope 1", "Scope 2", s3kg > 0 ? "Scope 3" : null].filter(Boolean) as string[],
      recordCount: calcs.length,
    };
    return renderPpn0621Html(data);
  }

  // ── NHS Evergreen ─────────────────────────────────────────────────────────
  if (report.type === "nhs_evergreen") {
    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId, status: { not: "canceled" } },
      select: { name: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    const data: NhsEvergreenData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: s1kg / 1000,
      scope2Tonnes: s2kg / 1000,
      totalTonnes: grandKg / 1000,
      netZeroTargetYear: Number(opts.netZeroTargetYear ?? 2050),
      accountableOfficerName: opts.accountableOfficerName as string | undefined,
      accountableOfficerTitle: opts.accountableOfficerTitle as string | undefined,
      initiatives: initiatives.map((i) => ({ name: i.name, status: i.status })),
      recordCount: calcs.length,
    };
    return renderNhsEvergreenHtml(data);
  }

  // ── National TOMS ─────────────────────────────────────────────────────────
  if (report.type === "national_toms") {
    const contractId = report.contractId;
    if (!contractId) throw new Error("national_toms report requires a contractId.");

    const svRecords = await prisma.socialValueRecord.findMany({
      where: { organizationId: orgId, contractId, reportingPeriodId: report.reportingPeriodId },
      include: {
        measure: { include: { theme: { select: { code: true, name: true } } } },
      },
      orderBy: { measure: { tomsCode: "asc" } },
    });

    // Aggregate by theme
    const themeMap = new Map<string, TomsThemeSummary>();
    let grandTotalPounds = 0;
    for (const r of svRecords) {
      const code = r.measure.theme.code;
      const name = r.measure.theme.name;
      if (!themeMap.has(code)) {
        themeMap.set(code, { themeCode: code, themeName: name, totalPounds: 0, measures: [] });
      }
      const theme = themeMap.get(code)!;
      const pounds = Number(r.valuePounds);
      grandTotalPounds += pounds;
      theme.totalPounds += pounds;
      const existing = theme.measures.find((m) => m.tomsCode === r.measure.tomsCode);
      if (existing) {
        existing.quantity += Number(r.quantity);
        existing.valuePounds += pounds;
      } else {
        theme.measures.push({
          tomsCode: r.measure.tomsCode,
          measureName: r.measure.name,
          unit: r.measure.unit,
          quantity: Number(r.quantity),
          valuePounds: pounds,
        });
      }
    }

    const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { name: true } });
    const data: NationalTomsData = {
      orgName: report.organization.name,
      logoDataUri,
      contractName: contract?.name ?? contractId,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      themes: [...themeMap.values()].sort((a, b) => a.themeCode.localeCompare(b.themeCode)),
      grandTotalPounds,
      totalRecords: svRecords.length,
    };
    return renderNationalTomsHtml(data);
  }

  // ── BREEAM Evidence Pack ─────────────────────────────────────────────────────
  if (report.type === "breeam_evidence") {
    const data: BreeamData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: s1kg / 1000,
      scope2Tonnes: s2kg / 1000,
      scope3Tonnes: s3kg / 1000,
      totalTonnes: grandKg / 1000,
      recordCount: calcs.length,
      categories: [...catTotals.values()],
    };
    return renderBreeamEvidenceHtml(data);
  }

  // ── CSRD ESRS E1 ─────────────────────────────────────────────────────────────
  if (report.type === "csrd_esrs_e1") {
    // Separate Scope 2 location-based vs market-based by category code.
    let s2lbKg = 0;
    let s2mbKg = 0;
    for (const calc of calcs) {
      const code = calc.activityRecord.emissionCategory.code;
      if (code === "s2-electricity-lb") s2lbKg += Number(calc.totalCo2e);
      else if (code === "s2-electricity-mb") s2mbKg += Number(calc.totalCo2e);
    }

    const data: CsrdEsrsE1Data = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: s1kg / 1000,
      scope2LocationTonnes: s2lbKg / 1000,
      scope2MarketTonnes: s2mbKg / 1000,
      scope3Tonnes: s3kg / 1000,
      totalTonnes: grandKg / 1000,
      recordCount: calcs.length,
      co2Tonnes: hasCo2 ? totalCo2Kg / 1000 : undefined,
      ch4Tonnes: hasCh4 ? totalCh4Kg / 1000 : undefined,
      n2oTonnes: hasN2o ? totalN2oKg / 1000 : undefined,
      biogenicCo2Tonnes: hasBiogenic ? totalBiogenicKg / 1000 : undefined,
      netZeroTargetYear: opts.netZeroTargetYear !== undefined ? Number(opts.netZeroTargetYear) : undefined,
      baselineYear: opts.baselineYear as string | undefined,
      baselineTonnes: opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined,
      interimTargetYear: opts.interimTargetYear !== undefined ? Number(opts.interimTargetYear) : undefined,
      interimReductionPct: opts.interimReductionPct !== undefined ? Number(opts.interimReductionPct) : undefined,
      categories: [...catTotals.values()],
    };
    return renderCsrdEsrsE1Html(data);
  }

  // ── Contract Carbon ───────────────────────────────────────────────────────────
  if (report.type === "contract_carbon") {
    const contractName = report.contract?.name ?? report.contractId ?? "Unknown contract";
    const data: ContractCarbonData = {
      orgName: report.organization.name,
      logoDataUri,
      contractName,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: s1kg / 1000,
      scope2Tonnes: s2kg / 1000,
      scope3Tonnes: s3kg / 1000,
      totalTonnes: grandKg / 1000,
      recordCount: calcs.length,
      contractValueGbp: opts.contractValueGbp !== undefined ? Number(opts.contractValueGbp) : undefined,
      categories: [...catTotals.values()],
    };
    return renderContractCarbonHtml(data);
  }

  // ── Inventory / monthly_snapshot / audit_package ──────────────────────────────
  const biogenicAgg = await prisma.emissionCalculation.aggregate({
    where: { calculationRunId: runId, organizationId: orgId, biogenicCo2e: { not: null } },
    _sum: { biogenicCo2e: true },
  });
  const biogenicTotal = Number(biogenicAgg._sum.biogenicCo2e ?? 0);

  const data: ReportData = {
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
    grandTotalKg: grandKg,
    recordCount: calcs.length,
    scopes: [1, 2, 3].map((scope) => ({
      scope,
      label: SCOPE_LABELS[scope],
      totalKg: scopeKg.get(scope) ?? 0,
      count: 0,
    })),
    categories: [...catTotals.values()].sort((a, b) => b.totalKg - a.totalKg),
    facilities: [...facTotals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalKg - a.totalKg),
    biogenicCo2eTonnes: biogenicTotal > 0 ? biogenicTotal / 1000 : undefined,
  };
  return renderReportHtml(data);
}

// ── Data helpers ──────────────────────────────────────────────────────────────

async function fetchCalculations(orgId: string, runId: string, contractId?: string) {
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

async function renderPdf(html: string): Promise<Buffer> {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

type CalcRow = {
  activityRecord: {
    sourceDescription: string | null;
    emissionCategory: { code: string; name: string; scope: number };
    facility: { name: string } | null;
  };
  originalAmount: unknown;
  originalUnit: string;
  normalizedAmount: unknown;
  normalizedUnit: string;
  factorLibraryVersion: string;
  methodologyVersionName: string;
  co2?: unknown;
  ch4?: unknown;
  n2o?: unknown;
  biogenicCo2e?: unknown;
  totalCo2e: unknown;
  formula: string;
};

function buildCsv(calculations: CalcRow[], report: { organization: { name: string }; reportingPeriod: { label: string }; snapshot: { version: number; calculationRun: { factorLibrary: { name: string; version: string }; methodologyVersion: { name: string; gwpVersion: string } } } }): Buffer {
  const esc2 = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const factorLib = `${report.snapshot.calculationRun.factorLibrary.name} ${report.snapshot.calculationRun.factorLibrary.version}`;
  const methodology = report.snapshot.calculationRun.methodologyVersion.name;
  const gwp = report.snapshot.calculationRun.methodologyVersion.gwpVersion;
  const lines: string[] = [
    `# ${report.organization.name} — GHG emissions export`,
    `# Period: ${report.reportingPeriod.label} | Snapshot v${report.snapshot.version} | Factors: ${factorLib} | Methodology: ${methodology} (GWP ${gwp})`,
    ["scope","category_code","category_name","facility","source_description","original_amount","original_unit","normalized_amount","normalized_unit","factor_library_version","methodology","co2_kg","ch4_kg_co2e","n2o_kg_co2e","biogenic_co2_kg","total_kg_co2e","total_t_co2e","formula"].join(","),
  ];
  for (const calc of calculations) {
    const kg = Number(calc.totalCo2e);
    lines.push([
      calc.activityRecord.emissionCategory.scope,
      esc2(calc.activityRecord.emissionCategory.code),
      esc2(calc.activityRecord.emissionCategory.name),
      esc2(calc.activityRecord.facility?.name ?? ""),
      esc2(calc.activityRecord.sourceDescription ?? ""),
      esc2(String(calc.originalAmount)),
      esc2(calc.originalUnit),
      esc2(String(calc.normalizedAmount)),
      esc2(calc.normalizedUnit),
      esc2(calc.factorLibraryVersion),
      esc2(calc.methodologyVersionName),
      calc.co2 != null ? Number(calc.co2).toFixed(6) : "",
      calc.ch4 != null ? Number(calc.ch4).toFixed(6) : "",
      calc.n2o != null ? Number(calc.n2o).toFixed(6) : "",
      calc.biogenicCo2e != null ? Number(calc.biogenicCo2e).toFixed(6) : "",
      kg.toFixed(6),
      (kg / 1000).toFixed(6),
      esc2(calc.formula),
    ].join(","));
  }
  return Buffer.from(lines.join("\n"), "utf-8");
}
