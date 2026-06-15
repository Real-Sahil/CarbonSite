// HTML template for the PDF report. Pure function of ReportData — deterministic
// and testable without Puppeteer. All emission values stored in kg CO2e;
// displayed in tonnes (tCO2e) per GHG Protocol reporting convention.

import { brandStyles, brandLogoHtml } from "./templates/shared";

export type ReportData = {
  orgName: string;
  logoDataUri?: string;
  reportType: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  snapshotVersion: number;
  publishedAt: Date;
  publishedBy: string;
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
  grandTotalKg: number;
  recordCount: number;
  scopes: { scope: number; label: string; totalKg: number; count: number }[];
  categories: { name: string; scope: number; totalKg: number; count: number }[];
  facilities: { name: string; totalKg: number; count: number }[];
  biogenicCo2eTonnes?: number;
};

const REPORT_TYPE_TITLES: Record<string, string> = {
  inventory: "GHG Emissions Inventory",
  monthly_snapshot: "Monthly Emissions Snapshot",
  audit_package: "Audit Package — GHG Emissions",
};

const SCOPE_COLORS: Record<number, string> = {
  1: "#0f766e",
  2: "#0ea5e9",
  3: "#84cc16",
};

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tonnes(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0.0";
  return ((part / whole) * 100).toFixed(1);
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function renderReportHtml(data: ReportData): string {
  const title = REPORT_TYPE_TITLES[data.reportType] ?? "GHG Emissions Report";

  const scopeRows = data.scopes
    .map(
      (s) => `
      <tr>
        <td><span class="dot" style="background:${SCOPE_COLORS[s.scope]}"></span>${escapeHtml(s.label)}</td>
        <td class="num">${s.count}</td>
        <td class="num strong">${tonnes(s.totalKg)}</td>
        <td class="num">${pct(s.totalKg, data.grandTotalKg)}%</td>
      </tr>`,
    )
    .join("");

  const scopeBars = data.scopes
    .map((s) => {
      const width = data.grandTotalKg > 0 ? Math.max((s.totalKg / data.grandTotalKg) * 100, 0.5) : 0.5;
      return `
      <div class="bar-row">
        <div class="bar-label">Scope ${s.scope}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${SCOPE_COLORS[s.scope]}"></div></div>
        <div class="bar-value">${tonnes(s.totalKg)} tCO<sub>2</sub>e</div>
      </div>`;
    })
    .join("");

  const categoryRows = data.categories
    .map(
      (c) => `
      <tr>
        <td><span class="dot" style="background:${SCOPE_COLORS[c.scope]}"></span>${escapeHtml(c.name)}</td>
        <td class="num">Scope ${c.scope}</td>
        <td class="num">${c.count}</td>
        <td class="num strong">${tonnes(c.totalKg)}</td>
        <td class="num">${pct(c.totalKg, data.grandTotalKg)}%</td>
      </tr>`,
    )
    .join("");

  const facilityRows = data.facilities
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.name)}</td>
        <td class="num">${f.count}</td>
        <td class="num strong">${tonnes(f.totalKg)}</td>
        <td class="num">${pct(f.totalKg, data.grandTotalKg)}%</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.5; }
  .header { border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
  .header .org { font-size: 13px; color: #475569; letter-spacing: 0.04em; text-transform: uppercase; }
  .header h1 { font-size: 24px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  .header .period { font-size: 13px; color: #334155; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
  .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
  .meta .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .meta .v { font-size: 11px; font-weight: 600; margin-top: 2px; }
  .total-card { background: #0f766e; color: #fff; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: baseline; }
  .total-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .total-card .value { font-size: 32px; font-weight: 700; }
  .total-card .unit { font-size: 14px; font-weight: 400; opacity: 0.85; }
  h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
  th.num, td.num { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  td.strong { font-weight: 600; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { width: 60px; font-size: 10px; font-weight: 600; color: #334155; }
  .bar-track { flex: 1; height: 14px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .bar-value { width: 110px; text-align: right; font-size: 10px; font-weight: 600; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #64748b; }
  .footer p { margin-bottom: 3px; }
  ${brandStyles()}
</style>
</head>
<body>
  <div class="header">
    ${brandLogoHtml(data.logoDataUri, data.orgName)}
    <div class="org">${escapeHtml(data.orgName)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="period">${escapeHtml(data.periodLabel)} · ${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}</div>
  </div>

  <div class="meta-grid">
    <div class="meta"><div class="k">Snapshot</div><div class="v">Version ${data.snapshotVersion} · published ${fmtDate(data.publishedAt)}</div></div>
    <div class="meta"><div class="k">Methodology</div><div class="v">${escapeHtml(data.methodology)} · GWP ${escapeHtml(data.gwpVersion)}</div></div>
    <div class="meta"><div class="k">Emission factors</div><div class="v">${escapeHtml(data.factorLibrary)}</div></div>
  </div>

  <div class="total-card">
    <div>
      <div class="label">Total gross emissions</div>
      <div class="value">${tonnes(data.grandTotalKg)} <span class="unit">tCO<sub>2</sub>e</span></div>
    </div>
    <div style="text-align:right">
      <div class="label">Calculated records</div>
      <div class="value" style="font-size:22px">${data.recordCount}</div>
    </div>
  </div>

  <h2>Emissions by scope</h2>
  ${scopeBars}
  <table>
    <thead><tr><th>Scope</th><th class="num">Records</th><th class="num">tCO<sub>2</sub>e</th><th class="num">Share</th></tr></thead>
    <tbody>${scopeRows}</tbody>
  </table>
  ${data.biogenicCo2eTonnes != null ? `<p style="margin-top:12px;font-size:13px;color:#555"><strong>Biogenic CO₂e (memo item, excluded from totals):</strong> ${data.biogenicCo2eTonnes.toFixed(4)} tCO₂e</p><p style="font-size:11px;color:#888;margin-top:4px">Biogenic CO₂e is reported separately per GHG Protocol. Not included in Scope 1, 2, or 3 figures.</p>` : ""}

  <h2>Emissions by category</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Scope</th><th class="num">Records</th><th class="num">tCO<sub>2</sub>e</th><th class="num">Share</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>Emissions by facility</h2>
  <table>
    <thead><tr><th>Facility</th><th class="num">Records</th><th class="num">tCO<sub>2</sub>e</th><th class="num">Share</th></tr></thead>
    <tbody>${facilityRows}</tbody>
  </table>

  <div class="footer">
    <p>Published by ${escapeHtml(data.publishedBy)}. This report was generated from immutable snapshot v${data.snapshotVersion}; totals match the dashboard for the same snapshot.</p>
    <p>Methodology: GHG Protocol Corporate Standard. Global warming potentials from IPCC ${escapeHtml(data.gwpVersion)} (CH<sub>4</sub> = 27.9, N<sub>2</sub>O = 273). Emission factors: ${escapeHtml(data.factorLibrary)}.</p>
  </div>
</body>
</html>`;
}
