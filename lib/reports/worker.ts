// Reports worker — generates PDF + CSV for a Report from its PublishedSnapshot.
// PDF via Puppeteer (headless Chromium), CSV built directly from EmissionCalculation
// rows of the snapshot's calculation run. Totals here must match dashboard totals
// for the same snapshot — both derive from the same calculation run.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { putObject, keys } from "@/lib/storage";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import { renderReportHtml, type ReportData } from "./template";

const SCOPE_LABELS: Record<number, string> = {
  1: "Scope 1 — Direct emissions",
  2: "Scope 2 — Purchased energy",
  3: "Scope 3 — Value chain",
};

export async function processReport(reportId: string, orgId: string): Promise<void> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      organization: { select: { name: true } },
      reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
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
    },
  });

  if (report.organizationId !== orgId) {
    throw new Error("Org mismatch on report job.");
  }
  if (report.status === "ready") return; // idempotent re-delivery

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "generating" },
  });

  try {
    const calculations = await prisma.emissionCalculation.findMany({
      where: {
        organizationId: orgId,
        calculationRunId: report.snapshot.calculationRunId,
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

    // ── Aggregate by scope and category ───────────────────────────────────────
    const scopeTotals = new Map<number, { totalKg: number; count: number }>();
    const categoryTotals = new Map<string, { name: string; scope: number; totalKg: number; count: number }>();
    const facilityTotals = new Map<string, { totalKg: number; count: number }>();
    let grandTotalKg = 0;

    for (const calc of calculations) {
      const kg = Number(calc.totalCo2e);
      const scope = calc.activityRecord.emissionCategory.scope;
      const catName = calc.activityRecord.emissionCategory.name;
      grandTotalKg += kg;

      const s = scopeTotals.get(scope) ?? { totalKg: 0, count: 0 };
      s.totalKg += kg;
      s.count += 1;
      scopeTotals.set(scope, s);

      const c = categoryTotals.get(catName) ?? { name: catName, scope, totalKg: 0, count: 0 };
      c.totalKg += kg;
      c.count += 1;
      categoryTotals.set(catName, c);

      const facName = calc.activityRecord.facility?.name ?? "Unassigned";
      const f = facilityTotals.get(facName) ?? { totalKg: 0, count: 0 };
      f.totalKg += kg;
      f.count += 1;
      facilityTotals.set(facName, f);
    }

    const data: ReportData = {
      orgName: report.organization.name,
      reportType: report.type,
      periodLabel: report.reportingPeriod.label,
      periodStart: report.reportingPeriod.startDate,
      periodEnd: report.reportingPeriod.endDate,
      snapshotVersion: report.snapshot.version,
      publishedAt: report.snapshot.publishedAt,
      publishedBy: report.snapshot.publishedBy.name ?? report.snapshot.publishedBy.email,
      factorLibrary: `${report.snapshot.calculationRun.factorLibrary.name} ${report.snapshot.calculationRun.factorLibrary.version}`,
      methodology: report.snapshot.calculationRun.methodologyVersion.name,
      gwpVersion: report.snapshot.calculationRun.methodologyVersion.gwpVersion,
      grandTotalKg,
      recordCount: calculations.length,
      scopes: [1, 2, 3].map((scope) => ({
        scope,
        label: SCOPE_LABELS[scope],
        totalKg: scopeTotals.get(scope)?.totalKg ?? 0,
        count: scopeTotals.get(scope)?.count ?? 0,
      })),
      categories: [...categoryTotals.values()].sort((a, b) => b.totalKg - a.totalKg),
      facilities: [...facilityTotals.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.totalKg - a.totalKg),
    };

    // ── CSV export ─────────────────────────────────────────────────────────────
    const csvBuffer = buildCsv(calculations, data);
    const csvKey = keys.reportCsv(orgId, reportId);
    const csvChecksum = createHash("sha256").update(csvBuffer).digest("hex");
    await putObject(csvKey, csvBuffer, "text/csv");

    // ── PDF via Puppeteer ──────────────────────────────────────────────────────
    const html = renderReportHtml(data);
    const pdfBuffer = await renderPdf(html);
    const pdfKey = keys.reportPdf(orgId, reportId);
    const pdfChecksum = createHash("sha256").update(pdfBuffer).digest("hex");
    await putObject(pdfKey, pdfBuffer, "application/pdf");

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "ready",
        pdfStorageKey: pdfKey,
        csvStorageKey: csvKey,
        pdfChecksum,
        csvChecksum,
        publishedAt: new Date(),
      },
      select: { createdByUserId: true, type: true },
    });

    enqueueNotification({
      type: "report_ready",
      recipientUserId: updated.createdByUserId,
      orgId,
      resourceId: reportId,
      metadata: { reportLabel: `${updated.type.replaceAll("_", " ")} — ${data.periodLabel}` },
    }).catch((err) => console.error("[reports] Failed to enqueue notification:", err));
  } catch (err) {
    console.error(`[reports] Error generating report ${reportId}:`, err);
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "failed" },
    });
    throw err;
  }
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
  totalCo2e: unknown;
  formula: string;
};

function buildCsv(calculations: CalcRow[], data: ReportData): Buffer {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  const lines: string[] = [
    `# ${data.orgName} — GHG emissions export`,
    `# Period: ${data.periodLabel} | Snapshot v${data.snapshotVersion} | Factors: ${data.factorLibrary} | Methodology: ${data.methodology} (GWP ${data.gwpVersion})`,
    [
      "scope",
      "category_code",
      "category_name",
      "facility",
      "source_description",
      "original_amount",
      "original_unit",
      "normalized_amount",
      "normalized_unit",
      "factor_library_version",
      "methodology",
      "total_kg_co2e",
      "total_t_co2e",
      "formula",
    ].join(","),
  ];

  for (const calc of calculations) {
    const kg = Number(calc.totalCo2e);
    lines.push(
      [
        calc.activityRecord.emissionCategory.scope,
        esc(calc.activityRecord.emissionCategory.code),
        esc(calc.activityRecord.emissionCategory.name),
        esc(calc.activityRecord.facility?.name ?? ""),
        esc(calc.activityRecord.sourceDescription ?? ""),
        esc(String(calc.originalAmount)),
        esc(calc.originalUnit),
        esc(String(calc.normalizedAmount)),
        esc(calc.normalizedUnit),
        esc(calc.factorLibraryVersion),
        esc(calc.methodologyVersionName),
        kg.toFixed(6),
        (kg / 1000).toFixed(6),
        esc(calc.formula),
      ].join(","),
    );
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}
