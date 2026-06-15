// SECR (Streamlined Energy & Carbon Reporting) — UK Companies Act 2006 s.414CB
// Mandatory for large UK businesses: >250 employees OR >£36m turnover OR >£18m balance sheet
// Reports must cover a 12-month period aligned to the financial year.

import { esc, brandStyles, brandLogoHtml } from "./shared";

export type SecrData = {
  orgName: string;
  logoDataUri?: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  snapshotVersion: number;
  publishedAt: Date;
  publishedBy: string;
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
  // UK energy consumption (kWh)
  gasKwh: number;
  electricityKwh: number;
  transportFuelKwh: number;
  totalUkEnergyKwh: number;
  // GHG emissions (tCO2e)
  scope1Tonnes: number;
  scope2Tonnes: number;
  totalTonnes: number;
  // Intensity metric
  intensityMetric: string;  // e.g. "tCO2e per employee"
  intensityValue: number;
  intensityDenominator: string; // e.g. "250 employees"
  // Previous year (optional)
  prevYearLabel?: string;
  prevScope1Tonnes?: number;
  prevScope2Tonnes?: number;
  prevTotalTonnes?: number;
  prevTotalUkEnergyKwh?: number;
  // Energy efficiency measures
  efficiencyMeasures: string[];
  recordCount: number;
};

