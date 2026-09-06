// lib/reports/templates/cdp.ts
// CDP (Carbon Disclosure Project) Climate Change questionnaire HTML template.
// Covers modules C5 (Methodology), C6 (Scope 1 + 2 emissions), C7 (Scope 3),
// and C8 (Energy) — the core modules relevant to MetricOra's dataset.

import { brandStyles, esc } from "./shared";

export interface CdpCategoryRow {
  code: string;
  name: string;
  scope: number;
  totalKg: number;
}

export interface CdpData {
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
  scope1Tonnes: number;
  scope2LocationTonnes: number;
  scope2MarketTonnes: number;
  scope3Tonnes: number;
  totalTonnes: number;
  co2Tonnes?: number;
  ch4Tonnes?: number;
  n2oTonnes?: number;
  biogenicCo2Tonnes?: number;
  recordCount: number;
  categories: CdpCategoryRow[];
  // Optional enrichment
  netZeroTargetYear?: number;
  baselineYear?: string;
  baselineTonnes?: number;
  revenueGbp?: number;        // for C6.10 intensity
  employeeCount?: number;     // for C6.10 intensity
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtN(n: number, dp = 3) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

const SCOPE3_CATEGORY_LABELS: Record<number, string> = {
  1:  "Cat. 1 — Purchased goods and services",
  2:  "Cat. 2 — Capital goods",
  3:  "Cat. 3 — Fuel and energy-related activities",
  4:  "Cat. 4 — Upstream transportation and distribution",
  5:  "Cat. 5 — Waste generated in operations",
  6:  "Cat. 6 — Business travel",
  7:  "Cat. 7 — Employee commuting",
  8:  "Cat. 8 — Upstream leased assets",
  9:  "Cat. 9 — Downstream transportation and distribution",
  10: "Cat. 10 — Processing of sold products",
  11: "Cat. 11 — Use of sold products",
  12: "Cat. 12 — End-of-life treatment of sold products",
  13: "Cat. 13 — Downstream leased assets",
  14: "Cat. 14 — Franchises",
  15: "Cat. 15 — Investments",
};

export function renderCdpHtml(data: CdpData): string {
  const s3Cats = data.categories.filter((c) => c.scope === 3);
  const s1Cats = data.categories.filter((c) => c.scope === 1);
  const hasBaseline = data.baselineYear !== undefined && data.baselineTonnes !== undefined;

  const logoHtml = data.logoDataUri
    ? `<img src="${esc(data.logoDataUri)}" alt="${esc(data.orgName)} logo" style="height:44px;max-width:180px;object-fit:contain;">`
    : `<span style="font-size:1.1rem;font-weight:700;color:#228B22;">${esc(data.orgName)}</span>`;

  const reductionVsBaseline =
    hasBaseline && data.baselineTonnes! > 0
      ? ((data.baselineTonnes! - data.totalTonnes) / data.baselineTonnes!) * 100
      : null;

  const intensityRevenue =
    data.revenueGbp && data.revenueGbp > 0
      ? data.totalTonnes / (data.revenueGbp / 1_000_000)
      : null;

  const intensityEmployee =
    data.employeeCount && data.employeeCount > 0
      ? data.totalTonnes / data.employeeCount
      : null;

  const questionBlock = (id: string, title: string, content: string) => `
    <div class="question-block">
      <div class="q-header">
        <span class="q-id">${id}</span>
        <span class="q-title">${title}</span>
      </div>
      <div class="q-body">${content}</div>
    </div>`;

  const row2 = (label: string, value: string, note?: string) => `
    <tr>
      <td class="row-label">${label}</td>
      <td class="row-value">${value}</td>
      ${note ? `<td class="row-note">${note}</td>` : `<td></td>`}
    </tr>`;

  const c5 = `
    ${questionBlock("C5.1", "Describe your methodology for calculating your Scope 1 and 2 emissions.",
      `<table class="data-table">
        ${row2("Accounting standard", "GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition)")}
        ${row2("Methodology version", esc(data.methodology))}
        ${row2("GWP dataset", `IPCC AR6 (${esc(data.gwpVersion)})`)}
        ${row2("Emission factor library", esc(data.factorLibrary))}
        ${row2("Scope 2 methods", "Location-based and market-based (dual-reporting per GHG Protocol Scope 2 Guidance)")}
        ${row2("Consolidation approach", "Operational control (default)")}
        ${row2("Reporting period", `${fmt(data.periodStart)} to ${fmt(data.periodEnd)}`)}
        ${row2("Activity records", `${data.recordCount.toLocaleString("en-GB")} records`)}
      </table>`
    )}
    ${questionBlock("C5.2", "Provide any additional context on your emission calculation methodology.",
      `<p>Calculations performed using MetricOra v${data.snapshotVersion}, applying DEFRA 2025 conversion factors for UK activities.
       Scope 1 includes stationary combustion, mobile combustion, and fugitive emissions.
       Scope 2 location-based uses UK grid average emission factors; market-based uses supplier-specific or residual mix factors where available.
       Scope 3 categories reported where material data is available. GWP values: CH4 = 27.9, N2O = 273 (AR6 100-year).</p>`
    )}`;

  const c6 = `
    ${questionBlock("C6.1", "Describe your Scope 1 and 2 emissions.",
      `<table class="data-table">
        <thead><tr><th>Category</th><th>Metric tonnes CO₂e</th></tr></thead>
        <tbody>
          ${row2("Scope 1 (direct)", fmtN(data.scope1Tonnes))}
          ${row2("Scope 2 (location-based)", fmtN(data.scope2LocationTonnes))}
          ${row2("Scope 2 (market-based)", fmtN(data.scope2MarketTonnes))}
          ${row2("Total Scope 1 + 2 (location-based)", fmtN(data.scope1Tonnes + data.scope2LocationTonnes), "Preferred for CDP intensity")}
          ${row2("Total Scope 1 + 2 (market-based)", fmtN(data.scope1Tonnes + data.scope2MarketTonnes))}
        </tbody>
      </table>`
    )}
    ${questionBlock("C6.2", "Describe your Scope 1 emissions by constituent gas.",
      data.co2Tonnes !== undefined || data.ch4Tonnes !== undefined || data.n2oTonnes !== undefined
        ? `<table class="data-table">
            <thead><tr><th>Gas</th><th>Metric tonnes CO₂e (AR6 GWP)</th><th>Notes</th></tr></thead>
            <tbody>
              ${data.co2Tonnes !== undefined ? row2("CO₂ (biogenic excluded)", fmtN(data.co2Tonnes)) : ""}
              ${data.ch4Tonnes !== undefined ? row2("CH₄ (×27.9 AR6)", fmtN(data.ch4Tonnes), "CH4 contribution to CO2e") : ""}
              ${data.n2oTonnes !== undefined ? row2("N₂O (×273 AR6)", fmtN(data.n2oTonnes), "N2O contribution to CO2e") : ""}
              ${data.biogenicCo2Tonnes !== undefined ? row2("Biogenic CO₂ (memo item)", fmtN(data.biogenicCo2Tonnes), "Not included in Scope 1 total") : ""}
            </tbody>
          </table>`
        : `<p class="not-reported">Per-gas breakdown not available — enable gas-level tracking in emission factors to populate this question.</p>`
    )}
    ${questionBlock("C6.3", "Where do your Scope 1 emissions originate?",
      s1Cats.length > 0
        ? `<table class="data-table">
            <thead><tr><th>Source category</th><th>tCO₂e</th><th>% of Scope 1</th></tr></thead>
            <tbody>${s1Cats.map((c) => {
              const pct = data.scope1Tonnes > 0 ? (c.totalKg / 1000 / data.scope1Tonnes * 100).toFixed(1) : "—";
              return `<tr><td class="row-label">${esc(c.name)}</td><td class="row-value">${fmtN(c.totalKg / 1000)}</td><td class="row-value">${pct}%</td></tr>`;
            }).join("")}</tbody>
          </table>`
        : `<p class="not-reported">No Scope 1 categories found for this reporting period.</p>`
    )}
    ${questionBlock("C6.10", "Describe your Scope 1 and 2 emissions performance metrics.",
      (() => {
        const baselineRow = hasBaseline && reductionVsBaseline !== null
          ? row2(
              `Change vs baseline (${esc(data.baselineYear)})`,
              `${reductionVsBaseline >= 0 ? "-" : "+"}${Math.abs(reductionVsBaseline).toFixed(1)}% (${fmtN(data.baselineTonnes!)} to ${fmtN(data.totalTonnes)} tCO2e)`,
              "Absolute change"
            )
          : row2("Baseline comparison", "No baseline configured", "Set baseline year and value in target settings");
        return `<table class="data-table">
          ${baselineRow}
          ${intensityRevenue !== null ? row2("Intensity (tCO2e per M revenue)", fmtN(intensityRevenue, 2)) : ""}
          ${intensityEmployee !== null ? row2("Intensity (tCO2e per employee)", fmtN(intensityEmployee, 2)) : ""}
          ${data.netZeroTargetYear ? row2("Net zero target year", String(data.netZeroTargetYear)) : ""}
        </table>`;
      })()
    )}`;

  const c7 = `
    ${questionBlock("C7.1", "Does your organization measure its Scope 3 emissions?",
      data.scope3Tonnes > 0
        ? `<p>Yes — Scope 3 emissions are measured and reported for material categories below.</p>`
        : `<p>Not currently reported — insufficient data to populate Scope 3 categories for this period.</p>`
    )}
    ${data.scope3Tonnes > 0 ? questionBlock("C7.9", "Scope 3 category breakdown (reported categories).",
      `<table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>tCO₂e</th>
            <th>% of Scope 3</th>
            <th>Evaluation status</th>
          </tr>
        </thead>
        <tbody>
          ${s3Cats.map((c) => {
            const pct = data.scope3Tonnes > 0 ? (c.totalKg / 1000 / data.scope3Tonnes * 100).toFixed(1) : "—";
            return `<tr>
              <td class="row-label">${esc(c.name)}</td>
              <td class="row-value">${fmtN(c.totalKg / 1000)}</td>
              <td class="row-value">${pct}%</td>
              <td class="row-value" style="color:#228B22;">Relevant, calculated</td>
            </tr>`;
          }).join("")}
          <tr style="font-weight:700;background:#f0faf0;">
            <td class="row-label">Total Scope 3</td>
            <td class="row-value">${fmtN(data.scope3Tonnes)}</td>
            <td class="row-value">100%</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <p class="footnote">Categories not listed above have been evaluated and determined not material or not available for this reporting period.</p>`
    ) : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CDP Climate Change Response — ${esc(data.orgName)} — ${esc(data.periodLabel)}</title>
<style>
${brandStyles()}
body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff; font-size: 0.88rem; }
.header { background: linear-gradient(135deg, #006400 0%, #228B22 60%, #32CD32 100%); color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
.header-left h1 { margin: 8px 0 4px; font-size: 1.3rem; font-weight: 700; }
.header-left p { margin: 2px 0; font-size: 0.85rem; opacity: 0.85; }
.badge { display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; padding: 3px 10px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.05em; margin-top: 10px; }
.kpi-row { display: flex; gap: 12px; padding: 20px 32px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
.kpi { flex: 1; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
.kpi-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
.kpi-value { font-size: 1.4rem; font-weight: 700; color: #228B22; font-variant-numeric: tabular-nums; }
.kpi-unit { font-size: 0.72rem; color: #9ca3af; margin-top: 2px; }
.content { padding: 20px 32px; }
.module-header { background: #228B22; color: white; padding: 8px 16px; margin: 28px 0 0; border-radius: 6px 6px 0 0; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.question-block { border: 1px solid #e5e7eb; border-top: none; padding: 16px; margin-bottom: 2px; }
.question-block:last-child { border-radius: 0 0 6px 6px; }
.q-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.q-id { font-size: 0.72rem; font-weight: 700; color: #228B22; background: #f0faf0; border: 1px solid #d1fae5; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
.q-title { font-size: 0.82rem; font-weight: 600; color: #111827; }
.q-body { font-size: 0.82rem; color: #374151; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.82rem; }
.data-table thead th { background: #f0faf0; color: #0f3e17; padding: 7px 12px; text-align: left; font-size: 0.75rem; font-weight: 600; border-bottom: 2px solid #d1fae5; }
.data-table tbody tr:hover { background: #fafafa; }
.row-label { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
.row-value { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; font-variant-numeric: tabular-nums; text-align: right; color: #111827; font-weight: 500; }
.row-note { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; color: #9ca3af; font-size: 0.75rem; font-style: italic; }
.not-reported { color: #9ca3af; font-style: italic; font-size: 0.82rem; padding: 8px 0; }
.footnote { font-size: 0.75rem; color: #9ca3af; margin-top: 8px; font-style: italic; }
.notice { background: #fff8e1; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; font-size: 0.8rem; color: #7a5c00; margin: 20px 0; }
.footer { border-top: 1px solid #e5e7eb; padding: 16px 32px; background: #f9fafb; font-size: 0.72rem; color: #9ca3af; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <div>${logoHtml}</div>
    <h1>CDP Climate Change — Emissions Response</h1>
    <p>Modules C5, C6, C7 — Methodology, Scope 1, 2 &amp; 3 Emissions</p>
    <p>${esc(data.periodLabel)} &nbsp;|&nbsp; ${fmt(data.periodStart)} – ${fmt(data.periodEnd)}</p>
    <span class="badge">CDP CLIMATE CHANGE · FULL DISCLOSURE</span>
  </div>
  <div style="text-align:right;font-size:0.8rem;opacity:0.85;">
    <p>Responding organisation: <strong>${esc(data.orgName)}</strong></p>
    <p>Snapshot: v${data.snapshotVersion}</p>
    <p>Generated: ${fmt(data.publishedAt)}</p>
    <p>By: ${esc(data.publishedBy)}</p>
  </div>
</div>

<!-- KPI row -->
<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">Scope 1</div>
    <div class="kpi-value">${fmtN(data.scope1Tonnes)}</div>
    <div class="kpi-unit">tCO₂e</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Scope 2 (LB)</div>
    <div class="kpi-value">${fmtN(data.scope2LocationTonnes)}</div>
    <div class="kpi-unit">tCO₂e</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Scope 2 (MB)</div>
    <div class="kpi-value">${fmtN(data.scope2MarketTonnes)}</div>
    <div class="kpi-unit">tCO₂e</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Scope 3</div>
    <div class="kpi-value">${fmtN(data.scope3Tonnes)}</div>
    <div class="kpi-unit">tCO₂e</div>
  </div>
  <div class="kpi" style="border-color:#228B22;">
    <div class="kpi-label">Total (S1+S2+S3)</div>
    <div class="kpi-value">${fmtN(data.totalTonnes)}</div>
    <div class="kpi-unit">tCO₂e</div>
  </div>
  ${hasBaseline && reductionVsBaseline !== null ? `
  <div class="kpi" style="border-color:${reductionVsBaseline >= 0 ? "#228B22" : "#f59e0b"};">
    <div class="kpi-label">vs ${esc(data.baselineYear)} baseline</div>
    <div class="kpi-value" style="color:${reductionVsBaseline >= 0 ? "#228B22" : "#d97706"};">${reductionVsBaseline >= 0 ? "-" : "+"}${Math.abs(reductionVsBaseline).toFixed(1)}%</div>
    <div class="kpi-unit">absolute change</div>
  </div>` : ""}
</div>

<!-- Content -->
<div class="content">

  <div class="notice">
    📋 <strong>CDP submission notice:</strong> This document pre-populates the relevant data for CDP modules C5, C6, and C7.
    Review each answer against your CDP questionnaire portal before submission. Additional qualitative responses and governance questions
    (C1–C4, C12–C15) must be completed directly in the CDP portal.
  </div>

  <!-- Module C5 -->
  <div class="module-header">C5 — Emissions Methodology</div>
  ${c5}

  <!-- Module C6 -->
  <div class="module-header">C6 — Scope 1 and 2 Emissions</div>
  ${c6}

  <!-- Module C7 -->
  <div class="module-header">C7 — Scope 3 Emissions</div>
  ${c7}

  <p style="margin-top:28px;font-size:0.78rem;color:#6b7280;">
    This document was generated automatically from the published snapshot v${data.snapshotVersion} using ${esc(data.factorLibrary)}.
    All figures are in metric tonnes of CO₂ equivalent (tCO₂e) using AR6 GWP values.
    CDP submission is made directly through the CDP portal at <em>cdp.net</em>.
    Data generated: ${fmt(data.publishedAt)} by ${esc(data.publishedBy)}.
  </p>
</div>

<!-- Footer -->
<div class="footer">
  <span>${esc(data.orgName)} — CDP Climate Change Response — ${esc(data.periodLabel)}</span>
  <span>Snapshot v${data.snapshotVersion} · Generated ${fmt(data.publishedAt)} · ${esc(data.factorLibrary)}</span>
</div>

</body>
</html>`;
}
