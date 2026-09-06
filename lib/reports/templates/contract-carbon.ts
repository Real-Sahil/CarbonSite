// Contract Carbon Report template.
// Scope 1/2/3 breakdown and category detail for a single contract/project.
// Used for supply chain disclosure, procurement due-diligence, and client reporting.

import { esc, brandStyles, brandLogoHtml } from "./shared";

export interface ContractCarbonCategory {
  name: string;
  scope: number;
  totalKg: number;
  count: number;
}

export interface ContractCarbonData {
  orgName: string;
  logoDataUri?: string;
  contractName: string;
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
  contractValueGbp?: number;
  categories: ContractCarbonCategory[];
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n: number, dp = 2) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function renderContractCarbonHtml(d: ContractCarbonData): string {
  const intensityStr =
    d.contractValueGbp && d.contractValueGbp > 0
      ? `${fmtNum(d.totalTonnes / (d.contractValueGbp / 1_000_000), 3)} tCO₂e per £1m contract value`
      : "Contract value not provided — intensity metric unavailable";

  const categoryRows = d.categories
    .sort((a, b) => a.scope - b.scope || b.totalKg - a.totalKg)
    .map(
      (c) =>
        `<tr><td>Scope ${c.scope}</td><td>${esc(c.name)}</td><td class="num">${c.count.toLocaleString("en-GB")}</td><td class="num">${fmtNum(c.totalKg / 1000)} tCO₂e</td><td class="num">${d.totalTonnes > 0 ? fmtNum((c.totalKg / 1000 / d.totalTonnes) * 100, 1) : "0.0"}%</td></tr>`,
    )
    .join("");

  const s1Pct = d.totalTonnes > 0 ? ((d.scope1Tonnes / d.totalTonnes) * 100).toFixed(1) : "0.0";
  const s2Pct = d.totalTonnes > 0 ? ((d.scope2Tonnes / d.totalTonnes) * 100).toFixed(1) : "0.0";
  const s3Pct = d.totalTonnes > 0 ? ((d.scope3Tonnes / d.totalTonnes) * 100).toFixed(1) : "0.0";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Contract Carbon Report — ${esc(d.contractName)} — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5 }
  .cover { background: linear-gradient(135deg, #1a2e4a 0%, #243b5a 100%); color: #fff; padding: 40px }
  .cover h1 { font-size: 19pt; font-weight: 700; margin-bottom: 6px }
  .cover .contract { font-size: 13pt; font-weight: 600; margin-top: 6px; color: #b8cfe8 }
  .cover .sub { font-size: 10pt; margin-top: 4px; opacity: 0.8 }
  .cover .meta { font-size: 9pt; opacity: 0.65; margin-top: 16px }
  .pill { display: inline-block; background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 20px; font-size: 9pt; margin-top: 10px; margin-right: 6px }
  section { margin: 28px 40px }
  h2 { font-size: 12pt; font-weight: 700; color: #1a2e4a; border-left: 4px solid #1a2e4a; padding-left: 10px; margin-bottom: 12px }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px }
  th { background: #edf2f8; color: #1a2e4a; text-align: left; padding: 6px 8px; border: 1px solid #c5d3e0 }
  td { padding: 5px 8px; border: 1px solid #dde3ea; vertical-align: top }
  tr:nth-child(even) td { background: #f7f9fc }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .scope-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px }
  .kpi { background: #edf2f8; border-radius: 6px; padding: 14px; text-align: center }
  .kpi .val { font-size: 16pt; font-weight: 700; color: #1a2e4a; display: block; margin: 4px 0 2px }
  .kpi .lbl { font-size: 8.5pt; color: #4a6070 }
  .kpi .pct { font-size: 9pt; color: #6a8090; margin-top: 2px; display: block }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0 }
  .bar-label { min-width: 60px; font-size: 9pt; color: #444 }
  .bar-track { flex: 1; background: #e8eef5; border-radius: 4px; height: 12px; overflow: hidden }
  .bar-fill-s1 { background: #1a2e4a; height: 100%; border-radius: 4px }
  .bar-fill-s2 { background: #3a6fa0; height: 100%; border-radius: 4px }
  .bar-fill-s3 { background: #7aadcf; height: 100%; border-radius: 4px }
  .bar-val { min-width: 56px; text-align: right; font-size: 9pt; color: #444 }
  .intensity-box { background: #f0f5fb; border: 1px solid #c5d3e0; border-radius: 6px; padding: 14px; margin-top: 14px }
  .intensity-box .val { font-size: 14pt; font-weight: 700; color: #1a2e4a }
  .intensity-box .lbl { font-size: 9pt; color: #4a6070; margin-top: 2px }
  footer { font-size: 8pt; color: #888; text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 32px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <h1>Contract Carbon Report</h1>
  <p class="contract">${esc(d.contractName)}</p>
  <p class="sub">${esc(d.orgName)} · ${esc(d.periodLabel)}</p>
  <p class="meta">Published ${fmtDate(d.publishedAt)} by ${esc(d.publishedBy)}</p>
  <span class="pill">Snapshot v${d.snapshotVersion}</span>
  ${d.contractValueGbp ? `<span class="pill">Contract value: ${fmtGbp(d.contractValueGbp)}</span>` : ""}
</div>

<section>
  <h2>1. Report Basis</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Organisation</td><td>${esc(d.orgName)}</td></tr>
    <tr><td>Contract / project</td><td>${esc(d.contractName)}</td></tr>
    <tr><td>Reporting period</td><td>${esc(d.periodLabel)} (${fmtDate(d.periodStart)} – ${fmtDate(d.periodEnd)})</td></tr>
    <tr><td>Methodology</td><td>${esc(d.methodology)} — GWP ${esc(d.gwpVersion)}</td></tr>
    <tr><td>Emission factor library</td><td>${esc(d.factorLibrary)}</td></tr>
    <tr><td>Snapshot version</td><td>v${d.snapshotVersion} (immutable)</td></tr>
    <tr><td>Published by</td><td>${esc(d.publishedBy)}</td></tr>
    <tr><td>Activity records included</td><td>${d.recordCount.toLocaleString("en-GB")}</td></tr>
    ${d.contractValueGbp ? `<tr><td>Contract value</td><td>${fmtGbp(d.contractValueGbp)}</td></tr>` : ""}
  </table>
</section>

<section>
  <h2>2. Emissions Summary</h2>
  <div class="scope-grid">
    <div class="kpi">
      <span class="val">${fmtNum(d.scope1Tonnes)}</span>
      <span class="lbl">tCO₂e Scope 1</span>
      <span class="pct">Direct — ${s1Pct}% of total</span>
    </div>
    <div class="kpi">
      <span class="val">${fmtNum(d.scope2Tonnes)}</span>
      <span class="lbl">tCO₂e Scope 2</span>
      <span class="pct">Energy — ${s2Pct}% of total</span>
    </div>
    <div class="kpi">
      <span class="val">${fmtNum(d.scope3Tonnes)}</span>
      <span class="lbl">tCO₂e Scope 3</span>
      <span class="pct">Value chain — ${s3Pct}% of total</span>
    </div>
    <div class="kpi">
      <span class="val">${fmtNum(d.totalTonnes)}</span>
      <span class="lbl">tCO₂e Total</span>
      <span class="pct">${d.recordCount.toLocaleString("en-GB")} activity records</span>
    </div>
  </div>

  <div class="bar-row">
    <span class="bar-label">Scope 1</span>
    <div class="bar-track"><div class="bar-fill-s1" style="width:${s1Pct}%"></div></div>
    <span class="bar-val">${fmtNum(d.scope1Tonnes)} t</span>
  </div>
  <div class="bar-row">
    <span class="bar-label">Scope 2</span>
    <div class="bar-track"><div class="bar-fill-s2" style="width:${s2Pct}%"></div></div>
    <span class="bar-val">${fmtNum(d.scope2Tonnes)} t</span>
  </div>
  <div class="bar-row">
    <span class="bar-label">Scope 3</span>
    <div class="bar-track"><div class="bar-fill-s3" style="width:${s3Pct}%"></div></div>
    <span class="bar-val">${fmtNum(d.scope3Tonnes)} t</span>
  </div>

  <div class="intensity-box">
    <div class="val">${intensityStr.split(" ")[0]}</div>
    <div class="lbl">${intensityStr.includes("unavailable") ? intensityStr : intensityStr.replace(/^[\d.,]+ /, "")}</div>
  </div>
</section>

<section>
  <h2>3. Emissions by Category</h2>
  <table>
    <thead>
      <tr><th>Scope</th><th>Category</th><th class="num">Records</th><th class="num">tCO₂e</th><th class="num">% of total</th></tr>
    </thead>
    <tbody>
      ${categoryRows}
    </tbody>
    <tfoot>
      <tr style="font-weight:700"><td colspan="3">Total</td><td class="num">${fmtNum(d.totalTonnes)}</td><td class="num">100%</td></tr>
    </tfoot>
  </table>
</section>

<section>
  <h2>4. Measurement Assurance</h2>
  <table>
    <tr><th>Control</th><th>Status</th></tr>
    <tr><td>Calculation methodology</td><td>${esc(d.methodology)}</td></tr>
    <tr><td>GWP source</td><td>${esc(d.gwpVersion)} (IPCC AR6 values)</td></tr>
    <tr><td>Emission factor library</td><td>${esc(d.factorLibrary)}</td></tr>
    <tr><td>Immutable snapshot</td><td>v${d.snapshotVersion} — locked, auditable</td></tr>
    <tr><td>Traceability</td><td>Each record stores original unit, normalised unit, factor version, formula, and selection reason</td></tr>
    <tr><td>Third-party verification</td><td>Data available on request via the MetricOra platform</td></tr>
  </table>
</section>

<footer>
  ${esc(d.orgName)} · ${esc(d.contractName)} · Contract Carbon Report · ${esc(d.periodLabel)} · Snapshot v${d.snapshotVersion}<br>
  Generated ${fmtDate(d.publishedAt)} · ${esc(d.factorLibrary)}
</footer>
</body>
</html>`;
}
