// BREEAM Evidence Pack template.
// Provides structured evidence of GHG measurement and reduction for BREEAM
// Mat 01 / Ene 01 / Man 03 and related credits.

import { esc } from "./shared";

export interface BreeamCategory {
  name: string;
  scope: number;
  totalKg: number;
  count: number;
}

export interface BreeamData {
  orgName: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  snapshotVersion: number;
  publishedAt: Date;
  publishedBy: string;
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
  scope1Tonnes: number;
  scope2Tonnes: number;
  scope3Tonnes: number;
  totalTonnes: number;
  recordCount: number;
  categories: BreeamCategory[];
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function renderBreeamEvidenceHtml(d: BreeamData): string {
  const scope1 = fmtNum(d.scope1Tonnes);
  const scope2 = fmtNum(d.scope2Tonnes);
  const scope3 = fmtNum(d.scope3Tonnes);
  const total = fmtNum(d.totalTonnes);

  const categoryRows = d.categories
    .sort((a, b) => b.totalKg - a.totalKg)
    .map((c) => `
    <tr>
      <td>Scope ${c.scope}</td>
      <td>${esc(c.name)}</td>
      <td class="num">${c.count.toLocaleString("en-GB")}</td>
      <td class="num">${fmtNum(c.totalKg / 1000)} tCO₂e</td>
    </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BREEAM Evidence Pack — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.45 }
  .cover { background: #00573f; color: #fff; padding: 40px; margin-bottom: 32px }
  .cover h1 { font-size: 22pt; font-weight: 700; margin-bottom: 6px }
  .cover p { font-size: 10pt; opacity: 0.85; margin-top: 4px }
  .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 4px; padding: 3px 10px; font-size: 9pt; margin-top: 12px }
  section { margin: 0 40px 28px }
  h2 { font-size: 13pt; font-weight: 700; color: #00573f; border-bottom: 2px solid #00573f; padding-bottom: 4px; margin-bottom: 14px }
  h3 { font-size: 10.5pt; font-weight: 700; margin: 14px 0 8px }
  table { width: 100%; border-collapse: collapse; font-size: 9pt }
  th { background: #f0f7f4; color: #00573f; text-align: left; padding: 6px 8px; border: 1px solid #c8e0d8 }
  td { padding: 5px 8px; border: 1px solid #dde; vertical-align: top }
  tr:nth-child(even) td { background: #fafffe }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px }
  .metric { background: #f0f7f4; border: 1px solid #c8e0d8; border-radius: 6px; padding: 14px; text-align: center }
  .metric .val { font-size: 16pt; font-weight: 700; color: #00573f; display: block; margin: 4px 0 2px }
  .metric .lbl { font-size: 8.5pt; color: #4a6e5e }
  .checklist { list-style: none; padding: 0 }
  .checklist li { padding: 5px 0 5px 22px; position: relative; border-bottom: 1px solid #eee; font-size: 9pt }
  .checklist li::before { content: '✓'; position: absolute; left: 0; color: #00573f; font-weight: 700 }
  .note { background: #fffde8; border-left: 3px solid #f0c020; padding: 10px 14px; font-size: 9pt; margin-top: 14px }
  footer { text-align: center; font-size: 8pt; color: #888; padding: 20px 40px; border-top: 1px solid #ddd; margin-top: 32px }
</style>
</head>
<body>
<div class="cover">
  <h1>BREEAM Evidence Pack</h1>
  <p>${esc(d.orgName)}</p>
  <p>Reporting period: ${esc(d.periodLabel)}</p>
  <span class="badge">Snapshot v${d.snapshotVersion}</span>
</div>

<section>
  <h2>1. Document Purpose</h2>
  <p>This evidence pack provides structured GHG emissions measurement data to support
     BREEAM assessment credits, including Ene 01 (Energy Performance), Man 03 (Responsible
     Construction Practices), and Mat 01 (Environmental Impact of Materials). All figures
     derive from an auditable, version-controlled calculation snapshot.</p>
</section>

<section>
  <h2>2. Reporting Scope and Period</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Organisation</td><td>${esc(d.orgName)}</td></tr>
    <tr><td>Reporting period</td><td>${esc(d.periodLabel)} (${fmtDate(d.periodStart)} – ${fmtDate(d.periodEnd)})</td></tr>
    <tr><td>GHG Protocol scopes</td><td>Scope 1, Scope 2, Scope 3</td></tr>
    <tr><td>Emission factor library</td><td>${esc(d.factorLibrary)}</td></tr>
    <tr><td>Methodology</td><td>${esc(d.methodology)} — GWP ${esc(d.gwpVersion)}</td></tr>
    <tr><td>Snapshot version</td><td>v${d.snapshotVersion}</td></tr>
    <tr><td>Published by</td><td>${esc(d.publishedBy)}</td></tr>
    <tr><td>Published date</td><td>${fmtDate(d.publishedAt)}</td></tr>
    <tr><td>Total activity records</td><td>${d.recordCount.toLocaleString("en-GB")}</td></tr>
  </table>
</section>

<section>
  <h2>3. GHG Emissions Summary</h2>
  <div class="metric-grid">
    <div class="metric"><span class="val">${scope1} tCO₂e</span><span class="lbl">Scope 1 Direct</span></div>
    <div class="metric"><span class="val">${scope2} tCO₂e</span><span class="lbl">Scope 2 Purchased energy</span></div>
    <div class="metric"><span class="val">${scope3} tCO₂e</span><span class="lbl">Scope 3 Value chain</span></div>
    <div class="metric"><span class="val">${total} tCO₂e</span><span class="lbl">Total combined</span></div>
  </div>
</section>

<section>
  <h2>4. Emissions by Category</h2>
  <table>
    <thead><tr><th>Scope</th><th>Category</th><th class="num">Records</th><th class="num">CO₂e</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>
</section>

<section>
  <h2>5. Measurement Quality Checklist</h2>
  <ul class="checklist">
    <li>Measured and calculated to GHG Protocol Corporate Standard (${esc(d.methodology)})</li>
    <li>GWP values from ${esc(d.gwpVersion)} — aligned with IPCC AR6</li>
    <li>Emission factors from ${esc(d.factorLibrary)}</li>
    <li>Immutable snapshot v${d.snapshotVersion} locks totals for audit</li>
    <li>Activity records peer-reviewed and approved before calculation</li>
    <li>Calculation traceability: each record stores original unit, normalised unit, factor version, formula, and selection reason</li>
    <li>Data available for third-party verification on request</li>
  </ul>
  <div class="note">
    <strong>BREEAM assessor note:</strong> The snapshot ID referenced in this pack uniquely identifies
    the calculation run from which all totals are derived. Request access to the CarbonSite platform
    to review individual activity records and supporting evidence files.
  </div>
</section>

<footer>
  Generated ${fmtDate(d.publishedAt)} · ${esc(d.orgName)} · ${esc(d.periodLabel)} · Snapshot v${d.snapshotVersion} · ${esc(d.factorLibrary)}
</footer>
</body>
</html>`;
}
