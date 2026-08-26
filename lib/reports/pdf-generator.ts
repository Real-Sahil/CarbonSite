// Programmatic PDF generation using pdfkit — lighter than Puppeteer for
// straightforward reports, no headless Chromium required.
// Output: Buffer containing a valid PDF/A-compatible document.

import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { PDFDocument as PdfLib, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { ReportData } from "./template";

const MARGIN = 52;
const PAGE_W = 595.28; // A4 width in points
const BODY_W = PAGE_W - MARGIN * 2;

// Brand palette
const COLOR_DARK = "#111827";
const COLOR_MID = "#6B7280";
const COLOR_LIGHT = "#E5E7EB";
const COLOR_ACCENT = "#0EA5E9";
const SCOPE_COLORS: Record<number, string> = { 1: "#0f766e", 2: "#0ea5e9", 3: "#84cc16" };

function tonnes(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Generate a branded PDF report and return its contents as a Buffer.
 * This is a synchronous-stream-to-buffer helper — await the returned promise.
 */
export async function generateReportPdf(data: ReportData): Promise<Buffer> {
  const logoDataUri = data.logoDataUri;
  return new Promise((resolve, reject) => {
    let doc: PDFKit.PDFDocument;

    try {
      doc = new PDFDocument({
        size: "A4",
        margin: MARGIN,
        info: {
          Title: `${data.orgName} — ${data.periodLabel} GHG Emissions Report`,
          Author: data.publishedBy,
          Creator: "CarbonSite",
          CreationDate: new Date(data.publishedAt),
        },
        bufferPages: true,
      });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      console.error("[pdf-generator] PDFDocument initialization error:", {
        code: e?.code,
        errno: e?.errno,
        syscall: e?.syscall,
        path: e?.path,
        message: e?.message,
      });
      reject(new Error(`PDF initialization failed: ${String(e?.message ?? err)}`));
      return;
    }

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const totalPages = 1; // updated via doc.bufferedPageRange after rendering

    // ── Helpers ────────────────────────────────────────────────────────────────

    function hexToRgb(hex: string): [number, number, number] {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    }

    function fillColor(hex: string) { doc.fillColor(hexToRgb(hex)); }
    function strokeColor(hex: string) { doc.strokeColor(hexToRgb(hex)); }

    function setFont(fontName: string, size?: number) {
      try {
        if (size) {
          doc.fontSize(size).font(fontName);
        } else {
          doc.font(fontName);
        }
      } catch (err) {
        console.warn(`[pdf-generator] Font '${fontName}' not available, using Helvetica fallback:`, err);
        try {
          if (size) doc.fontSize(size);
          doc.font("Helvetica");
        } catch (fallbackErr) {
          console.warn("[pdf-generator] Helvetica fallback also failed, continuing without font:", fallbackErr);
        }
      }
    }

    function rule(y?: number, color = COLOR_LIGHT) {
      const yPos = y ?? doc.y;
      strokeColor(color);
      doc.moveTo(MARGIN, yPos).lineTo(MARGIN + BODY_W, yPos).lineWidth(0.5).stroke();
    }

    function moveDown(pts: number) { doc.moveDown(pts / doc.currentLineHeight(true)); }

    // ── Page header (called on each new page) ─────────────────────────────────

    function drawPageHeader() {
      const top = 20;
      // Logo
      if (logoDataUri) {
        try {
          const base64 = logoDataUri.split(",")[1] ?? logoDataUri;
          const imgBuf = Buffer.from(base64, "base64");
          doc.image(imgBuf, MARGIN, top, { height: 28, fit: [100, 28] });
        } catch {
          // Logo decode failed — render org name instead
          fillColor(COLOR_DARK);
          setFont("Helvetica-Bold", 10);
          doc.text(data.orgName, MARGIN, top + 6);
        }
      } else {
        fillColor(COLOR_DARK);
        setFont("Helvetica-Bold", 10);
        doc.text(data.orgName, MARGIN, top + 6);
      }

      // Right: report title
      fillColor(COLOR_MID);
      doc.fontSize(8);
      setFont("Helvetica");
      doc.text(`${data.periodLabel} GHG Emissions Report`, MARGIN, top + 10, {
        width: BODY_W,
        align: "right",
      });

      // Thin accent line below header
      strokeColor(COLOR_ACCENT);
      doc.moveTo(MARGIN, top + 34).lineTo(MARGIN + BODY_W, top + 34).lineWidth(1.5).stroke();

      doc.y = top + 48;
    }

    // ── Cover area ────────────────────────────────────────────────────────────

    drawPageHeader();

    // Report title block
    fillColor(COLOR_DARK);
    doc.fontSize(22);
    setFont("Helvetica-Bold");
    doc.text(
      data.orgName,
      MARGIN,
      doc.y,
      { width: BODY_W },
    );
    moveDown(6);

    fillColor(COLOR_MID);
    doc.fontSize(13);
    setFont("Helvetica");
    doc.text(
      `${data.periodLabel} GHG Emissions Report`,
      MARGIN,
      doc.y,
      { width: BODY_W },
    );
    moveDown(6);

    rule();
    moveDown(14);

    // Meta grid
    const metaItems: [string, string][] = [
      ["Report type", data.reportType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())],
      ["Period", `${shortDate(data.periodStart)} – ${shortDate(data.periodEnd)}`],
      ["Snapshot version", `v${data.snapshotVersion}`],
      ["Published", shortDate(new Date(data.publishedAt))],
      ["Published by", data.publishedBy],
      ["Methodology", data.methodology],
      ["Factor library", data.factorLibrary],
      ["GWP version", data.gwpVersion],
    ];

    const colW = BODY_W / 2 - 8;
    let metaX = MARGIN;
    let metaY = doc.y;
    metaItems.forEach(([label, value], i) => {
      if (i > 0 && i % 2 === 0) {
        metaY += 22;
        metaX = MARGIN;
      } else if (i % 2 === 1) {
        metaX = MARGIN + colW + 16;
      }
      fillColor(COLOR_MID);
      doc.fontSize(7.5);
      setFont("Helvetica");
      doc.text(label.toUpperCase(), metaX, metaY, { width: colW });
      fillColor(COLOR_DARK);
      doc.fontSize(9);
      setFont("Helvetica-Bold");
      doc.text(value, metaX, metaY + 9, { width: colW });
    });

    doc.y = metaY + 32;
    moveDown(10);

    // ── Grand total ────────────────────────────────────────────────────────────

    const grandTotalTonnes = (data.grandTotalKg / 1000).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Shaded summary box
    fillColor("#F0F9FF");
    doc.rect(MARGIN, doc.y, BODY_W, 64).fill();
    const boxTop = doc.y + 12;

    fillColor(COLOR_ACCENT);
    doc.fontSize(28);
    setFont("Helvetica-Bold");
    doc.text(`${grandTotalTonnes} tCO2e`, MARGIN + 16, boxTop, {
      width: BODY_W - 32,
    });

    fillColor(COLOR_MID);
    doc.fontSize(9);
    setFont("Helvetica");
    doc.text(
      `Total GHG emissions across ${data.recordCount.toLocaleString()} activity records`,
      MARGIN + 16,
      boxTop + 34,
      { width: BODY_W - 32 },
    );

    doc.y += 64;
    moveDown(18);

    // ── Scope breakdown ────────────────────────────────────────────────────────

    if (data.scopes.length > 0) {
      fillColor(COLOR_DARK);
      doc.fontSize(11);
      setFont("Helvetica-Bold");
      doc.text("Emissions by Scope", MARGIN, doc.y);
      moveDown(10);

      // Bar chart (horizontal)
      const maxScopeKg = Math.max(...data.scopes.map((s) => s.totalKg), 1);
      const BAR_H = 14;
      const BAR_GAP = 8;
      const LABEL_W = 68;
      const VALUE_W = 72;
      const BAR_W = BODY_W - LABEL_W - VALUE_W - 12;

      for (const scope of data.scopes) {
        const color = SCOPE_COLORS[scope.scope] ?? COLOR_ACCENT;
        const barLen = (scope.totalKg / maxScopeKg) * BAR_W;
        const y = doc.y;

        fillColor(COLOR_MID);
        doc.fontSize(8);
        setFont("Helvetica");
        doc.text(scope.label, MARGIN, y + 3, { width: LABEL_W });

        fillColor(color);
        doc.rect(MARGIN + LABEL_W, y, barLen, BAR_H).fill();

        // Track bar background
        fillColor(COLOR_LIGHT);
        doc.rect(MARGIN + LABEL_W + barLen, y, BAR_W - barLen, BAR_H).fill();

        fillColor(COLOR_DARK);
        doc.fontSize(8);
        setFont("Helvetica-Bold");
        doc.text(
          `${tonnes(scope.totalKg)} tCO2e`,
          MARGIN + LABEL_W + BAR_W + 6,
          y + 3,
          { width: VALUE_W },
        );

        doc.y += BAR_H + BAR_GAP;
      }
      moveDown(16);
    }

    // ── Category table ─────────────────────────────────────────────────────────

    if (data.categories.length > 0) {
      // Check if we need a new page
      if (doc.y > 600) {
        doc.addPage();
        drawPageHeader();
      }

      fillColor(COLOR_DARK);
      doc.fontSize(11);
      setFont("Helvetica-Bold");
      doc.text("Emissions by Category", MARGIN, doc.y);
      moveDown(10);

      // Table header
      const cols = {
        category: { x: MARGIN, w: 220 },
        scope: { x: MARGIN + 220, w: 50 },
        records: { x: MARGIN + 270, w: 60 },
        total: { x: MARGIN + 330, w: 100 },
        pct: { x: MARGIN + 430, w: 60 },
      };

      fillColor("#F9FAFB");
      doc.rect(MARGIN, doc.y, BODY_W, 18).fill();

      fillColor(COLOR_MID);
      doc.fontSize(7.5);
      setFont("Helvetica-Bold");
      for (const [key, col] of Object.entries(cols)) {
        const label = { category: "Category", scope: "Scope", records: "Records", total: "Total tCO2e", pct: "% of Total" }[key] ?? key;
        doc.text(label, col.x + 4, doc.y + 5, { width: col.w - 4 });
      }
      doc.y += 18;
      rule();

      for (const cat of data.categories) {
        if (doc.y > 720) {
          doc.addPage();
          drawPageHeader();
        }
        const pct = data.grandTotalKg > 0 ? ((cat.totalKg / data.grandTotalKg) * 100).toFixed(1) : "0.0";
        const rowY = doc.y + 4;

        fillColor(COLOR_DARK);
        doc.fontSize(8);
        setFont("Helvetica");
        doc.text(cat.name, cols.category.x + 4, rowY, { width: cols.category.w - 8 });
        doc.text(`Scope ${cat.scope}`, cols.scope.x + 4, rowY, { width: cols.scope.w - 4 });
        doc.text(cat.count.toLocaleString(), cols.records.x + 4, rowY, { width: cols.records.w - 4 });
        fillColor(COLOR_DARK);
        setFont("Helvetica-Bold");
        doc.text(tonnes(cat.totalKg), cols.total.x + 4, rowY, { width: cols.total.w - 4 });
        fillColor(COLOR_MID);
        setFont("Helvetica");
        doc.text(`${pct}%`, cols.pct.x + 4, rowY, { width: cols.pct.w - 4 });

        doc.y += 18;
        rule();
      }
      moveDown(18);
    }

    // ── Facility breakdown (if present) ───────────────────────────────────────

    if (data.facilities.length > 0) {
      if (doc.y > 600) {
        doc.addPage();
        drawPageHeader();
      }

      fillColor(COLOR_DARK);
      doc.fontSize(11);
      setFont("Helvetica-Bold");
      doc.text("Emissions by Facility", MARGIN, doc.y);
      moveDown(10);

      const facilCols = {
        name: { x: MARGIN, w: 270 },
        records: { x: MARGIN + 270, w: 60 },
        total: { x: MARGIN + 330, w: 100 },
      };

      fillColor("#F9FAFB");
      doc.rect(MARGIN, doc.y, BODY_W, 18).fill();

      fillColor(COLOR_MID);
      doc.fontSize(7.5);
      setFont("Helvetica-Bold");
      for (const [key, col] of Object.entries(facilCols)) {
        const label = { name: "Facility", records: "Records", total: "Total tCO2e" }[key] ?? key;
        doc.text(label, col.x + 4, doc.y + 5, { width: col.w - 4 });
      }
      doc.y += 18;
      rule();

      for (const fac of data.facilities) {
        if (doc.y > 720) {
          doc.addPage();
          drawPageHeader();
        }
        const rowY = doc.y + 4;
        fillColor(COLOR_DARK);
        doc.fontSize(8);
        setFont("Helvetica");
        doc.text(fac.name, facilCols.name.x + 4, rowY, { width: facilCols.name.w - 8 });
        doc.text(fac.count.toLocaleString(), facilCols.records.x + 4, rowY, { width: facilCols.records.w - 4 });
        setFont("Helvetica-Bold");
        doc.text(tonnes(fac.totalKg), facilCols.total.x + 4, rowY, { width: facilCols.total.w - 4 });
        doc.y += 18;
        rule();
      }
      moveDown(18);
    }

    // ── Top categories ranking ───────────────────────────────────────────────

    if (data.categories.length > 0) {
      if (doc.y > 600) {
        doc.addPage();
        drawPageHeader();
      }

      fillColor(COLOR_DARK);
      doc.fontSize(11);
      setFont("Helvetica-Bold");
      doc.text("Top Emission Sources", MARGIN, doc.y);
      moveDown(10);

      const topCats = [...data.categories]
        .sort((a, b) => b.totalKg - a.totalKg)
        .slice(0, 5);

      for (let i = 0; i < topCats.length; i++) {
        const cat = topCats[i];
        const pct = data.grandTotalKg > 0 ? ((cat.totalKg / data.grandTotalKg) * 100) : 0;
        const barWidth = (pct / 100) * 300;
        const y = doc.y;

        fillColor(COLOR_DARK);
        doc.fontSize(8);
        setFont("Helvetica");
        doc.text(`${i + 1}. ${cat.name}`, MARGIN, y, { width: 150 });

        fillColor(SCOPE_COLORS[cat.scope] ?? COLOR_ACCENT);
        doc.rect(MARGIN + 160, y + 2, barWidth, 8).fill();

        fillColor(COLOR_MID);
        doc.fontSize(7.5);
        doc.text(`${pct.toFixed(1)}% (${tonnes(cat.totalKg)} tCO2e)`, MARGIN + 470, y, { width: 70 });

        doc.y += 14;
      }
      moveDown(8);
    }

    // ── Audit trail & data reference ──────────────────────────────────────────

    if (doc.y > 650) {
      doc.addPage();
      drawPageHeader();
    }

    fillColor(COLOR_DARK);
    doc.fontSize(11);
    setFont("Helvetica-Bold");
    doc.text("Report Details & Audit Trail", MARGIN, doc.y);
    moveDown(10);

    const auditItems: [string, string][] = [
      ["Report ID", data.auditTrail?.calculationRunId ?? "N/A"],
      ["Generated At", shortDate(new Date(data.publishedAt))],
      ["Generated By", data.publishedBy],
      ["Snapshot Version", `v${data.snapshotVersion}`],
      ["Reporting Period", `${shortDate(data.periodStart)} – ${shortDate(data.periodEnd)}`],
      ["Records Processed", data.recordCount.toLocaleString()],
      ["Factor Library", data.factorLibrary],
      ["Methodology", data.methodology],
    ];

    for (const [key, value] of auditItems) {
      fillColor(COLOR_MID);
      doc.fontSize(7.5);
      setFont("Helvetica");
      doc.text(key, MARGIN, doc.y, { width: 120 });

      fillColor(COLOR_DARK);
      setFont("Helvetica-Bold");
      doc.text(value, MARGIN + 130, doc.y, { width: BODY_W - 140 });

      moveDown(7);
    }

    moveDown(6);

    // ── Methodology note ──────────────────────────────────────────────────────

    if (doc.y > 680) {
      doc.addPage();
      drawPageHeader();
    }

    moveDown(10);
    rule();
    moveDown(8);

    fillColor(COLOR_MID);
    doc.fontSize(7.5);
    setFont("Helvetica");
    doc.text(
      `Emissions calculated using ${data.factorLibrary} emission factors under ${data.methodology}. ` +
      `GWP values from ${data.gwpVersion} (CH4 = 27.9, N2O = 273). ` +
      `All values reported in tonnes CO2-equivalent (tCO2e). ` +
      (data.biogenicCo2eTonnes != null
        ? `Biogenic CO2: ${data.biogenicCo2eTonnes.toFixed(2)} tCO2e (reported separately, not included in totals). `
        : "") +
      `Generated by CarbonSite on ${shortDate(new Date(data.publishedAt))}.`,
      MARGIN,
      doc.y,
      { width: BODY_W, lineGap: 2 },
    );

    // ── Footer on every page ──────────────────────────────────────────────────

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pageNum = i + 1;
      const pageTotal = range.count;

      const footY = doc.page.height - 28;

      // Accent line above footer
      strokeColor(COLOR_LIGHT);
      doc.moveTo(MARGIN, footY - 6).lineTo(MARGIN + BODY_W, footY - 6).lineWidth(0.5).stroke();

      fillColor(COLOR_MID);
      doc.fontSize(7);
      setFont("Helvetica");

      doc.text(
        `${data.orgName} | ${data.periodLabel} | Generated ${shortDate(new Date(data.publishedAt))}`,
        MARGIN,
        footY,
        { width: BODY_W * 0.6 },
      );

      doc.text(`Page ${pageNum} of ${pageTotal}`, MARGIN, footY, {
        width: BODY_W,
        align: "right",
      });
    }

    doc.end();

    // Suppress TypeScript "totalPages unused" — it's updated after end()
    void totalPages;
  });
}

