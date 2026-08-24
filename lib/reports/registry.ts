import { prisma } from "@/lib/db";
import type { ReportData } from "./template";
import { renderReportHtml } from "./template";
import type { Aggregation, CalculationRow } from "./aggregation";
import { splitScope2 } from "./aggregation";
import { renderSecrHtml, type SecrData } from "./templates/secr";
import { renderPpn0621Html, type Ppn0621Data } from "./templates/ppn-0621";
import { renderNhsEvergreenHtml, type NhsEvergreenData } from "./templates/nhs-evergreen";
import { renderNationalTomsHtml, type NationalTomsData, type TomsThemeSummary } from "./templates/national-toms";
import { renderBreeamEvidenceHtml, type BreeamData } from "./templates/breeam-evidence";
import { renderCsrdEsrsE1Html, type CsrdEsrsE1Data } from "./templates/csrd-esrs-e1";
import { renderContractCarbonHtml, type ContractCarbonData } from "./templates/contract-carbon";
import { renderGhgProtocolHtml, type GhgProtocolData } from "./templates/ghg-protocol";
import { renderCdpHtml, type CdpData } from "./templates/cdp";
import { renderCbamHtml, type CbamHtmlData } from "./templates/cbam";
import { generateCbamXml, type CbamReportData, type CbamGoodsItem, MATERIAL_TO_CN } from "./cbam-xml";
import { renderPpn006CrpHtml, type Ppn006CrpData, type CrpScopeRow } from "./templates/ppn-006-crp";

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
    snapshot: { version: number; publishedAt: Date; calculationRunId: string };
    contract: { name: string } | null;
  };
};

export type ReportResult = {
  html: string;
  pdfkitData?: ReportData;
  xmlBuffer?: Buffer;
};

type ReportHandler = (ctx: ReportContext) => Promise<ReportResult>;

const handlers: Record<string, ReportHandler> = {
  secr: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
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
      scope1Tonnes: agg.s1kg / 1000,
      scope2Tonnes: agg.s2kg / 1000,
      totalTonnes: (agg.s1kg + agg.s2kg) / 1000,
      intensityMetric: String(opts.intensityMetric ?? "tCO₂e per employee"),
      intensityValue: intensityValue > 0 ? (agg.s1kg + agg.s2kg) / 1000 / intensityValue : 0,
      intensityDenominator: String(opts.intensityDenominator ?? ""),
      efficiencyMeasures: Array.isArray(opts.efficiencyMeasures) ? opts.efficiencyMeasures as string[] : [],
      recordCount: calcs.length,
    };
    return { html: renderSecrHtml(data), pdfkitData: basePdfData };
  },

  ppn_06_21: async (ctx) => {
    const { agg, opts, basePdfData, report, calcs, orgId, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion } = ctx;
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

    const svRecords = await prisma.socialValueRecord.findMany({
      where: { organizationId: orgId, contractId, reportingPeriodId: report.reportingPeriodId },
      include: {
        measure: { include: { theme: { select: { code: true, name: true } } } },
      },
      orderBy: { measure: { tomsCode: "asc" } },
    });

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
    const { agg, opts, basePdfData, report, orgId, logoDataUri} = ctx;
    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId },
      select: { name: true, expectedImpactCo2e: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const scopeRows: CrpScopeRow[] = [...agg.catTotals.values()].map((c) => ({
      scope: c.scope as 1 | 2 | 3,
      category: c.name,
      kgCo2e: c.totalKg,
    }));

    const baselineTonnes = opts.baselineTonnes !== undefined ? Number(opts.baselineTonnes) : undefined;
    const baselineKgS1 = opts.baselineScope1Kg !== undefined ? Number(opts.baselineScope1Kg) : undefined;
    const baselineKgS2 = opts.baselineScope2Kg !== undefined ? Number(opts.baselineScope2Kg) : undefined;
    const baselineKgS3 = opts.baselineScope3Kg !== undefined ? Number(opts.baselineScope3Kg) : undefined;

    const crpTargets = Array.isArray(opts.targets)
      ? (opts.targets as Array<{ year: number; reductionPct: number; description?: string }>)
      : [];

    const data: Ppn006CrpData = {
      orgName: report.organization.name,
      logoDataUri,
      periodLabel: report.reportingPeriod.label,
      baselineYear: Number(opts.baselineYear ?? 2019),
      reportingYear: report.reportingPeriod.endDate.getFullYear(),
      scope1Kg: agg.s1kg,
      scope2Kg: agg.s2kg,
      scope3Kg: agg.s3kg,
      scope1BaselineKg: baselineKgS1 ?? (baselineTonnes ? baselineTonnes * 1000 * 0.4 : undefined),
      scope2BaselineKg: baselineKgS2 ?? (baselineTonnes ? baselineTonnes * 1000 * 0.3 : undefined),
      scope3BaselineKg: baselineKgS3 ?? (baselineTonnes ? baselineTonnes * 1000 * 0.3 : undefined),
      scopeRows,
      targets: crpTargets,
      signatoryName: opts.signatoryName as string | undefined,
      signatoryTitle: opts.signatoryTitle as string | undefined,
      signatoryDate: opts.signatoryDate as string | undefined,
      netZeroYear: opts.netZeroYear !== undefined ? Number(opts.netZeroYear) : 2050,
      methodologyNotes: opts.methodologyNotes as string | undefined,
    };
    void initiatives;
    return { html: renderPpn006CrpHtml(data), pdfkitData: basePdfData };
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
};

export function getReportHandler(reportType: string): ReportHandler {
  return handlers[reportType] ?? defaultHandler;
}

const defaultHandler: ReportHandler = async (ctx) => {
  const html = renderReportHtml(ctx.basePdfData);
  return { html, pdfkitData: ctx.basePdfData };
};
