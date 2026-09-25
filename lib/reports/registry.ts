import { prisma } from "@/lib/db";
import { summariseTiers } from "@/lib/data-quality/evidence-tier";
import { countsTowardHeadline, scope2MethodOf } from "@/lib/calculation/scope2-method";
import type { ReportData } from "./template";
import { renderReportHtml } from "./template";
import type { Aggregation, CalculationRow } from "./aggregation";
import { splitScope2 } from "./aggregation";
import { wasteHierarchyOf } from "@/lib/waste/hierarchy";
import { renderSecrHtml, type SecrData } from "./templates/secr";
import { secrEnergyFromCalculations } from "./secr-energy";
import { parseSections as parseCrpSections, planTargets, BOUNDARY_APPROACHES, type CrpSections } from "@/lib/crp/plan";
import { PPN_SCOPE3_CATEGORIES } from "@/lib/bids/carbon-pack";
import { renderPpn0621Html, type Ppn0621Data } from "./templates/ppn-0621";
import { renderNhsEvergreenHtml, type NhsEvergreenData } from "./templates/nhs-evergreen";
import { renderNationalTomsHtml, type NationalTomsData, type TomsThemeSummary } from "./templates/national-toms";
import { renderBreeamEvidenceHtml, type BreeamData } from "./templates/breeam-evidence";
import { renderCsrdEsrsE1Html, type CsrdEsrsE1Data } from "./templates/csrd-esrs-e1";
import { renderCsrdEsrsE3Html, type CsrdEsrsE3Data } from "./templates/csrd-esrs-e3";
import { renderCsrdEsrsE5Html, type CsrdEsrsE5Data } from "./templates/csrd-esrs-e5";
import { renderContractCarbonHtml, type ContractCarbonData } from "./templates/contract-carbon";
import { renderGhgProtocolHtml, type GhgProtocolData } from "./templates/ghg-protocol";
import { renderCdpHtml, type CdpData } from "./templates/cdp";
import { renderCbamHtml, type CbamHtmlData } from "./templates/cbam";
import { generateCbamXml, type CbamReportData, type CbamGoodsItem, MATERIAL_TO_CN } from "./cbam-xml";
import { renderPpn006CrpHtml, type Ppn006CrpData, type CrpScopeRow } from "./templates/ppn-006-crp";
import { renderEcologySurveyHtml, type EcologySurveyData, type EcologySurveyAssessment } from "./templates/ecology-survey";
import { renderEcologyScanHtml, type EcologyScanReportData, type EcologyScanRecord, type EcologyScanSpecies, type EcologyScanSite, type EcologyScanWoodland } from "./templates/ecology-scan";
import { llmClient } from "@/lib/llm/client";
import { renderBidCarbonPackHtml } from "./templates/bid-carbon-pack";
import { loadBidPackData } from "@/lib/bids/carbon-pack";
import { renderTransitionPlanHtml } from "./templates/transition-plan";
import { loadTransitionPlan } from "@/lib/transition-plan/load";

function withQueryTimeout<T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database query timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export type ReportContext = {
  orgId: string;
  reportId: string;
  calcs: CalculationRow[];
  agg: Aggregation;
  basePdfData: ReportData;
  opts: Record<string, unknown>;
  logoDataUri?: string;
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
  publishedBy: string;
  report: {
    type: string;
    organizationId: string;
    contractId: string | null;
    reportingPeriodId: string;
    organization: { name: string };
    reportingPeriod: { label: string; startDate: Date; endDate: Date };
    snapshot: { id: string; version: number; publishedAt: Date; calculationRunId: string };
    contract: { name: string } | null;
  };
};

export type ReportResult = {
  html: string;
  pdfkitData?: ReportData;
  xmlBuffer?: Buffer;
  /** Stamp the opt-in "Figures calculated from records in MetricOra" line. */
  verificationLine?: boolean;
};

type ReportHandler = (ctx: ReportContext) => Promise<ReportResult>;

