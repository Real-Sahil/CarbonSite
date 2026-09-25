import { createHash } from "crypto";
import { factorAttribution, withAttribution } from "./attribution";
import { runFactorAttribution } from "./attribution-load";
import { Prisma, type Scope2Method } from "@prisma/client";
import { prisma } from "@/lib/db";
import { putObject, keys } from "@/lib/storage";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import { reportLogger } from "@/lib/logger";
import { triggerReportReadyNotification } from "@/lib/automation/n8n-client";
import type { ReportData } from "./template";
import { scope2MethodOf } from "@/lib/calculation/scope2-method";
import { fetchCalculations, aggregate, buildBasePdfData, loadLogoDataUri } from "./aggregation";
import { evidenceTier, type TierInput } from "@/lib/data-quality/evidence-tier";
import { getReportHandler, hasTypedTemplate, type ReportContext, type ReportResult } from "./registry";
import { generateReportPdf, stampAuditMetadata, addQrCodeToFooter, addLogoToHeader, addVerificationLine } from "./pdf-generator";
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
      branding: { select: { reportHeaderLogoKey: true, logoStorageKey: true } },
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
          factorLibrary: { select: { name: true, version: true, license: true, sourceUrl: true } },
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
      const rendered = await renderForType(report);
      const { pdfkitData, xmlBuffer } = rendered;
      // OGL v3 requires attribution wherever DEFRA/DESNZ factors are reused.
      const attribution = await runFactorAttribution(report.snapshot.calculationRunId, report.snapshot.calculationRun.factorLibrary);
      const html = withAttribution(rendered.html, attribution);
      if (pdfkitData) pdfkitData.factorAttribution = attribution ?? undefined;
      reportLogger.info("Report rendering complete", {
        reportId,
        hasPdfKitData: !!pdfkitData,
      });

      let csvBuffer: Buffer | null = null;
      // Non-GHG report types have no EmissionCalculation rows to export.
      if (report.type !== "national_toms" && report.type !== "cbam"
        && report.type !== "csrd_esrs_e3" && report.type !== "csrd_esrs_e5"
        && report.type !== "ecology_scan" && report.type !== "ecology_survey"
        && report.type !== "transition_plan") {
        const calculations = await fetchCalculations(orgId, report.snapshot.calculationRunId, report.contractId ?? undefined);
        csvBuffer = buildCsv(calculations, report, attribution);
        reportLogger.info("CSV buffer built", {
          reportId,
          csvSizeBytes: csvBuffer.length,
        });
      }

      // Types with their own layout render their HTML with Chromium; the
      // generic PDFKit report is the fallback if Chromium is unavailable, and
      // the renderer for the default types (inventory, monthly snapshot).
      const renderPdfKit = async () => {
        reportLogger.info("Starting pdfkit PDF generation", { reportId });
        const buffer = await Promise.race([
          generateReportPdf(pdfkitData!),
          new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error("PDF generation timeout after 45 seconds")), 45000)
          ),
        ]);
        reportLogger.info("PDFKit PDF generated successfully", { reportId, sizeBytes: buffer.length });
        return buffer;
      };
      const renderHtml = async () => {
        reportLogger.info("Starting Puppeteer PDF rendering", { reportId });
        const buffer = await Promise.race([
          renderPdf(html),
          new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error("PDF rendering timeout after 50 seconds")), 50000)
          ),
        ]);
        reportLogger.info("Puppeteer PDF rendered successfully", { reportId, sizeBytes: buffer.length });
        return buffer;
      };

      let rawPdfBuffer: Buffer;
      let usedPdfKit = false;
      if (!pdfkitData) {
        rawPdfBuffer = await renderHtml();
      } else if (hasTypedTemplate(report.type)) {
        try {
          rawPdfBuffer = await renderHtml();
        } catch (err) {
          reportLogger.warn("Chromium rendering failed, using the generic PDFKit report", {
            reportId,
            reportType: report.type,
            error: err instanceof Error ? err.message : String(err),
          });
          rawPdfBuffer = await renderPdfKit();
          usedPdfKit = true;
        }
      } else {
        rawPdfBuffer = await renderPdfKit();
        usedPdfKit = true;
      }

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

      let pdfBuffer = await stampAuditMetadata(rawPdfBuffer, {
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

      if (rendered.verificationLine) {
        pdfBuffer = await addVerificationLine(pdfBuffer, verificationUrl);
        reportLogger.info("Verification line added", { reportId });
      }

      // Add logo to header for HTML-rendered reports (ecology_scan, ecology_survey, etc.)
      // PDFKit reports already embed the logo in generateReportPdf
      const brandingKey = report.organization.branding?.reportHeaderLogoKey
        ?? report.organization.branding?.logoStorageKey;
      reportLogger.info("Checking logo for header", {
        reportId,
        hasBranding: !!report.organization.branding,
        brandingKey,
        isPdfkitReport: usedPdfKit,
      });
      const logoDataUri = brandingKey
        ? await loadLogoDataUri(brandingKey)
        : undefined;
      reportLogger.info("Logo loading result", {
        reportId,
        logoDataUriExists: !!logoDataUri,
        logoDataUriLength: logoDataUri?.length,
      });
      if (logoDataUri && !usedPdfKit) {
        pdfBuffer = await addLogoToHeader(pdfBuffer, logoDataUri);
        reportLogger.info("Logo added to header", { reportId });
      } else if (!logoDataUri && brandingKey && !usedPdfKit) {
        reportLogger.warn("Logo loading failed but branding key exists", {
          reportId,
          brandingKey,
        });
      }

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

async function renderForType(report: ReportWithIncludes): Promise<ReportResult> {
  const orgId = report.organizationId;
  const runId = report.snapshot.calculationRunId;
  const opts = (report.options ?? {}) as Record<string, unknown>;
  const auditEventFilter = (opts.auditEventFilter as string[] | undefined) ?? undefined;

  const branding = report.organization.branding;
  const logoKey = branding?.reportHeaderLogoKey ?? branding?.logoStorageKey;
  reportLogger.info("buildBasePdfData logo resolution", {
    reportId: report.id,
    hasBranding: !!branding,
    reportHeaderLogoKey: branding?.reportHeaderLogoKey ? "set" : "null",
    logoStorageKey: branding?.logoStorageKey ? "set" : "null",
    resolvedLogoKey: logoKey ? "has_key" : "null",
  });

  const logoDataUri = await loadLogoDataUri(logoKey);
  reportLogger.info("buildBasePdfData logoDataUri result", {
    reportId: report.id,
    loaded: !!logoDataUri,
    length: logoDataUri?.length,
  });

  // These types query their own tables directly — no EmissionCalculation rows.
  const isNonGhgType = report.type === "ecology_scan" || report.type === "ecology_survey"
    || report.type === "csrd_esrs_e3" || report.type === "csrd_esrs_e5"
    // The bid pack reads snapshot aggregates itself (lib/bids/carbon-pack.ts).
    || report.type === "bid_carbon_pack"
    // The transition plan reads its own pathway and published totals (lib/transition-plan/load.ts).
    || report.type === "transition_plan";

  const calcs = !isNonGhgType && report.type !== "national_toms"
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
  const noNarrativeTypes = new Set(["bid_carbon_pack", "transition_plan", "national_toms", "cbam", "ecology_scan", "ecology_survey", "csrd_esrs_e3", "csrd_esrs_e5"]);
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
        hint: "Check if NVIDIA_API_KEY is set and valid",
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
        id: report.snapshotId,
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
    let launchArgs: string[] = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

    if (process.env.VERCEL) {
      // Check for explicit override first (set CHROMIUM_PATH in Vercel env vars to bypass auto-detection)
      if (process.env.CHROMIUM_PATH) {
        executablePath = process.env.CHROMIUM_PATH;
        reportLogger.info("Using CHROMIUM_PATH env var override", { executablePath });
      } else {
        // Use @sparticuz/chromium-min: downloads binary from CDN into /tmp at runtime.
        // No binaries bundled in the package — keeps Lambda well under the 50 MB limit.
        // Set CHROMIUM_REMOTE_EXEC_PATH in Vercel env vars to override the CDN URL.
        try {
          const chromium = (await import("@sparticuz/chromium-min")).default;
          // v135+ uses architecture-specific pack naming (x64). Try arch-specific first, fall back to generic.
          const remoteUrl = process.env.CHROMIUM_REMOTE_EXEC_PATH ??
            "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";
          let chromiumPath: string | undefined;
          try {
            chromiumPath = await chromium.executablePath(remoteUrl);
          } catch {
            const fallbackUrl = "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar";
            chromiumPath = await chromium.executablePath(fallbackUrl);
          }
          executablePath = chromiumPath;
          // Use sparticuz-provided args — required for Lambda compatibility
          if (Array.isArray(chromium.args) && chromium.args.length > 0) {
            launchArgs = chromium.args as string[];
          }
          reportLogger.info("Using @sparticuz/chromium-min on Vercel", { executablePath, argsCount: launchArgs.length });
        } catch (sparticuzErr) {
          const errMsg = sparticuzErr instanceof Error ? sparticuzErr.message : String(sparticuzErr);
          reportLogger.warn("@sparticuz/chromium-min failed", { error: errMsg, stack: sparticuzErr instanceof Error ? sparticuzErr.stack : undefined });

          // Fallback: use Puppeteer's bundled Chromium
          try {
            const puppeteerExe = await puppeteer.executablePath();
            const { existsSync } = await import("fs");
            if (puppeteerExe && existsSync(puppeteerExe)) {
              executablePath = puppeteerExe;
              reportLogger.info("Fallback: using Puppeteer's bundled Chromium", { executablePath });
            } else {
              throw new Error(`Puppeteer executable path invalid or not found: ${puppeteerExe}`);
            }
          } catch (fallbackErr) {
            const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            reportLogger.error("All chromium sources exhausted on Vercel", {
              sparticuzError: errMsg,
              fallbackError: fallbackMsg,
              hint: "Set CHROMIUM_PATH or CHROMIUM_REMOTE_EXEC_PATH env vars in Vercel dashboard"
            });
            throw new Error(
              `Chromium unavailable on Vercel. chromium-min failed: ${errMsg}. Fallback failed: ${fallbackMsg}`
            );
          }
        }
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

    if (!executablePath) {
      reportLogger.error("No executable path found for Chromium on Vercel");
      throw new Error("Chromium executable path unavailable on Vercel. Check that @sparticuz/chromium is installed and Turbopack correctly marks it as external.");
    }

    try {
      reportLogger.info("Attempting to launch Puppeteer", {
        isVercel: !!process.env.VERCEL,
        executablePath,
      });

      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: launchArgs,
      });

      reportLogger.info("Puppeteer launched successfully", {
        isVercel: !!process.env.VERCEL,
        executablePath,
      });
    } catch (launchErr) {
      const errMsg = launchErr instanceof Error ? launchErr.message : String(launchErr);
      const stack = launchErr instanceof Error ? launchErr.stack : undefined;
      if (process.env.VERCEL) {
        reportLogger.error("Chromium launch failed on Vercel", {
          error: errMsg,
          stack,
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

    // Ecology reports with 200+ species records need longer timeout
    const isLargeHtml = html.length > 500000; // 500KB threshold
    const contentTimeout = isLargeHtml ? 90000 : 60000; // 90s for large, 60s for normal

    try {
      await page.setContent(html, { waitUntil: "load", timeout: contentTimeout });
      reportLogger.info("HTML content loaded in Puppeteer", {
        timeout: `${contentTimeout}ms`,
        htmlSizeBytes: html.length,
      });
    } catch (contentErr) {
      const errMsg = contentErr instanceof Error ? contentErr.message : String(contentErr);
      reportLogger.error("Failed to load HTML content in Puppeteer", {
        error: errMsg,
        htmlSizeBytes: html.length,
        timeout: `${contentTimeout}ms`,
      });
      throw new Error(`Puppeteer HTML rendering timeout or failure: ${errMsg}`);
    }

    let pdfData: Uint8Array;
    try {
      pdfData = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", bottom: "20mm", left: "14mm", right: "14mm" },
        displayHeaderFooter: false,
      });
    } catch (pdfErr) {
      const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      reportLogger.error("Failed to render PDF from HTML", {
        error: errMsg,
        htmlSizeBytes: html.length,
      });
      throw new Error(`Puppeteer PDF rendering failed: ${errMsg}`);
    }

    const pdf = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
    reportLogger.info("PDF rendered successfully", { pdfSizeBytes: pdf.length });
    return pdf;
  } finally {
    await browser?.close();
  }
}

type CalcRow = {
  activityRecord: {
    sourceDescription: string | null;
    scope2Method?: Scope2Method | null;
    emissionCategory: { code: string; name: string; scope: number };
    facility: { name: string } | null;
  } & TierInput;
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

function buildCsv(calculations: CalcRow[], report: { organization: { name: string }; reportingPeriod: { label: string }; snapshot: { version: number; calculationRun: { factorLibrary: { name: string; version: string; license?: string | null }; methodologyVersion: { name: string; gwpVersion: string } } } }, attribution: string | null = factorAttribution(report.snapshot.calculationRun.factorLibrary)): Buffer {
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
    `# Scope 2 is listed under both methods. Totals use location_based; do not add market_based to them.`,
    ...(attribution ? [`# ${attribution}`] : []),
    ["scope","scope2_method","category_code","category_name","facility","source_description","original_amount","original_unit","normalized_amount","normalized_unit","factor_library_version","methodology","co2_kg","ch4_kg_co2e","n2o_kg_co2e","biogenic_co2_kg","total_kg_co2e","total_t_co2e","formula","data_origin","evidence_status","review_status","evidence_tier"].join(","),
  ];
  for (const calc of calculations) {
    const kg = Number(calc.totalCo2e);
    lines.push([
      calc.activityRecord.emissionCategory.scope,
      scope2MethodOf(calc.activityRecord) ?? "",
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
      calc.activityRecord.dataOrigin,
      calc.activityRecord.evidenceStatus,
      calc.activityRecord.reviewStatus,
      evidenceTier(calc.activityRecord),
    ].join(","));
  }
  return Buffer.from(lines.join("\n"), "utf-8");
}
