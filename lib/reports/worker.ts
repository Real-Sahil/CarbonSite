import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { putObject, keys } from "@/lib/storage";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import { reportLogger } from "@/lib/logger";
import { triggerReportReadyNotification } from "@/lib/automation/n8n-client";
import type { ReportData } from "./template";
import { fetchCalculations, aggregate, buildBasePdfData, loadLogoDataUri } from "./aggregation";
import { getReportHandler, type ReportContext } from "./registry";
import { generateReportPdf, stampAuditMetadata, addQrCodeToFooter, addLogoToHeader } from "./pdf-generator";
import { generateAuditNarrative } from "./narrative-generator";
import { llmClient } from "@/lib/llm/client";

const REPORT_SELECT = {
  id: true,
  organizationId: true,
  reportingPeriodId: true,
  snapshotId: true,
  type: true,
  status: true,
  options: true,
  contractId: true,
  createdByUserId: true,
  organization: {
    select: {
      name: true,
      branding: { select: { reportHeaderLogoKey: true } },
    },
  },
  reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
  contract: { select: { name: true } },
  snapshot: {
    select: {
      calculationRunId: true,
      version: true,
      publishedAt: true,
      calculationRun: {
        select: {
          factorLibrary: { select: { name: true, version: true } },
          methodologyVersion: { select: { name: true, gwpVersion: true } },
        },
      },
      publishedBy: { select: { name: true, email: true } },
    },
  },
  createdBy: { select: { name: true, email: true } },
} as const;

type ReportWithIncludes = Prisma.ReportGetPayload<{ select: typeof REPORT_SELECT }>;

