// National TOMS Social Value Report
// Framework: National TOMs (Themes, Outcomes, Measures) for Social Value

import { esc, brandStyles, brandLogoHtml } from "./shared";

export type TomsThemeSummary = {
  themeCode: string;
  themeName: string;
  totalPounds: number;
  measures: Array<{
    tomsCode: string;
    measureName: string;
    unit: string;
    quantity: number;
    valuePounds: number;
  }>;
};

export type NationalTomsData = {
  orgName: string;
  logoDataUri?: string;
  contractName: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date;
  publishedBy: string;
  themes: TomsThemeSummary[];
  grandTotalPounds: number;
  totalRecords: number;
};

export function renderNationalTomsHtml(d: NationalTomsData): string {
  const fmt = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fmtGbp = (n: number) => `£${fmt(n, 0)}`;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pStart = d.periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pEnd = d.periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const themeColors: Record<string, string> = {
    T1: "#2563eb", T2: "#7c3aed", T3: "#059669", T4: "#d97706", T5: "#dc2626",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>National TOMS Social Value Report — ${esc(d.orgName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .cover { background: #1e1b4b; color: #fff; padding: 48px 40px; }
  .cover .label { font-size: 11pt; opacity: 0.7; margin-bottom: 8px; }
  .cover h1 { font-size: 22pt; font-weight: 700; }
  .cover .org { font-size: 15pt; margin-top: 20px; font-weight: 600; }
  .cover .contract { font-size: 11pt; margin-top: 6px; opacity: 0.8; }
  .cover .period { font-size: 10pt; opacity: 0.7; margin-top: 4px; }
  .total-banner { background: #312e81; color: #fff; padding: 24px 40px; text-align: center; }
  .total-banner .label { font-size: 11pt; opacity: 0.8; }
  .total-banner .value { font-size: 32pt; font-weight: 900; margin: 8px 0; }
  .total-banner .sub { font-size: 10pt; opacity: 0.7; }
  section { padding: 24px 40px; border-bottom: 1px solid #e5e7eb; }
  h2 { font-size: 13pt; font-weight: 700; color: #1e1b4b; border-bottom: 2px solid #1e1b4b; padding-bottom: 4px; margin-bottom: 14px; }
  .theme-section { margin: 16px 0; }
  .theme-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 6px; color: #fff; margin-bottom: 6px; }
  .theme-header .name { font-size: 12pt; font-weight: 700; }
  .theme-header .total { font-size: 12pt; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 10pt; }
  th { background: #374151; color: #fff; padding: 7px 10px; text-align: left; font-size: 9pt; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  td:last-child, th:last-child { text-align: right; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 16px 0; }
  .theme-card { border-radius: 6px; padding: 14px; color: #fff; }
  .theme-card .code { font-size: 11pt; font-weight: 900; margin-bottom: 4px; }
  .theme-card .tname { font-size: 8pt; opacity: 0.85; margin-bottom: 8px; line-height: 1.3; }
  .theme-card .amount { font-size: 13pt; font-weight: 700; }
  .footer { background: #f9fafb; padding: 16px 40px; font-size: 9pt; color: #6b7280; border-top: 1px solid #e5e7eb; }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <div class="label">National TOMS Framework — Social Value Report</div>
  <h1>Social Value Impact</h1>
  <div class="org">${esc(d.orgName)}</div>
  <div class="contract">Contract: ${esc(d.contractName)}</div>
  <div class="period">Reporting period: ${pStart} – ${pEnd}</div>
</div>

<div class="total-banner">
  <div class="label">Total Social Value Delivered</div>
  <div class="value">${fmtGbp(d.grandTotalPounds)}</div>
  <div class="sub">${d.totalRecords.toLocaleString("en-GB")} social value records · ${esc(d.periodLabel)}</div>
</div>

<section>
  <h2>Summary by Theme</h2>
  <div class="summary-grid">
    ${d.themes.map((t) => `
    <div class="theme-card" style="background:${themeColors[t.themeCode] ?? "#374151"}">
      <div class="code">${esc(t.themeCode)}</div>
      <div class="tname">${esc(t.themeName)}</div>
      <div class="amount">${fmtGbp(t.totalPounds)}</div>
    </div>`).join("")}
  </div>
</section>

${d.themes.filter((t) => t.measures.length > 0).map((t) => `
<section>
  <div class="theme-header" style="background:${themeColors[t.themeCode] ?? "#374151"}">
    <span class="name">${esc(t.themeCode)}: ${esc(t.themeName)}</span>
    <span class="total">${fmtGbp(t.totalPounds)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>TOMS Code</th>
        <th>Measure</th>
        <th>Unit</th>
        <th>Quantity</th>
        <th>£ Value</th>
      </tr>
    </thead>
    <tbody>
      ${t.measures.map((m) => `
      <tr>
        <td style="font-family:monospace;font-size:9pt">${esc(m.tomsCode)}</td>
        <td>${esc(m.measureName)}</td>
        <td>${esc(m.unit)}</td>
        <td style="text-align:right">${fmt(Number(m.quantity), 2)}</td>
        <td style="text-align:right"><strong>${fmtGbp(Number(m.valuePounds))}</strong></td>
      </tr>`).join("")}
      <tr>
        <td colspan="4"><strong>Theme Total</strong></td>
        <td style="text-align:right"><strong>${fmtGbp(t.totalPounds)}</strong></td>
      </tr>
    </tbody>
  </table>
</section>`).join("")}

<section>
  <h2>Grand Total</h2>
  <table>
    <thead><tr><th>Theme</th><th style="text-align:right">Social Value (£)</th></tr></thead>
    <tbody>
      ${d.themes.map((t) => `<tr><td>${esc(t.themeCode)}: ${esc(t.themeName)}</td><td style="text-align:right">${fmtGbp(t.totalPounds)}</td></tr>`).join("")}
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${fmtGbp(d.grandTotalPounds)}</strong></td></tr>
    </tbody>
  </table>
</section>

<div class="footer">
  National TOMS Social Value Report · ${esc(d.orgName)} · Contract: ${esc(d.contractName)} · Generated ${now} by Fluid · Published by ${esc(d.publishedBy)}
</div>
</body></html>`;
}
