// lib/reports/templates/ghg-protocol.ts
// GHG Protocol Corporate Standard — Full Inventory Report
// Covers Scope 1, 2 (location + market), Scope 3 categories 1–15
// Per-gas breakdown (CO2, CH4, N2O, biogenic CO2)
// Reference: GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition)

import { brandStyles } from "./shared";

export interface GhgProtocolCategoryRow {
  code: string;
  name: string;
  scope: number;
  totalKg: number;
  co2Kg?: number;
  ch4Kg?: number;
  n2oKg?: number;
}

export interface GhgProtocolData {
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
  // Scope totals (kg CO2e)
  scope1Kg: number;
  scope2LocationKg: number;
  scope2MarketKg: number;
  scope3Kg: number;
  totalKg: number;
  // Gas breakdown (kg CO2e) — undefined if not tracked
  co2Kg?: number;
  ch4Kg?: number;
  n2oKg?: number;
  biogenicCo2Kg?: number;
  // Category detail
  categories: GhgProtocolCategoryRow[];
  // Optional base year for intensity / progress
  baselineYear?: string;
  baselineTonnes?: number;
  reductionPct?: number;
  recordCount: number;
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtT(kg: number): string {
  const t = kg / 1000;
  return t.toLocaleString("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

const SCOPE3_CATEGORIES: Record<number, string> = {
  1:  "Purchased goods and services",
  2:  "Capital goods",
  3:  "Fuel and energy-related activities",
  4:  "Upstream transportation and distribution",
  5:  "Waste generated in operations",
  6:  "Business travel",
  7:  "Employee commuting",
  8:  "Upstream leased assets",
  9:  "Downstream transportation and distribution",
  10: "Processing of sold products",
  11: "Use of sold products",
  12: "End-of-life treatment of sold products",
  13: "Downstream leased assets",
  14: "Franchises",
  15: "Investments",
};

export function renderGhgProtocolHtml(data: GhgProtocolData): string {
  const logoHtml = data.logoDataUri
    ? `<img src="${data.logoDataUri}" alt="${data.orgName} logo" style="height:48px;max-width:200px;object-fit:contain;">`
    : `<span style="font-size:1.1rem;font-weight:700;color:#228B22;">${data.orgName}</span>`;

  const scope1Pct  = pct(data.scope1Kg, data.totalKg);
  const scope2LPct = pct(data.scope2LocationKg, data.totalKg);
  const scope3Pct  = pct(data.scope3Kg, data.totalKg);

  // Category table rows
  const s1Cats  = data.categories.filter((c) => c.scope === 1).sort((a, b) => b.totalKg - a.totalKg);
  const s2Cats  = data.categories.filter((c) => c.scope === 2).sort((a, b) => b.totalKg - a.totalKg);
  const s3Cats  = data.categories.filter((c) => c.scope === 3).sort((a, b) => b.totalKg - a.totalKg);

  function catRows(cats: GhgProtocolCategoryRow[]): string {
    if (cats.length === 0) return `<tr><td colspan="6" style="padding:12px 14px;color:#9ca3af;font-style:italic;">No data reported for this scope.</td></tr>`;
    return cats.map((c) => `
      <tr>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;">${c.name}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;font-family:monospace;">${c.code}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;text-align:right;font-variant-numeric:tabular-nums;">${c.co2Kg != null ? fmtT(c.co2Kg) : "—"}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;text-align:right;font-variant-numeric:tabular-nums;">${c.ch4Kg != null ? fmtT(c.ch4Kg) : "—"}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;text-align:right;font-variant-numeric:tabular-nums;">${c.n2oKg != null ? fmtT(c.n2oKg) : "—"}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.81rem;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#228B22;">${fmtT(c.totalKg)}</td>
      </tr>`).join("");
  }

  const gasRows = [
    { gas: "Carbon dioxide (CO₂)", gwp: 1, kg: data.co2Kg },
    { gas: "Methane (CH₄)", gwp: 27.9, kg: data.ch4Kg },
    { gas: "Nitrous oxide (N₂O)", gwp: 273, kg: data.n2oKg },
  ].filter((g) => g.kg != null);

  const gasTableHtml = gasRows.length === 0 ? `<p style="color:#6b7280;font-size:0.82rem;font-style:italic;">Per-gas breakdown not available for this dataset.</p>` : `
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#228B22;color:white;">
        <th style="padding:9px 14px;text-align:left;font-size:0.75rem;font-weight:600;">Gas</th>
        <th style="padding:9px 14px;text-align:right;font-size:0.75rem;font-weight:600;">AR6 GWP100</th>
        <th style="padding:9px 14px;text-align:right;font-size:0.75rem;font-weight:600;">tCO₂e</th>
        <th style="padding:9px 14px;text-align:right;font-size:0.75rem;font-weight:600;">Share</th>
      </tr>
    </thead>
    <tbody>
      ${gasRows.map((g, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafb"};">
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.82rem;">${g.gas}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.82rem;text-align:right;">${g.gwp}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.82rem;text-align:right;font-variant-numeric:tabular-nums;">${fmtT(g.kg!)}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:0.82rem;text-align:right;">${pct(g.kg!, data.totalKg)}</td>
      </tr>`).join("")}
      ${data.biogenicCo2Kg != null ? `
      <tr style="background:#f0faf0;">
        <td style="padding:9px 14px;font-size:0.82rem;font-style:italic;">Biogenic CO₂ (memo item, not included in total)</td>
        <td style="padding:9px 14px;text-align:right;font-size:0.82rem;">1</td>
        <td style="padding:9px 14px;text-align:right;font-size:0.82rem;font-variant-numeric:tabular-nums;">${fmtT(data.biogenicCo2Kg)}</td>
        <td style="padding:9px 14px;text-align:right;font-size:0.82rem;">—</td>
      </tr>` : ""}
    </tbody>
  </table>`;

  const progressHtml = data.baselineYear && data.baselineTonnes != null ? `
  <div style="background:#f0faf0;border:1px solid #d1fae5;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#228B22;margin:0 0 8px;">Progress vs. Baseline</p>
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div><span style="font-size:1.3rem;font-weight:700;color:#333;">${data.baselineTonnes.toLocaleString("en-GB", {maximumFractionDigits:0})}</span><br><span style="font-size:0.75rem;color:#6b7280;">Baseline (${data.baselineYear}) tCO₂e</span></div>
      <div><span style="font-size:1.3rem;font-weight:700;color:#333;">${(data.totalKg / 1000).toLocaleString("en-GB", {maximumFractionDigits:0})}</span><br><span style="font-size:0.75rem;color:#6b7280;">Current period tCO₂e</span></div>
      ${data.reductionPct != null ? `<div><span style="font-size:1.3rem;font-weight:700;color:${data.reductionPct > 0 ? "#228B22" : "#dc2626"};">${data.reductionPct > 0 ? "−" : "+"}${Math.abs(data.reductionPct).toFixed(1)}%</span><br><span style="font-size:0.75rem;color:#6b7280;">Change vs. baseline</span></div>` : ""}
    </div>
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GHG Protocol Inventory — ${data.orgName} — ${data.periodLabel}</title>
<style>
${brandStyles()}
body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff; font-size: 0.88rem; }
.header { background: linear-gradient(135deg, #1a6b1a 0%, #228B22 100%); color: white; padding: 28px 32px; }
.header h1 { margin: 8px 0 4px; font-size: 1.35rem; font-weight: 700; }
.header p { margin: 2px 0; font-size: 0.83rem; opacity: 0.88; }
.header-meta { margin-top: 10px; font-size: 0.75rem; opacity: 0.75; }
.scope-bar { display: flex; border-radius: 8px; overflow: hidden; height: 28px; margin: 20px 0 8px; }
.scope-bar-seg { display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: white; }
.kpi-row { display: flex; gap: 14px; padding: 20px 32px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
.kpi { flex: 1; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; }
.kpi-label { font-size: 0.71rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
.kpi-value { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.kpi-unit { font-size: 0.73rem; color: #9ca3af; margin-top: 1px; }
.content { padding: 24px 32px; }
.section-title { font-size: 0.79rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #228B22; margin: 24px 0 10px; border-bottom: 2px solid #228B22; padding-bottom: 5px; }
table { width: 100%; border-collapse: collapse; }
th { background: #228B22; color: white; padding: 9px 14px; text-align: left; font-size: 0.74rem; font-weight: 600; }
th:not(:first-child):not(:nth-child(2)) { text-align: right; }
.footer { border-top: 1px solid #e5e7eb; padding: 14px 32px; background: #f9fafb; font-size: 0.71rem; color: #9ca3af; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div>${logoHtml}</div>
      <h1>GHG Protocol Corporate Inventory</h1>
      <p>Scope 1, 2 &amp; 3 — ${data.periodLabel} &nbsp;|&nbsp; ${fmt(data.periodStart)} – ${fmt(data.periodEnd)}</p>
      <div class="header-meta">Snapshot v${data.snapshotVersion} · ${data.factorLibrary} · ${data.methodology} (AR6 GWP ${data.gwpVersion}) · ${data.recordCount.toLocaleString("en-GB")} records</div>
    </div>
    <div style="text-align:right;font-size:0.8rem;opacity:0.85;">
      <p>Published: ${fmt(data.publishedAt)}</p>
      <p>By: ${data.publishedBy}</p>
    </div>
  </div>
</div>

<!-- KPI row -->
<div class="kpi-row">
  <div class="kpi" style="border-top:3px solid #16a34a;">
    <div class="kpi-label">Scope 1</div>
    <div class="kpi-value" style="color:#16a34a;">${fmtT(data.scope1Kg)}</div>
    <div class="kpi-unit">tCO₂e &nbsp;·&nbsp; ${scope1Pct}</div>
  </div>
  <div class="kpi" style="border-top:3px solid #0ea5e9;">
    <div class="kpi-label">Scope 2 (location)</div>
    <div class="kpi-value" style="color:#0ea5e9;">${fmtT(data.scope2LocationKg)}</div>
    <div class="kpi-unit">tCO₂e &nbsp;·&nbsp; ${scope2LPct}</div>
  </div>
  ${data.scope2MarketKg > 0 ? `
  <div class="kpi" style="border-top:3px solid #67e8f9;">
    <div class="kpi-label">Scope 2 (market)</div>
    <div class="kpi-value" style="color:#0ea5e9;">${fmtT(data.scope2MarketKg)}</div>
    <div class="kpi-unit">tCO₂e (market-based)</div>
  </div>` : ""}
  <div class="kpi" style="border-top:3px solid #84cc16;">
    <div class="kpi-label">Scope 3</div>
    <div class="kpi-value" style="color:#84cc16;">${fmtT(data.scope3Kg)}</div>
    <div class="kpi-unit">tCO₂e &nbsp;·&nbsp; ${scope3Pct}</div>
  </div>
  <div class="kpi" style="border-top:3px solid #228B22;">
    <div class="kpi-label">Grand Total</div>
    <div class="kpi-value" style="color:#228B22;">${fmtT(data.totalKg)}</div>
    <div class="kpi-unit">tCO₂e (S1 + S2 LB + S3)</div>
  </div>
</div>

<div class="content">
  <!-- Progress vs baseline -->
  ${progressHtml}

  <!-- Scope bar chart -->
  <p class="section-title">Scope Proportions</p>
  <div class="scope-bar">
    ${data.scope1Kg > 0 ? `<div class="scope-bar-seg" style="width:${pct(data.scope1Kg, data.totalKg)};background:#16a34a;">S1</div>` : ""}
    ${data.scope2LocationKg > 0 ? `<div class="scope-bar-seg" style="width:${pct(data.scope2LocationKg, data.totalKg)};background:#0ea5e9;">S2</div>` : ""}
    ${data.scope3Kg > 0 ? `<div class="scope-bar-seg" style="width:${pct(data.scope3Kg, data.totalKg)};background:#84cc16;">S3</div>` : ""}
  </div>
  <div style="font-size:0.72rem;color:#6b7280;display:flex;gap:16px;margin-bottom:16px;">
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#16a34a;border-radius:2px;display:inline-block;"></span> Scope 1 (${scope1Pct})</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#0ea5e9;border-radius:2px;display:inline-block;"></span> Scope 2 (${scope2LPct})</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#84cc16;border-radius:2px;display:inline-block;"></span> Scope 3 (${scope3Pct})</span>
  </div>

  <!-- Scope 1 detail -->
  <p class="section-title">Scope 1 — Direct Emissions</p>
  <table>
    <thead><tr>
      <th>Category</th><th>Code</th>
      <th style="text-align:right;">CO₂ (tCO₂e)</th>
      <th style="text-align:right;">CH₄ (tCO₂e)</th>
      <th style="text-align:right;">N₂O (tCO₂e)</th>
      <th style="text-align:right;">Total (tCO₂e)</th>
    </tr></thead>
    <tbody>${catRows(s1Cats)}</tbody>
    <tfoot><tr style="background:#f0faf0;font-weight:700;">
      <td colspan="5" style="padding:9px 14px;font-size:0.82rem;">Scope 1 total</td>
      <td style="padding:9px 14px;text-align:right;font-variant-numeric:tabular-nums;color:#228B22;">${fmtT(data.scope1Kg)}</td>
    </tr></tfoot>
  </table>

  <!-- Scope 2 detail -->
  <p class="section-title">Scope 2 — Indirect Energy Emissions</p>
  <table>
    <thead><tr>
      <th>Category</th><th>Code</th>
      <th style="text-align:right;">CO₂ (tCO₂e)</th>
      <th style="text-align:right;">CH₄ (tCO₂e)</th>
      <th style="text-align:right;">N₂O (tCO₂e)</th>
      <th style="text-align:right;">Total (tCO₂e)</th>
    </tr></thead>
    <tbody>${catRows(s2Cats)}</tbody>
    <tfoot><tr style="background:#f0faf0;font-weight:700;">
      <td colspan="5" style="padding:9px 14px;font-size:0.82rem;">Scope 2 total (location-based)</td>
      <td style="padding:9px 14px;text-align:right;font-variant-numeric:tabular-nums;color:#0ea5e9;">${fmtT(data.scope2LocationKg)}</td>
    </tr></tfoot>
  </table>
  ${data.scope2MarketKg > 0 ? `<p style="font-size:0.78rem;color:#6b7280;margin:6px 0 0;">Scope 2 market-based total: <strong>${fmtT(data.scope2MarketKg)} tCO₂e</strong> (GHG Protocol dual-reporting; both location and market-based figures disclosed).</p>` : ""}

  <!-- Scope 3 detail -->
  <p class="section-title">Scope 3 — Value Chain Emissions</p>
  <table>
    <thead><tr>
      <th>Category</th><th>Code</th>
      <th style="text-align:right;">CO₂ (tCO₂e)</th>
      <th style="text-align:right;">CH₄ (tCO₂e)</th>
      <th style="text-align:right;">N₂O (tCO₂e)</th>
      <th style="text-align:right;">Total (tCO₂e)</th>
    </tr></thead>
    <tbody>${catRows(s3Cats)}</tbody>
    <tfoot><tr style="background:#f0faf0;font-weight:700;">
      <td colspan="5" style="padding:9px 14px;font-size:0.82rem;">Scope 3 total</td>
      <td style="padding:9px 14px;text-align:right;font-variant-numeric:tabular-nums;color:#84cc16;">${fmtT(data.scope3Kg)}</td>
    </tr></tfoot>
  </table>
  ${s3Cats.length < 15 ? `<p style="font-size:0.78rem;color:#6b7280;margin:8px 0 0;">
    Scope 3 categories with no activity data are excluded from this report.
    GHG Protocol requires disclosure of all relevant categories — ensure completeness for categories ${Object.entries(SCOPE3_CATEGORIES).filter(([k]) => !s3Cats.some(c => c.code.includes(k))).map(([,v]) => v).slice(0,3).join(", ")} where applicable.
  </p>` : ""}

  <!-- Gas breakdown -->
  <p class="section-title">Per-Gas Breakdown (GWP AR6)</p>
  ${gasTableHtml}

  <!-- Reporting assurance note -->
  <div style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
    <p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 8px;">Reporting Assurance &amp; Limitations</p>
    <p style="font-size:0.8rem;color:#374151;margin:0 0 4px;">
      This inventory is prepared in accordance with the GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition) and uses ${data.factorLibrary} emission factors with ${data.methodology} (GWP ${data.gwpVersion}).
    </p>
    <p style="font-size:0.8rem;color:#374151;margin:0;">
      Data is sourced from ${data.recordCount.toLocaleString("en-GB")} approved activity records. Immutable calculation snapshot v${data.snapshotVersion} published ${fmt(data.publishedAt)}.
      This report has not been externally assured — independent third-party verification is recommended for public disclosure.
    </p>
  </div>
</div>

<div class="footer">
  <span>${data.orgName} — GHG Protocol Inventory — ${data.periodLabel}</span>
  <span>v${data.snapshotVersion} · ${fmt(data.publishedAt)} · ${data.publishedBy} · CarbonSite</span>
</div>

</body>
</html>`;
}
