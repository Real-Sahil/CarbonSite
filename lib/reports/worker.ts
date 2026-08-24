import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { putObject, keys } from "@/lib/storage";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import type { ReportData } from "./template";
import { fetchCalculations, aggregate, buildBasePdfData, loadLogoDataUri } from "./aggregation";
import { getReportHandler, type ReportContext } from "./registry";
import { generateReportPdf } from "./pdf-generator";

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

export async function processReport(reportId: string, orgId: string): Promise<void> {
  console.log(`[reports] processReport START: reportId=${reportId}, orgId=${orgId}`);
  try {
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: REPORT_INCLUDE,
    });
    console.log(`[reports] Report loaded: type=${report.type}, status=${report.status}`);

    if (report.organizationId !== orgId) throw new Error("Org mismatch on report job.");
    if (report.status === "ready") return;

    await prisma.report.update({ where: { id: reportId }, data: { status: "generating" } });

    try {
      const { html, pdfkitData, xmlBuffer } = await renderForType(report);

      let csvBuffer: Buffer | null = null;
      if (report.type !== "national_toms" && report.type !== "cbam") {
        const calculations = await fetchCalculations(orgId, report.snapshot.calculationRunId, report.contractId ?? undefined);
        csvBuffer = buildCsv(calculations, report);
      }

      const pdfBuffer = pdfkitData
        ? await generateReportPdf(pdfkitData)
        : await renderPdf(html);
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

      let xmlKey: string | undefined;
      let xmlChecksum: string | undefined;
      if (xmlBuffer) {
        xmlKey = keys.reportXml(orgId, reportId);
        xmlChecksum = createHash("sha256").update(xmlBuffer).digest("hex");
        await putObject(xmlKey, xmlBuffer, "application/xml");
      }

      const updated = await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "ready",
          pdfStorageKey: pdfKey,
          csvStorageKey: csvKey ?? null,
          xmlStorageKey: xmlKey ?? null,
          pdfChecksum,
          csvChecksum: csvChecksum ?? null,
          xmlChecksum: xmlChecksum ?? null,
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
  } catch (err) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "failed" } }).catch(() => {});
    throw err;
  }
}

async function renderForType(report: ReportWithIncludes): Promise<{ html: string; pdfkitData?: ReportData; xmlBuffer?: Buffer }> {
  const orgId = report.organizationId;
  const runId = report.snapshot.calculationRunId;
  const opts = (report.options ?? {}) as Record<string, unknown>;
  const logoDataUri = await loadLogoDataUri(report.organization.branding?.reportHeaderLogoKey);

  const calcs = report.type !== "national_toms"
    ? await fetchCalculations(orgId, runId, report.contractId ?? undefined)
    : [];

  const agg = aggregate(calcs);
  const factorLibrary = `${report.snapshot.calculationRun.factorLibrary.name} ${report.snapshot.calculationRun.factorLibrary.version}`;
  const methodology = report.snapshot.calculationRun.methodologyVersion.name;
  const gwpVersion = report.snapshot.calculationRun.methodologyVersion.gwpVersion;
  const publishedBy = report.snapshot.publishedBy.name ?? report.snapshot.publishedBy.email;

  const basePdfData = await buildBasePdfData(
    report, agg, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion,
  );

  const ctx: ReportContext = {
    orgId,
    reportId: report.id,
    calcs,
    agg,
    basePdfData,
    opts,
    logoDataUri,
    factorLibrary,
    methodology,
    gwpVersion,
    publishedBy,
    report: {
      type: report.type,
      organizationId: report.organizationId,
      contractId: report.contractId,
      reportingPeriodId: report.reportingPeriodId,
      organization: report.organization,
      reportingPeriod: report.reportingPeriod,
      snapshot: {
        version: report.snapshot.version,
        publishedAt: report.snapshot.publishedAt,
        calculationRunId: report.snapshot.calculationRunId,
      },
      contract: report.contract,
    },
  };

  const handler = getReportHandler(report.type);
  return handler(ctx);
}

async function renderPdf(html: string): Promise<Buffer> {
  let browser: import("puppeteer-core").Browser | import("puppeteer").Browser | null = null;
  try {
    if (process.env.VERCEL) {
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteer = (await import("puppeteer-core")).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "22mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width:100%;padding:0 14mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;font-size:8pt;color:#9ca3af;border-top:1px solid #e5e7eb;">
          <span>Generated by CarbonSite</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser?.close();
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