interface AuditMeta {
  snapshotId: string;
  methodologyVersion: string;
  sha256: string;
  generatedAt: Date;
  orgId: string;
}

/**
 * Stamp XMP metadata and a faint audit footer on every page of a PDF.
 * The sha256 passed in is the checksum of the original (pre-stamp) buffer.
 */
export async function stampAuditMetadata(pdfBytes: Buffer, meta: AuditMeta): Promise<Buffer> {
  const doc = await PdfLib.load(pdfBytes);

  const title = doc.getTitle();
  if (title) doc.setTitle(title);
  doc.setSubject(`Snapshot ${meta.snapshotId}`);
  doc.setKeywords([meta.snapshotId, meta.methodologyVersion, meta.sha256.slice(0, 16)]);
  doc.setProducer("CarbonSite");
  doc.setCreationDate(meta.generatedAt);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const shortSha = `${meta.sha256.slice(0, 16)}...`;
  const footerText = `CarbonSite · Snapshot ${meta.snapshotId.slice(0, 8)} · ${meta.methodologyVersion} · SHA-256: ${shortSha}`;
  const gray = rgb(0.608, 0.639, 0.686); // #9CA3AF

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    page.drawText(footerText, {
      x: 18,
      y: 10,
      size: 6,
      font,
      color: gray,
      maxWidth: width - 36,
    });
  }

  return Buffer.from(await doc.save());
}