export function renderSecrHtml(d: SecrData): string {
  const fmt = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fmtKwh = (n: number) => `${fmt(n, 0)} kWh`;
  const fmtT = (n: number) => `${fmt(n, 2)} tCO₂e`;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pStart = d.periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pEnd = d.periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const prevRow = d.prevYearLabel ? `
    <tr class="prev">
      <td>${esc(d.prevYearLabel)}</td>
      <td>${fmtT(d.prevScope1Tonnes ?? 0)}</td>
      <td>${fmtT(d.prevScope2Tonnes ?? 0)}</td>
      <td>—</td>
      <td>${fmtT(d.prevTotalTonnes ?? 0)}</td>
      <td>${fmtKwh(d.prevTotalUkEnergyKwh ?? 0)}</td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SECR Report — ${esc(d.orgName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
  .cover { background: #003087; color: #fff; padding: 48px 40px; min-height: 240px; }
  .cover h1 { font-size: 22pt; font-weight: 700; margin-bottom: 8px; }
  .cover .subtitle { font-size: 13pt; opacity: 0.85; }
  .cover .org { font-size: 15pt; margin-top: 24px; font-weight: 600; }
  .cover .period { margin-top: 8px; font-size: 11pt; opacity: 0.8; }
  section { padding: 28px 40px; border-bottom: 1px solid #e5e7eb; }
  h2 { font-size: 13pt; font-weight: 700; color: #003087; margin-bottom: 14px; border-bottom: 2px solid #003087; padding-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: 700; color: #374151; margin: 16px 0 8px; }
  p { margin: 8px 0; line-height: 1.55; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .stat { background: #f0f4ff; border-radius: 6px; padding: 16px; }
  .stat .label { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .stat .value { font-size: 17pt; font-weight: 700; color: #003087; }
  .stat .sub { font-size: 9pt; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #003087; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  tr.prev td { color: #6b7280; font-style: italic; }
  .intensity-box { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 16px; margin: 12px 0; }
  .intensity-box .ivalue { font-size: 18pt; font-weight: 700; color: #065f46; }
  ul { margin: 8px 0 8px 20px; }
  li { margin: 4px 0; line-height: 1.5; }
  .footer { background: #f9fafb; padding: 16px 40px; font-size: 9pt; color: #6b7280; border-top: 1px solid #e5e7eb; }
  .badge { display: inline-block; background: #003087; color: #fff; font-size: 8pt; padding: 2px 8px; border-radius: 3px; margin-right: 6px; }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <div class="subtitle">Streamlined Energy &amp; Carbon Report</div>
  <div class="org">${esc(d.orgName)}</div>
  <div class="period">Reporting period: ${pStart} – ${pEnd}</div>
  <div style="margin-top:12px;font-size:9pt;opacity:0.7">Prepared in accordance with the Companies Act 2006 (Strategic Report and Directors' Report) Regulations 2013, as amended by The Companies, Partnerships and Groups (Accounts and Reports) Regulations 2015.</div>
</div>

<section>
  <h2>1. UK Energy Consumption</h2>
  <p>The following energy consumption data relates to UK operations for the period ${pStart} to ${pEnd}.</p>
  <div class="stat-grid">
    <div class="stat">
      <div class="label">Natural Gas &amp; Fuels</div>
      <div class="value">${fmt(Math.round(d.gasKwh / 1000), 0)}</div>
      <div class="sub">MWh</div>
    </div>
    <div class="stat">
      <div class="label">Purchased Electricity</div>
      <div class="value">${fmt(Math.round(d.electricityKwh / 1000), 0)}</div>
      <div class="sub">MWh</div>
    </div>
    <div class="stat">
      <div class="label">Transport Fuel</div>
      <div class="value">${fmt(Math.round(d.transportFuelKwh / 1000), 0)}</div>
      <div class="sub">MWh</div>
    </div>
  </div>
  <p><strong>Total UK energy consumption: ${fmtKwh(d.totalUkEnergyKwh)}</strong></p>
</section>

<section>
  <h2>2. GHG Emissions</h2>
  <p>Emissions calculated using <strong>${esc(d.factorLibrary)}</strong> conversion factors under <strong>${esc(d.methodology)}</strong> (GWP ${esc(d.gwpVersion)}).</p>
  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th>Scope 1 (Direct)</th>
        <th>Scope 2 (Electricity)</th>
        <th>Scope 3 (Value Chain)</th>
        <th>Total</th>
        <th>Total UK Energy</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${esc(d.periodLabel)}</strong></td>
        <td><strong>${fmtT(d.scope1Tonnes)}</strong></td>
        <td><strong>${fmtT(d.scope2Tonnes)}</strong></td>
        <td><strong>—</strong></td>
        <td><strong>${fmtT(d.totalTonnes)}</strong></td>
        <td><strong>${fmtKwh(d.totalUkEnergyKwh)}</strong></td>
      </tr>
      ${prevRow}
    </tbody>
  </table>
  <p style="font-size:9pt;color:#6b7280;">Scope 3 (value chain) emissions are reported separately and not included in the mandatory SECR total above.</p>
</section>

<section>
  <h2>3. Intensity Ratio</h2>
  <div class="intensity-box">
    <div class="label" style="font-size:9pt;color:#065f46;margin-bottom:6px;">Carbon Intensity</div>
    <div class="ivalue">${fmt(d.intensityValue, 3)} ${esc(d.intensityMetric)}</div>
    <div style="font-size:9pt;color:#065f46;margin-top:6px;">Denominator: ${esc(d.intensityDenominator)}</div>
  </div>
</section>

<section>
  <h2>4. Energy Efficiency Measures</h2>
  <p>The following principal energy efficiency actions were taken during the reporting period:</p>
  ${d.efficiencyMeasures.length > 0
    ? `<ul>${d.efficiencyMeasures.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`
    : `<p style="color:#6b7280;font-style:italic">No efficiency measures recorded for this period. Add initiatives via the platform to populate this section.</p>`
  }
</section>

<section>
  <h2>5. Methodology Statement</h2>
  <p>GHG emissions are quantified using the <strong>GHG Protocol Corporate Accounting and Reporting Standard</strong> (Revised Edition). Emission factors are sourced from <strong>${esc(d.factorLibrary)}</strong>. Global warming potentials are taken from IPCC <strong>${esc(d.gwpVersion)}</strong>. The organisational boundary is set using the <strong>operational control</strong> approach. Emission calculations cover ${d.recordCount.toLocaleString("en-GB")} activity records.</p>
  <p>Scope 2 emissions are reported on a location-based basis using the national grid average emission factor for the UK. Market-based figures are available on request.</p>
</section>

<div class="footer">
  <span class="badge">SECR</span>
  Generated by Fluid · Snapshot v${d.snapshotVersion} · Published ${now} by ${esc(d.publishedBy)} · ${esc(d.factorLibrary)} · ${esc(d.methodology)}
</div>
</body></html>`;
}