export async function processReport(reportId: string, orgId: string): Promise<void> {
  reportLogger.info("Report processing started", { reportId, orgId });
  let report: ReportWithIncludes | null = null;

  try {
    report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      select: REPORT_SELECT,
    });
    reportLogger.info("Report loaded", { reportId, type: report.type, status: report.status });

    if (report.organizationId !== orgId) {
      const error = new Error("Org mismatch on report job.");
      reportLogger.error("Organization mismatch on report job", {
        reportId,
        expectedOrgId: orgId,
        actualOrgId: report.organizationId,
      });
      throw error;
    }
    if (report.status === "ready") {
      reportLogger.info("Report already ready, skipping", { reportId });
      return;
    }

    await prisma.report.update({ where: { id: reportId }, data: { status: "generating" } });
    reportLogger.info("Report status updated to generating", { reportId });

    let pdfKey: string | null = null;
    let csvKey: string | null = null;
    let xmlKey: string | null = null;

    try {
      const { html, pdfkitData, xmlBuffer, logoDataUri } = await renderForType(report);
      reportLogger.info("Report rendering complete", {
        reportId,
        hasPdfKitData: !!pdfkitData,
        hasLogo: !!logoDataUri,
      });

      let csvBuffer: Buffer | null = null;
      // Non-GHG report types have no EmissionCalculation rows to export.
      if (report.type !== "national_toms" && report.type !== "cbam"
        && report.type !== "csrd_esrs_e3" && report.type !== "csrd_esrs_e5"
        && report.type !== "ecology_scan" && report.type !== "ecology_survey") {
        const calculations = await fetchCalculations(orgId, report.snapshot.calculationRunId, report.contractId ?? undefined);
        csvBuffer = buildCsv(calculations, report);
        reportLogger.info("CSV buffer built", {
          reportId,
          csvSizeBytes: csvBuffer.length,
        });
      }

      const rawPdfBuffer = pdfkitData
        ? await generateReportPdf(pdfkitData)
        : await renderPdf(html);
      const pdfChecksum = createHash("sha256").update(rawPdfBuffer).digest("hex");
      reportLogger.info("PDF generated", {
        reportId,
        pdfSizeBytes: rawPdfBuffer.length,
        checksum: pdfChecksum,
      });

      // Create verification token (expires in 90 days)
      const verificationTokenData = await prisma.reportVerificationToken.upsert({
        where: { reportId },
        update: {},
        create: {
          reportId,
          organizationId: orgId,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      reportLogger.info("Verification token created", {
        reportId,
        tokenPreview: verificationTokenData.token.slice(0, 8),
        expiresAt: verificationTokenData.expiresAt,
      });

      // Construct verification URL — must point to the web app, NOT Supabase or a raw API endpoint.
      // Resolution order:
      //   1. NEXT_PUBLIC_APP_URL (explicit app domain, set in Vercel env)
      //   2. VERCEL_URL (auto-set by Vercel to the deployment hostname, without protocol)
      //   3. Error — can't build a valid URL without either.
      let rawUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();

      // Reject Supabase project URLs that were mistakenly set as the app URL.
      if (rawUrl.includes("supabase.co")) {
        reportLogger.warn("NEXT_PUBLIC_APP_URL points to Supabase — falling back to VERCEL_URL", { rawUrl });
        rawUrl = "";
      }

      if (!rawUrl || !rawUrl.startsWith("http")) {
        // Vercel sets VERCEL_URL to the hostname of the current deployment (no protocol).
        const vercelHost = (process.env.VERCEL_URL || "").trim();
        if (vercelHost) {
          rawUrl = `https://${vercelHost}`;
        }
      }

      const baseUrl = rawUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");

      if (!baseUrl || !baseUrl.startsWith("http")) {
        throw new Error(
          "NEXT_PUBLIC_APP_URL not configured correctly for QR code generation. " +
          `Expected absolute URL (e.g., https://example.com), got: "${baseUrl}"`
        );
      }

      // QR code points to public verification page, NOT API endpoint
      const verificationUrl = `${baseUrl}/public/reports/verify/${verificationTokenData.token}`;

      let pdfBuffer = rawPdfBuffer;

      // Add logo to header for Puppeteer-rendered reports (not pdfkit, which includes logo in HTML)
      if (!pdfkitData && logoDataUri) {
        pdfBuffer = await addLogoToHeader(pdfBuffer, logoDataUri);
        reportLogger.info("Logo added to header", { reportId });
      }

      pdfBuffer = await stampAuditMetadata(pdfBuffer, {
        snapshotId: report.snapshot.calculationRunId,
        methodologyVersion: report.snapshot.calculationRun.methodologyVersion?.name ?? "—",
        sha256: pdfChecksum,
        generatedAt: new Date(),
        orgId,
      });
      reportLogger.info("Audit metadata stamped", {
        reportId,
        methodology: report.snapshot.calculationRun.methodologyVersion?.name ?? "—",
      });

      // Add QR code to PDF footer
      pdfBuffer = await addQrCodeToFooter(pdfBuffer, {
        verificationUrl,
        verificationTokenId: verificationTokenData.id,
      });
      reportLogger.info("QR code added to footer", {
        reportId,
        verificationTokenId: verificationTokenData.id,
        qrCodeUrl: verificationUrl,
      });

      // Store PDF with validation
      pdfKey = keys.reportPdf(orgId, reportId);
      reportLogger.info("Storing PDF to R2", {
        reportId,
        storageKey: pdfKey,
      });
      await putObject(pdfKey, pdfBuffer, "application/pdf");
      reportLogger.info("PDF stored successfully", {
        reportId,
        storageKey: pdfKey,
        sizeBytes: pdfBuffer.length,
      });

      let csvChecksum: string | undefined;
      if (csvBuffer) {
        csvKey = keys.reportCsv(orgId, reportId);
        csvChecksum = createHash("sha256").update(csvBuffer).digest("hex");
        reportLogger.info("Storing CSV to R2", {
          reportId,
          storageKey: csvKey,
        });
        await putObject(csvKey, csvBuffer, "text/csv");
        reportLogger.info("CSV stored successfully", {
          reportId,
          storageKey: csvKey,
          checksum: csvChecksum,
          sizeBytes: csvBuffer.length,
        });
      }

      let xmlChecksum: string | undefined;
      if (xmlBuffer) {
        xmlKey = keys.reportXml(orgId, reportId);
        xmlChecksum = createHash("sha256").update(xmlBuffer).digest("hex");
        reportLogger.info("Storing XML to R2", {
          reportId,
          storageKey: xmlKey,
        });
        await putObject(xmlKey, xmlBuffer, "application/xml");
        reportLogger.info("XML stored successfully", {
          reportId,
          storageKey: xmlKey,
          checksum: xmlChecksum,
          sizeBytes: xmlBuffer.length,
        });
      }

      // Validate storage keys exist before marking ready
      if (!pdfKey) {
        throw new Error("PDF storage key is null - storage write may have failed silently");
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
      reportLogger.info("Report status updated to ready", {
        reportId,
        reportType: updated.type,
      });

      enqueueNotification({
        type: "report_ready",
        recipientUserId: updated.createdByUserId,
        orgId,
        resourceId: reportId,
        metadata: { reportLabel: `${updated.type.replaceAll("_", " ")} — ${report.reportingPeriod.label}` },
      }).catch((err) =>
        reportLogger.error("Failed to enqueue notification", {
          reportId,
          error: err instanceof Error ? err.message : String(err),
        })
      );

      // Trigger n8n workflow for report-ready notifications
      await triggerReportReadyNotification(
        orgId,
        reportId,
        updated.type,
        report.createdBy.email
      ).catch((err) => reportLogger.error("Failed to trigger n8n workflow", {
        reportId,
        error: err instanceof Error ? err.message : String(err),
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : "";
      reportLogger.error("Error generating report", {
        reportId,
        orgId,
        error: errorMsg,
        stack: errorStack,
      });

      try {
        await prisma.report.update({
          where: { id: reportId },
          data: { status: "failed", errorMessage: errorMsg }
        });
        reportLogger.info("Report status set to failed", { reportId });
      } catch (updateErr) {
        reportLogger.error("Failed to update report status to failed", {
          reportId,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }
      throw err;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    reportLogger.error("Unhandled error in processReport", {
      reportId,
      orgId,
      error: errorMsg,
      stack: errorStack,
      reportNotFound: report === null,
    });

    try {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "failed", errorMessage: errorMsg }
      });
      reportLogger.info("Report status set to failed from outer catch", { reportId });
    } catch (updateErr) {
      reportLogger.error("Failed to update report status in outer catch", {
        reportId,
        error: updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    }
    throw err;
  }
}

async function renderForType(report: ReportWithIncludes): Promise<{ html: string; pdfkitData?: ReportData; xmlBuffer?: Buffer; logoDataUri?: string }> {
  const orgId = report.organizationId;
  const runId = report.snapshot.calculationRunId;
  const opts = (report.options ?? {}) as Record<string, unknown>;
  const auditEventFilter = (opts.auditEventFilter as string[] | undefined) ?? undefined;
  const logoDataUri = await loadLogoDataUri(report.organization.branding?.reportHeaderLogoKey);

  // Ecology report types don't use emission calculations — they query
  // EcologicalScan / BiodiversityAssessment directly by org.
  const isEcologyType = report.type === "ecology_scan" || report.type === "ecology_survey";

  const calcs = !isEcologyType && report.type !== "national_toms"
    ? await fetchCalculations(orgId, runId, report.contractId ?? undefined)
    : [];

  const agg = aggregate(calcs);
  const factorLibrary = `${report.snapshot.calculationRun.factorLibrary?.name ?? "—"} ${report.snapshot.calculationRun.factorLibrary?.version ?? ""}`.trim();
  const methodology = report.snapshot.calculationRun.methodologyVersion?.name ?? "—";
  const gwpVersion = report.snapshot.calculationRun.methodologyVersion?.gwpVersion ?? "—";
  const publishedBy = report.snapshot.publishedBy.name ?? report.snapshot.publishedBy.email;

  const basePdfData = await buildBasePdfData(
    report, agg, calcs, logoDataUri, publishedBy, factorLibrary, methodology, gwpVersion, auditEventFilter,
  );

  // Ecology report types carry no GHG emission calculations — basePdfData has
  // all-zero values, so an LLM narrative would reference "0.00 tCO2e" and be
  // meaningless. Skip narrative for those types.
  const noNarrativeTypes = new Set(["national_toms", "cbam", "ecology_scan", "ecology_survey"]);
  if (llmClient.isConfigured() && !noNarrativeTypes.has(report.type)) {
    reportLogger.info("LLM configured, generating audit narrative", {
      reportId: report.id,
      reportType: report.type,
    });
    try {
      basePdfData.narrative = await generateAuditNarrative(basePdfData);
      reportLogger.info("Narrative generation completed", {
        reportId: report.id,
        hasSummary: !!basePdfData.narrative?.executive_summary,
        findingsCount: basePdfData.narrative?.key_findings?.length ?? 0,
      });
    } catch (err) {
      reportLogger.error("Failed to generate narrative", {
        reportId: report.id,
        error: err instanceof Error ? err.message : String(err),
        hint: "Check if HUGGINGFACE_TOKEN is set and valid",
      });
      // Continue without narrative rather than failing the entire report
    }
  } else {
    reportLogger.info("Skipping narrative generation", {
      reportId: report.id,
      isConfigured: llmClient.isConfigured(),
      reportType: report.type,
      reason: !llmClient.isConfigured() ? "LLM not configured" : "Report type excludes narratives",
    });
  }

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
  const result = await handler(ctx);
  return { ...result, logoDataUri };
}

async function resolveLocalChromiumPath(): Promise<string | undefined> {
  const { existsSync } = await import("fs");
  // Explicit override wins
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (envPath && existsSync(envPath)) return envPath;
  // Playwright pre-installed Chromium (cloud / CI runners)
  for (const p of ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"]) {
    if (existsSync(p)) return p;
  }
  // System Chromium
  const { execSync } = await import("child_process");
  for (const bin of ["google-chrome-stable", "google-chrome", "chromium-browser", "chromium"]) {
    try {
      const p = execSync(`which ${bin}`, { timeout: 2000 }).toString().trim();
      if (p && existsSync(p)) return p;
    } catch { /* not found */ }
  }
  return undefined;
}

async function renderPdf(html: string): Promise<Buffer> {
  let browser: import("puppeteer").Browser | null = null;
  try {
    const puppeteer = (await import("puppeteer")).default;

    let executablePath: string | undefined;

    if (process.env.VERCEL) {
      // On Vercel: use @sparticuz/chromium which bundles pre-built binaries in node_modules
      // These binaries ship with the npm package and are available at runtime in the Lambda
      try {
        const chromium = (await import("@sparticuz/chromium")).default;
        executablePath = await chromium.executablePath();
        reportLogger.info("Using @sparticuz/chromium on Vercel", { executablePath });
      } catch (importErr) {
        const errMsg = importErr instanceof Error ? importErr.message : String(importErr);
        reportLogger.error("Failed to load @sparticuz/chromium", { error: errMsg });
        throw new Error(
          `@sparticuz/chromium not available on Vercel: ${errMsg}`
        );
      }
    } else {
      // Find executable: prefer Puppeteer's own Chromium, fall back to system / Playwright.
      try {
        const candidate = await puppeteer.executablePath();
        const { existsSync } = await import("fs");
        if (existsSync(candidate)) {
          executablePath = candidate;
        } else {
          executablePath = await resolveLocalChromiumPath();
        }
      } catch {
        executablePath = await resolveLocalChromiumPath();
      }
    }

    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      reportLogger.info("Puppeteer launched successfully", {
        isVercel: !!process.env.VERCEL,
        executablePath,
      });
    } catch (launchErr) {
      const errMsg = launchErr instanceof Error ? launchErr.message : String(launchErr);
      if (process.env.VERCEL) {
        reportLogger.error("Chromium launch failed on Vercel", {
          error: errMsg,
          executablePath,
        });
        throw new Error(
          `PDF rendering unavailable on Vercel: ${errMsg}`
        );
      } else {
        if (errMsg.includes("ENOENT") || errMsg.includes("spawn")) {
          throw new Error(
            `Chromium not found. Tried: ${executablePath ? executablePath : "system paths"}.\n` +
            "Install Chromium: apt-get install chromium-browser (Linux) or download via `npx puppeteer browsers install chrome`. " +
            `Original error: ${errMsg}`
          );
        }
        throw launchErr;
      }
    }
    const page = await browser.newPage();
    // Set timeout to 60s to handle large tables (ecology reports with 200+ species)
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    reportLogger.info("HTML content loaded in Puppeteer", { timeout: "60s" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "20mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: false,
    });
    reportLogger.info("PDF rendered successfully", { pdfSizeBytes: Buffer.from(pdf).length });
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