interface QrMeta {
  verificationUrl: string;
  verificationTokenId: string;
}

export async function addQrCodeToFooter(pdfBytes: Buffer, meta: QrMeta): Promise<Buffer> {
  const doc = await PdfLib.load(pdfBytes);

  // Generate QR code as PNG data URL
  const qrDataUrl = await QRCode.toDataURL(meta.verificationUrl, {
    errorCorrectionLevel: "M",
    type: "image/png",
    width: 300,
    margin: 0,
  });

  // Convert data URL to PNG bytes
  const base64Data = qrDataUrl.split(",")[1];
  if (!base64Data) throw new Error("Failed to generate QR code");
  const qrPngBytes = Buffer.from(base64Data, "base64");

  // Embed PNG image in PDF
  const qrImage = await doc.embedPng(qrPngBytes);
  const qrSize = 50; // 50 points = ~18mm

  // Add QR code to bottom-right of footer on every page
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const margin = 18;

    // QR code positioned at bottom-right, above the footer text
    page.drawImage(qrImage, {
      x: width - margin - qrSize,
      y: height - margin - qrSize - 2,
      width: qrSize,
      height: qrSize,
    });

    // Small text label next to QR code
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const gray = rgb(0.608, 0.639, 0.686); // #9CA3AF
    page.drawText("Scan to verify", {
      x: width - margin - qrSize - 55,
      y: height - margin - qrSize + 10,
      size: 6,
      font,
      color: gray,
    });
  }

  return Buffer.from(await doc.save());
}