const handlers: Record<string, ReportHandler> = {
  secr: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const intensityValue = Number(opts.intensityDenominatorValue ?? 0);
    // Energy comes from the run's own records unless the report form gives it.
    const energy = secrEnergyFromCalculations(calcs);
    const kwhOpt = (v: unknown, fallback: number) => (v !== undefined && v !== null && v !== "" ? Number(v) : fallback);
    const gasKwh = kwhOpt(opts.gasKwh, energy.gasKwh);
    const electricityKwh = kwhOpt(opts.electricityKwh, energy.electricityKwh);
    const transportFuelKwh = kwhOpt(opts.transportFuelKwh, energy.transportFuelKwh);
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
      gasKwh,
      electricityKwh,
      transportFuelKwh,
      totalUkEnergyKwh: kwhOpt(opts.totalUkEnergyKwh, gasKwh + electricityKwh + transportFuelKwh),
      energyRecordsNotConverted: energy.unconverted,
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      totalTonnes: (agg.s1kg + agg.s2kg) / 1000,
      // The form gives the denominator and its amount for the period, e.g.
      // "employee" and 250; the ratio is Scope 1 and 2 tonnes over it.
      intensityMetric: `tCO₂e per ${String(opts.intensityDenominator ?? "unit")}`,
      intensityValue: intensityValue > 0 ? (agg.s1kg + agg.s2kg) / 1000 / intensityValue : 0,
      intensityDenominator: intensityValue > 0 ? `${intensityValue.toLocaleString("en-GB")} ${String(opts.intensityDenominator ?? "")}`.trim() : "",
      efficiencyMeasures: Array.isArray(opts.efficiencyMeasures) ? opts.efficiencyMeasures as string[] : [],
      recordCount: calcs.length,
    };
    return { html: renderSecrHtml(data), pdfkitData: basePdfData };
  },

  ppn_06_21: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, orgId, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const initiatives = await withQueryTimeout(
      prisma.reductionInitiative.findMany({
        where: { organizationId: orgId },
        select: { name: true, expectedImpactCo2e: true, status: true },
        orderBy: { createdAt: "asc" },
      })
    );
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      scope3Tonnes: agg.s3kg / 1000,
      totalTonnes: agg.grandKg / 1000,
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
      scopesReported: ["Scope 1", "Scope 2", agg.s3kg > 0 ? "Scope 3" : null].filter(Boolean) as string[],
      recordCount: calcs.length,
    };
    return { html: renderPpn0621Html(data), pdfkitData: basePdfData };
  },

  nhs_evergreen: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, orgId, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const initiatives = await withQueryTimeout(
      prisma.reductionInitiative.findMany({
        where: { organizationId: orgId, status: { not: "canceled" } },
        select: { name: true, status: true },
        orderBy: { createdAt: "asc" },
      })
    );
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      totalTonnes: agg.grandKg / 1000,
      netZeroTargetYear: Number(opts.netZeroTargetYear ?? 2050),
      accountableOfficerName: opts.accountableOfficerName as string | undefined,
      accountableOfficerTitle: opts.accountableOfficerTitle as string | undefined,
      initiatives: initiatives.map((i) => ({ name: i.name, status: i.status })),
      recordCount: calcs.length,
    };
    return { html: renderNhsEvergreenHtml(data), pdfkitData: basePdfData };
  },

  national_toms: async (ctx) => {
    const { basePdfData, report, orgId, logoDataUri, publishedBy } = ctx;
    const contractId = report.contractId;
    if (!contractId) throw new Error("national_toms report requires a contractId.");

    const svRecords = await withQueryTimeout(
      prisma.socialValueRecord.findMany({
        where: { organizationId: orgId, contractId, reportingPeriodId: report.reportingPeriodId },
        include: {
          measure: { include: { theme: { select: { code: true, name: true } } } },
        },
        orderBy: { measure: { tomsCode: "asc" } },
      })
    );

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

    const contract = await withQueryTimeout(
      prisma.contract.findUnique({ where: { id: contractId }, select: { name: true } })
    );
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
    return { html: renderNationalTomsHtml(data), pdfkitData: basePdfData };
  },

  breeam_evidence: async (ctx) => {
    const { agg, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      scope3Tonnes: agg.s3kg / 1000,
      totalTonnes: agg.grandKg / 1000,
      recordCount: calcs.length,
      categories: [...agg.catTotals.values()],
    };
    return { html: renderBreeamEvidenceHtml(data), pdfkitData: basePdfData };
  },

  csrd_esrs_e1: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const { s2lbKg, s2mbKg } = splitScope2(calcs);
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2LocationTonnes: s2lbKg / 1000,
      scope2MarketTonnes: s2mbKg / 1000,
      scope3Tonnes: agg.s3kg / 1000,
      totalTonnes: agg.grandKg / 1000,
      recordCount: calcs.length,
      co2Tonnes: agg.hasCo2 ? agg.totalCo2Kg / 1000 : undefined,
      ch4Tonnes: agg.hasCh4 ? agg.totalCh4Kg / 1000 : undefined,
      n2oTonnes: agg.hasN2o ? agg.totalN2oKg / 1000 : undefined,
      biogenicCo2Tonnes: agg.hasBiogenic ? agg.totalBiogenicKg / 1000 : undefined,
      netZeroTargetYear: opts.netZeroTargetYear !== undefined ? Number(opts.netZeroTargetYear) : undefined,
      baselineYear: opts.baselineYear as string | undefined,
      baselineTonnes: opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined,
      interimTargetYear: opts.interimTargetYear !== undefined ? Number(opts.interimTargetYear) : undefined,
      interimReductionPct: opts.interimReductionPct !== undefined ? Number(opts.interimReductionPct) : undefined,
      categories: [...agg.catTotals.values()],
    };
    return { html: renderCsrdEsrsE1Html(data), pdfkitData: basePdfData };
  },

  // Water (ESRS E3) and waste (ESRS E5) read WaterRecord/WasteRecord
  // directly rather than the calcs/agg the GHG handlers above use — those
  // are EmissionCalculation-shaped (kg CO2e), and water has no CO2e figure
  // at all. This reflects the org's current data for the period, not the
  // locked published snapshot the GHG reports use (Phase 1 simplification;
  // see lib/calculation/environmental-metrics.ts).
  csrd_esrs_e3: async (ctx) => {
    const { report, logoDataUri, publishedBy } = ctx;
    const [waterRecords, facilities] = await Promise.all([
      withQueryTimeout(
        prisma.waterRecord.findMany({
          where: { organizationId: ctx.orgId, reportingPeriodId: report.reportingPeriodId },
          include: { facility: { select: { name: true, waterStressLevel: true } } },
        })
      ),
      withQueryTimeout(
        prisma.facility.findMany({
          where: { organizationId: ctx.orgId },
          select: { id: true, name: true, waterStressLevel: true },
        })
      ),
    ]);

    const byFacility = new Map<string, { name: string; withdrawalM3: number; dischargeM3: number; consumptionM3: number; waterStressLevel: string | null }>();
    for (const f of facilities) {
      byFacility.set(f.id, { name: f.name, withdrawalM3: 0, dischargeM3: 0, consumptionM3: 0, waterStressLevel: f.waterStressLevel });
    }

    let withdrawalM3 = 0, dischargeM3 = 0, consumptionM3 = 0, withdrawalStressedM3 = 0;
    for (const r of waterRecords) {
      const vol = Number(r.volumeM3);
      const bucket = byFacility.get(r.facilityId);
      if (r.metricType === "withdrawal") {
        withdrawalM3 += vol;
        if (bucket) bucket.withdrawalM3 += vol;
        if (r.isWaterStressedArea) withdrawalStressedM3 += vol;
      } else if (r.metricType === "discharge") {
        dischargeM3 += vol;
        if (bucket) bucket.dischargeM3 += vol;
      } else {
        consumptionM3 += vol;
        if (bucket) bucket.consumptionM3 += vol;
      }
    }

    const data: CsrdEsrsE3Data = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      withdrawalM3, dischargeM3, consumptionM3, withdrawalStressedM3,
      recordCount: waterRecords.length,
      facilities: [...byFacility.values()].filter((f) => f.withdrawalM3 || f.dischargeM3 || f.consumptionM3),
    };
    return { html: renderCsrdEsrsE3Html(data) };
  },

  csrd_esrs_e5: async (ctx) => {
    const { report, logoDataUri, publishedBy } = ctx;
    const [wasteRecords, facilities] = await Promise.all([
      withQueryTimeout(
        prisma.wasteRecord.findMany({
          where: { organizationId: ctx.orgId, reportingPeriodId: report.reportingPeriodId },
        })
      ),
      withQueryTimeout(
        prisma.facility.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true } })
      ),
    ]);

    const hierarchyOf = wasteHierarchyOf;

    const byFacility = new Map<string, { name: string; generatedTonnes: number; hazardousTonnes: number }>();
    for (const f of facilities) byFacility.set(f.id, { name: f.name, generatedTonnes: 0, hazardousTonnes: 0 });

    const byRoute = new Map<string, number>();
    let totalGeneratedTonnes = 0, totalHazardousTonnes = 0;
    for (const r of wasteRecords) {
      const tonnes = Number(r.weightTonnes);
      totalGeneratedTonnes += tonnes;
      if (r.hazardous) totalHazardousTonnes += tonnes;
      byRoute.set(r.disposalRoute, (byRoute.get(r.disposalRoute) ?? 0) + tonnes);
      if (r.facilityId) {
        const bucket = byFacility.get(r.facilityId);
        if (bucket) {
          bucket.generatedTonnes += tonnes;
          if (r.hazardous) bucket.hazardousTonnes += tonnes;
        }
      }
    }
    const totalDivertedTonnes = [...byRoute.entries()]
      .filter(([route]) => hierarchyOf(route) !== "landfill")
      .reduce((sum, [, tonnes]) => sum + tonnes, 0);

    const data: CsrdEsrsE5Data = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      totalGeneratedTonnes, totalDivertedTonnes, totalHazardousTonnes,
      recordCount: wasteRecords.length,
      byDisposalRoute: [...byRoute.entries()].map(([route, tonnes]) => ({ route, tonnes, hierarchy: hierarchyOf(route) })),
      facilities: [...byFacility.values()].filter((f) => f.generatedTonnes > 0),
    };
    return { html: renderCsrdEsrsE5Html(data) };
  },

  contract_carbon: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      scope3Tonnes: agg.s3kg / 1000,
      totalTonnes: agg.grandKg / 1000,
      recordCount: calcs.length,
      contractValueGbp: opts.contractValueGbp !== undefined ? Number(opts.contractValueGbp) : undefined,
      categories: [...agg.catTotals.values()],
    };
    return { html: renderContractCarbonHtml(data), pdfkitData: basePdfData };
  },

  ghg_protocol: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const { s2lbKg, s2mbKg } = splitScope2(calcs);
    const ghgCategoryRows = [...agg.catTotals.values()].map((c) => ({
      code: agg.catCodeMap.get(c.name) ?? "",
      name: c.name,
      scope: c.scope,
      totalKg: c.totalKg,
    }));

    const baselineTonnes = opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined;
    const reductionPct =
      baselineTonnes !== undefined && baselineTonnes > 0
        ? ((baselineTonnes - agg.grandKg / 1000) / baselineTonnes) * 100
        : undefined;

    const data: GhgProtocolData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Kg: agg.s1kg,
      scope2LocationKg: s2lbKg,
      scope2MarketKg: s2mbKg,
      scope3Kg: agg.s3kg,
      totalKg: agg.grandKg,
      co2Kg: agg.hasCo2 ? agg.totalCo2Kg : undefined,
      ch4Kg: agg.hasCh4 ? agg.totalCh4Kg : undefined,
      n2oKg: agg.hasN2o ? agg.totalN2oKg : undefined,
      biogenicCo2Kg: agg.hasBiogenic ? agg.totalBiogenicKg : undefined,
      recordCount: calcs.length,
      evidenceTiers: headlineEvidenceTiers(calcs),
      categories: ghgCategoryRows,
      baselineYear: opts.baselineYear as string | undefined,
      baselineTonnes,
      reductionPct,
    };
    return { html: renderGhgProtocolHtml(data), pdfkitData: basePdfData };
  },

  cdp: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const { s2lbKg, s2mbKg } = splitScope2(calcs);
    const cdpCategoryRows = [...agg.catTotals.values()].map((c) => ({
      code: agg.catCodeMap.get(c.name) ?? "",
      name: c.name,
      scope: c.scope,
      totalKg: c.totalKg,
    }));

    const data: CdpData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      factorLibrary, methodology, gwpVersion,
      scope1Tonnes: agg.s1kg / 1000,
      scope2LocationTonnes: s2lbKg / 1000,
      scope2MarketTonnes: s2mbKg / 1000,
      scope3Tonnes: agg.s3kg / 1000,
      totalTonnes: agg.grandKg / 1000,
      co2Tonnes: agg.hasCo2 ? agg.totalCo2Kg / 1000 : undefined,
      ch4Tonnes: agg.hasCh4 ? agg.totalCh4Kg / 1000 : undefined,
      n2oTonnes: agg.hasN2o ? agg.totalN2oKg / 1000 : undefined,
      biogenicCo2Tonnes: agg.hasBiogenic ? agg.totalBiogenicKg / 1000 : undefined,
      recordCount: calcs.length,
      categories: cdpCategoryRows,
      netZeroTargetYear: opts.netZeroTargetYear !== undefined ? Number(opts.netZeroTargetYear) : undefined,
      baselineYear: opts.baselineYear as string | undefined,
      baselineTonnes: opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined,
      revenueGbp: opts.revenueGbp !== undefined ? Number(opts.revenueGbp) : undefined,
      employeeCount: opts.employeeCount !== undefined ? Number(opts.employeeCount) : undefined,
    };
    return { html: renderCdpHtml(data), pdfkitData: basePdfData };
  },

  ppn_006_crp: async (ctx) => {
    const { agg, opts, basePdfData, report, orgId, logoDataUri, factorLibrary, methodology, gwpVersion } = ctx;
    const [baseYear, sbti] = await withQueryTimeout(
      Promise.all([
        prisma.baseYear.findFirst({
          where: { organizationId: orgId, status: "active" },
          orderBy: { createdAt: "desc" },
          include: { reportingPeriod: { select: { endDate: true } } },
        }),
        prisma.sbtiTarget.findUnique({
          where: { organizationId: orgId },
          select: { baseYear: true, nearTermYear: true, nearTermReductionPct: true, netZeroYear: true, netZeroReductionPct: true },
        }),
      ])
    );

    const scopeRows: CrpScopeRow[] = [...agg.catTotals.values()].map((c) => ({
      scope: c.scope as 1 | 2 | 3,
      category: c.name,
      kgCo2e: c.totalKg,
    }));

    // Baseline per scope: explicit options first, else the org's active base
    // year (stored in tonnes). Never apportioned from a total: a CRP is a
    // published procurement document and every figure must be measured.
    const optKg = (v: unknown) => (v !== undefined ? Number(v) : undefined);
    const baseKg = (v: { toString(): string } | null | undefined) => (v != null ? Number(v) * 1000 : undefined);

    // Targets given on the report form win; otherwise the organisation's
    // science-based target (near term and net zero) is printed.
    // A plan prepared in the guided flow supplies its own sections. It must
    // belong to this organisation and this report's period.
    const planRow = typeof opts.crpPlanId === "string"
      ? await withQueryTimeout(
          prisma.carbonReductionPlan.findFirst({
            where: { id: opts.crpPlanId, organizationId: orgId, reportingPeriodId: report.reportingPeriodId },
            select: { sections: true },
          }),
        )
      : null;
    const plan = planRow ? parseCrpSections(planRow.sections) : null;

    const crpTargets = plan ? planTargets(plan) : Array.isArray(opts.targets)
      ? (opts.targets as Array<{ year: number; reductionPct: number; description?: string }>)
      : sbti
        ? [
            { year: sbti.nearTermYear, reductionPct: Number(sbti.nearTermReductionPct), description: "Near-term target" },
            { year: sbti.netZeroYear, reductionPct: Number(sbti.netZeroReductionPct), description: "Net zero target" },
          ]
        : [];
    const baselineYear =
      opts.baselineYear !== undefined
        ? Number(opts.baselineYear)
        : (baseYear?.reportingPeriod.endDate.getFullYear() ?? sbti?.baseYear);

    const data: Ppn006CrpData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      baselineYear,
      reportingYear: report.reportingPeriod.endDate.getFullYear(),
      factorLibrary, methodology, gwpVersion,
      scope1Kg: agg.s1kg,
      scope2Kg: agg.s2kg,
      scope3Kg: agg.s3kg,
      scope1BaselineKg: optKg(opts.baselineScope1Kg) ?? baseKg(baseYear?.currentScope1Co2e ?? baseYear?.originalScope1Co2e),
      scope2BaselineKg: optKg(opts.baselineScope2Kg) ?? baseKg(baseYear?.currentScope2Co2e ?? baseYear?.originalScope2Co2e),
      scope3BaselineKg: optKg(opts.baselineScope3Kg) ?? baseKg(baseYear?.currentScope3Co2e ?? baseYear?.originalScope3Co2e),
      scopeRows,
      targets: crpTargets,
      signatoryName: plan ? plan.declaration.signatoryName || undefined : (opts.signatoryName as string | undefined),
      signatoryTitle: plan ? plan.declaration.signatoryTitle || undefined : (opts.signatoryTitle as string | undefined),
      signatoryDate: plan
        ? plan.declaration.signedDate
          ? new Date(`${plan.declaration.signedDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
          : undefined
        : (opts.signatoryDate as string | undefined),
      netZeroYear:
        plan && plan.targets.netZeroYear !== ""
          ? Number(plan.targets.netZeroYear)
          : opts.netZeroYear !== undefined
            ? Number(opts.netZeroYear)
            : (sbti?.netZeroYear ?? 2050),
      methodologyNotes: opts.methodologyNotes as string | undefined,
      plan: plan ? crpPlanForTemplate(plan, agg) : undefined,
    };
    return {
      html: renderPpn006CrpHtml(data),
      pdfkitData: basePdfData,
      verificationLine: plan?.organisation.showVerificationLine ?? false,
    };
  },

  bid_carbon_pack: async (ctx) => {
    const data = await withQueryTimeout(loadBidPackData(ctx.orgId, ctx.report.snapshot.id, ctx.opts), 60_000);
    return { html: renderBidCarbonPackHtml({ ...data, logoDataUri: ctx.logoDataUri }) };
  },

  transition_plan: async (ctx) => {
    const view = await withQueryTimeout(loadTransitionPlan(ctx.orgId), 60_000);
    return {
      html: renderTransitionPlanHtml({
        ...view,
        orgName: ctx.report.organization.name,
        snapshot: {
          version: ctx.report.snapshot.version,
          periodLabel: ctx.report.reportingPeriod.label,
          publishedAt: ctx.report.snapshot.publishedAt,
        },
        logoDataUri: ctx.logoDataUri,
      }),
    };
  },

  cbam: async (ctx) => {
    const { opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
    const purchasedGoodsCalcs = calcs.filter(
      (c) => c.activityRecord.emissionCategory.code === "s3-purchased-goods"
    );

    const cbamItemMap = new Map<string, CbamGoodsItem>();
    for (const calc of purchasedGoodsCalcs) {
      const desc = calc.activityRecord.sourceDescription ?? "Imported goods";
      const facilityName = calc.activityRecord.facility?.name ?? "";
      const key = `${desc}:${facilityName}`;
      const kg = Number(calc.totalCo2e);
      if (!cbamItemMap.has(key)) {
        const cnCode = MATERIAL_TO_CN["steel"];
        cbamItemMap.set(key, {
          cnCode,
          description: desc,
          quantityTonnes: 0,
          directEmbeddedCo2eTonnes: 0,
          indirectEmbeddedCo2eTonnes: 0,
          carbonPricePaidGbp: 0,
          installation: facilityName ? { name: facilityName, country: "XX" } : undefined,
        });
      }
      const item = cbamItemMap.get(key)!;
      item.directEmbeddedCo2eTonnes += (kg / 1000) * 0.7;
      item.indirectEmbeddedCo2eTonnes += (kg / 1000) * 0.3;
      item.quantityTonnes += kg / 1000 / 2;
    }

    const goodsItems: CbamGoodsItem[] = [...cbamItemMap.values()];
    const cbamReportData: CbamReportData = {
      declarantName: report.organization.name,
      declarantEori: opts.declarantEori as string | undefined,
      reportingPeriodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      submissionDate: report.snapshot.publishedAt,
      goodsItems,
    };
    const cbamHtmlData: CbamHtmlData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      declarantEori: opts.declarantEori as string | undefined,
      goodsItems,
      factorLibrary, methodology, gwpVersion,
    };
    const xmlString = generateCbamXml(cbamReportData);
    const xmlBuffer = Buffer.from(xmlString, "utf-8");
    return { html: renderCbamHtml(cbamHtmlData), xmlBuffer, pdfkitData: basePdfData };
  },

  ecology_survey: async (ctx) => {
    const { report, logoDataUri, publishedBy } = ctx;

    const [assessments, speciesCount] = await Promise.all([
      prisma.biodiversityAssessment.findMany({
        where: { organizationId: ctx.orgId },
        include: {
          project: { select: { name: true } },
          site: { select: { name: true } },
          _count: { select: { parcels: true, speciesRecords: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.protectedSpeciesRecord.count({ where: { organizationId: ctx.orgId } }),
    ]);

    const mapped: EcologySurveyAssessment[] = assessments.map((a) => ({
      id: a.id,
      name: a.name,
      reference: a.reference,
      projectName: a.project?.name ?? null,
      siteName: a.site?.name ?? null,
      assessmentDate: a.assessmentDate,
      ecologistName: a.ecologistName,
      ecologistOrganisation: a.ecologistOrganisation,
      planningAuthority: a.planningAuthority,
      planningReference: a.planningReference,
      metricVersion: a.metricVersion,
      status: a.status,
      meetsRequirement: a.meetsRequirement,
      baselineAreaUnits: Number(a.baselineAreaUnits),
      baselineHedgerowUnits: Number(a.baselineHedgerowUnits),
      baselineWatercourseUnits: Number(a.baselineWatercourseUnits),
      postAreaUnits: Number(a.postAreaUnits),
      postHedgerowUnits: Number(a.postHedgerowUnits),
      postWatercourseUnits: Number(a.postWatercourseUnits),
      parcelCount: a._count.parcels,
      speciesRecordCount: a._count.speciesRecords,
    }));

    let surveyNarrative: string | null = null;
    if (llmClient.isConfigured() && mapped.length > 0) {
      try {
        const meetCount = mapped.filter((a) => a.meetsRequirement).length;
        const prompt = `You are an ecology and biodiversity consultant writing a Biodiversity Net Gain (BNG) assessment summary for ${report.organization.name}.

Reporting period: ${report.reportingPeriod.label}
Total BNG assessments: ${mapped.length}
Assessments meeting 10% BNG requirement: ${meetCount} of ${mapped.length}
Total species records across all assessments: ${speciesCount}

Assessment details:
${mapped.map((a) => `- ${a.name}: ${a.meetsRequirement ? "Meets" : "Does not meet"} 10% BNG. Area units baseline/post: ${a.baselineAreaUnits.toFixed(3)}/${a.postAreaUnits.toFixed(3)}. Hedgerow: ${a.baselineHedgerowUnits.toFixed(3)}/${a.postHedgerowUnits.toFixed(3)}. Watercourse: ${a.baselineWatercourseUnits.toFixed(3)}/${a.postWatercourseUnits.toFixed(3)}.`).join("\n")}

Write a concise 2-3 paragraph executive summary of the biodiversity net gain performance, highlighting key findings, compliance status, and recommendations. Use professional, plain English suitable for a planning authority or sustainability report.`;
        const LLM_TIMEOUT_MS = 20_000;
        surveyNarrative = (await Promise.race([
          llmClient.complete(prompt, { maxTokens: 600, temperature: 0.3, reasoningEffort: 'low' }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`LLM narrative timeout after ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS),
          ),
        ])).text;
      } catch (err) {
        console.error("[ecology_survey] narrative generation failed:", err);
        // narrative is optional — proceed without it
      }
    }

    const data: EcologySurveyData = {
      orgName: report.organization.name,
      logoDataUri,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      reportingPeriodLabel: report.reportingPeriod.label,
      assessments: mapped,
      totalAssessments: mapped.length,
      meetingRequirementCount: mapped.filter((a) => a.meetsRequirement).length,
      totalSpeciesRecords: speciesCount,
      narrative: surveyNarrative,
    };
    return { html: renderEcologySurveyHtml(data) };
  },
  ecology_scan: async (ctx) => {
    const { report, logoDataUri, publishedBy } = ctx;

    let scans;
    try {
      scans = await withQueryTimeout(
        prisma.ecologicalScan.findMany({
          where: { organizationId: ctx.orgId, status: "completed" },
          include: { project: { select: { name: true } } },
          orderBy: { scannedAt: "desc" },
        }),
        60000 // 60s timeout for ecological scan query
      );
    } catch (err) {
      console.error("[ecology_scan] database query failed:", err instanceof Error ? err.message : String(err));
      throw new Error(`Failed to fetch ecological scans: ${err instanceof Error ? err.message : String(err)}`);
    }

    const mappedScans: EcologyScanRecord[] = scans.map((s) => {
      try {
        return {
          id: s.id,
          postcode: s.postcode,
          radiusKm: Number(s.radiusKm),
          scannedAt: s.scannedAt,
          projectName: s.project?.name ?? null,
          totalSpeciesCount: s.totalSpeciesCount,
          plantSpeciesCount: s.plantSpeciesCount,
          birdSpeciesCount: s.birdSpeciesCount,
          mammalSpeciesCount: s.mammalSpeciesCount,
          invertSpeciesCount: s.invertSpeciesCount,
          reptileSpeciesCount: s.reptileSpeciesCount,
          amphibianSpeciesCount: s.amphibianSpeciesCount,
          otherSpeciesCount: s.otherSpeciesCount,
          sssiCount: s.sssiCount,
          sacCount: s.sacCount,
          spaCount: s.spaCount,
          nvrCount: s.nvrCount,
          ancientWoodlandCount: s.ancientWoodlandCount,
          ramsarCount: s.ramsarCount,
          aonbCount: s.aonbCount,
          lnrCount: s.lnrCount,
          woodlandTotalHa: Number(s.woodlandTotalHa),
          broadleafHa: Number(s.broadleafHa),
          coniferHa: Number(s.coniferHa),
          mixedWoodlandHa: Number(s.mixedWoodlandHa),
          priorityHabitatHa: Number(s.priorityHabitatHa),
          designatedSites: Array.isArray(s.designatedSites) ? (s.designatedSites as unknown as EcologyScanSite[]) : [],
          woodlandData: Array.isArray(s.woodlandData) ? (s.woodlandData as unknown as EcologyScanWoodland[]) : [],
          speciesRecords: Array.isArray(s.speciesRecords) ? (s.speciesRecords as unknown as EcologyScanSpecies[]) : [],
        };
      } catch (err) {
        console.error("[ecology_scan] Error mapping scan record:", s.id, err);
        throw new Error(`Failed to map ecological scan ${s.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    let scanNarrative: string | null = null;
    if (llmClient.isConfigured() && mappedScans.length > 0) {
      try {
        const totalSpecies = mappedScans.reduce((sum, s) => sum + s.totalSpeciesCount, 0);
        const totalSssi = mappedScans.reduce((sum, s) => sum + s.sssiCount, 0);
        const totalAncientWoodland = mappedScans.reduce((sum, s) => sum + s.ancientWoodlandCount, 0);
        const totalWoodlandHa = mappedScans.reduce((sum, s) => sum + s.woodlandTotalHa, 0);
        const prompt = `You are an ecological consultant writing an NBN Atlas biodiversity scan summary for ${report.organization.name}.

Number of site scans: ${mappedScans.length}
Total species recorded across all sites: ${totalSpecies}
Total SSSIs within scan radii: ${totalSssi}
Ancient woodland sites: ${totalAncientWoodland}
Total woodland area: ${totalWoodlandHa.toFixed(1)} ha

Site scan breakdown:
${mappedScans.map((s) => `- ${s.projectName ?? s.postcode} (${s.postcode}, radius ${s.radiusKm}km): ${s.totalSpeciesCount} species (birds: ${s.birdSpeciesCount}, plants: ${s.plantSpeciesCount}, mammals: ${s.mammalSpeciesCount}), ${s.sssiCount} SSSIs, ${s.ancientWoodlandCount} ancient woodland sites, ${s.woodlandTotalHa.toFixed(1)} ha woodland.`).join("\n")}

Write a concise 2-3 paragraph executive summary of the ecological sensitivity findings, highlighting biodiversity richness, designated site constraints, woodland cover, and any material ecological risks that should inform planning or environmental management decisions. Use professional language suitable for an ecology report or Environmental Statement.`;
        const LLM_TIMEOUT_MS = 20_000;
        scanNarrative = (await Promise.race([
          llmClient.complete(prompt, { maxTokens: 600, temperature: 0.3, reasoningEffort: 'low' }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`LLM narrative timeout after ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS),
          ),
        ])).text;
      } catch (err) {
        console.error("[ecology_scan] narrative generation failed:", err);
        // narrative is optional — proceed without it
      }
    }
    const data: EcologyScanReportData = {
      orgName: report.organization.name,
      logoDataUri,
      publishedAt: report.snapshot.publishedAt,
      publishedBy,
      scans: mappedScans,
      narrative: scanNarrative,
    };

    try {
      const html = renderEcologyScanHtml(data);
      return { html };
    } catch (err) {
      console.error("[ecology_scan] HTML render failed:", err instanceof Error ? err.message : String(err));
      throw new Error(`Failed to render ecology scan HTML: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

export function getReportHandler(reportType: string): ReportHandler {
  return handlers[reportType] ?? defaultHandler;
}

/// True when a report type has its own HTML layout. The worker renders those
/// with headless Chromium and only falls back to the generic PDFKit report
/// (the handler's pdfkitData) when Chromium fails.
export function hasTypedTemplate(reportType: string): boolean {
  return Object.prototype.hasOwnProperty.call(handlers, reportType);
}

const defaultHandler: ReportHandler = async (ctx) => {
  const html = renderReportHtml(ctx.basePdfData);
  return { html, pdfkitData: ctx.basePdfData };
};

/** The guided plan's sections in the shape the PPN 006 template prints. */
function crpPlanForTemplate(p: CrpSections, agg: Aggregation): NonNullable<Ppn006CrpData["plan"]> {
  const kgByCode = new Map<string, number>();
  for (const c of agg.catTotals.values()) {
    const code = agg.catCodeMap.get(c.name);
    if (code) kgByCode.set(code, (kgByCode.get(code) ?? 0) + c.totalKg);
  }
  const named = (rows: CrpSections["measures"]["completed"]) =>
    rows.filter((m) => m.name.trim()).map((m) => ({ name: m.name, year: String(m.year), description: m.description, savingTco2e: String(m.savingTco2e) }));
  return {
    companyNumber: p.organisation.companyNumber,
    publicationUrl: p.organisation.publicationUrl,
    description: p.organisation.description,
    boundaryApproach: BOUNDARY_APPROACHES.find((b) => b.value === p.organisation.boundaryApproach)?.label ?? p.organisation.boundaryApproach,
    sitesIncluded: p.organisation.sitesIncluded,
    exclusions: p.organisation.exclusions.filter((e) => e.item.trim()).map((e) => ({ item: e.item, reason: e.reason })),
    baselineRationale: p.baseline.rationale,
    baselineDetails: p.baseline.additionalDetails,
    scope3: PPN_SCOPE3_CATEGORIES.map((c) => {
      const row = p.scope3.find((r) => r.code === c.code);
      const kg = kgByCode.get(c.code);
      return {
        label: c.label,
        tonnes: kg != null && kg > 0 ? kg / 1000 : null,
        status: kg != null && kg > 0 ? "reported" : (row?.status ?? "not_yet_measured"),
        explanation: row?.explanation ?? "",
      };
    }),
    sbtiValidated: p.targets.sbtiValidated,
    trajectoryNote: p.targets.trajectoryNote,
    completed: named(p.measures.completed),
    planned: named(p.measures.planned),
    futureNote: p.measures.futureNote,
    boardApproved: p.declaration.boardApproved,
  };
}

/** Percent of the headline total (market-based Scope 2 left out) by evidence tier. */
function headlineEvidenceTiers(calcs: ReportContext["calcs"]) {
  const split = summariseTiers(
    calcs
      .filter((c) => countsTowardHeadline(scope2MethodOf(c.activityRecord)))
      .map((c) => ({
        dataOrigin: c.activityRecord.dataOrigin,
        evidenceStatus: c.activityRecord.evidenceStatus,
        reviewStatus: c.activityRecord.reviewStatus,
        totalCo2e: Number(c.totalCo2e),
      })),
  );
  return { verified: split.verified.percent, partial: split.partial.percent, estimated: split.estimated.percent };
}
