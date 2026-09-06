// PPN 006/21 Carbon Reduction Plan (CRP) report template.
// Required for UK government procurement contracts above £5m threshold.
// Covers: baseline year, Scope 1/2/3 emissions, net zero commitment, targets.
// Reference: Procurement Policy Note 06/21, HM Government.

import { esc, brandStyles, brandLogoHtml, svgDonut, svgHBars, SCOPE_COLORS } from "./shared";

export interface CrpScopeRow {
  scope: 1 | 2 | 3;
  category: string;
  kgCo2e: number;
  notes?: string;
}

export interface CrpTarget {
  year: number;
  reductionPct: number;
  description?: string;
}

export interface Ppn006CrpData {
  orgName: string;
  logoDataUri?: string;
  // Reporting period info
  periodLabel: string;
  baselineYear: number;
  reportingYear: number;
  // Totals (kgCO2e)
  scope1Kg: number;
  scope2Kg: number;
  scope3Kg: number;
  scope1BaselineKg?: number;
  scope2BaselineKg?: number;
  scope3BaselineKg?: number;
  // Breakdown rows
  scopeRows: CrpScopeRow[];
  // Targets
  targets: CrpTarget[];
  // Signatory (for attestation section)
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryDate?: string;
  // Net zero commitment year
  netZeroYear?: number;
  // Optional notes / methodology
  methodologyNotes?: string;
}

function fmtTCo2e(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " tCO2e";
}

function reductionPct(current: number, baseline: number): string {
  if (!baseline || baseline === 0) return "n/a";
  const pct = ((baseline - current) / baseline) * 100;
  return (pct >= 0 ? "-" : "+") + Math.abs(pct).toFixed(1) + "%";
}

export function renderPpn006CrpHtml(data: Ppn006CrpData): string {
  const totalKg = data.scope1Kg + data.scope2Kg + data.scope3Kg;
  const baselineKg = (data.scope1BaselineKg ?? 0) + (data.scope2BaselineKg ?? 0) + (data.scope3BaselineKg ?? 0);
  const hasBaseline = baselineKg > 0;

  // ── Charts ──────────────────────────────────────────────────────────────────

  const donutSlices = [
    { label: "Scope 1 — Direct", value: data.scope1Kg, scope: 1 as const },
    { label: "Scope 2 — Electricity", value: data.scope2Kg, scope: 2 as const },
    { label: "Scope 3 — Value chain", value: data.scope3Kg, scope: 3 as const },
  ].filter((s) => s.value > 0);

  const donutChart = svgDonut(donutSlices, {
    size: 148,
    title: "Scope split",
    unit: "tCO2e",
  });

  // Horizontal bars: top categories by scope row (aggregate same-scope rows)
  const barItems = [
    { label: "Scope 1 — Direct", value: data.scope1Kg, scope: 1 as const },
    { label: "Scope 2 — Electricity", value: data.scope2Kg, scope: 2 as const },
    { label: "Scope 3 — Value chain", value: data.scope3Kg, scope: 3 as const },
  ].filter((b) => b.value > 0);

  const scopeBarChart = svgHBars(barItems, { unit: "tCO2e" });

  // Per-category bars (from scopeRows)
  const categoryBars = [...data.scopeRows]
    .sort((a, b) => b.kgCo2e - a.kgCo2e)
    .map((r) => ({
      label: r.category,
      value: r.kgCo2e,
      color: SCOPE_COLORS[r.scope] ?? "#6366f1",
    }));
  const categoryBarChart = categoryBars.length > 0
    ? svgHBars(categoryBars, { unit: "tCO2e", barHeight: 14 })
    : "";

  // ── Baseline comparison bars (if available) ──────────────────────────────────
  const baselineBars = hasBaseline
    ? [
        {
          label: `Scope 1 — ${data.reportingYear}`,
          value: data.scope1Kg,
          color: SCOPE_COLORS[1],
        },
        ...(data.scope1BaselineKg
          ? [{ label: `Scope 1 — ${data.baselineYear} baseline`, value: data.scope1BaselineKg, color: "#d1fae5" }]
          : []),
        {
          label: `Scope 2 — ${data.reportingYear}`,
          value: data.scope2Kg,
          color: SCOPE_COLORS[2],
        },
        ...(data.scope2BaselineKg
          ? [{ label: `Scope 2 — ${data.baselineYear} baseline`, value: data.scope2BaselineKg, color: "#bae6fd" }]
          : []),
        {
          label: `Scope 3 — ${data.reportingYear}`,
          value: data.scope3Kg,
          color: SCOPE_COLORS[3],
        },
        ...(data.scope3BaselineKg
          ? [{ label: `Scope 3 — ${data.baselineYear} baseline`, value: data.scope3BaselineKg, color: "#d9f99d" }]
          : []),
      ]
    : [];

  // ── Table rows ───────────────────────────────────────────────────────────────

  const scopeRowsHtml = data.scopeRows
    .map(
      (r) => `
      <tr>
        <td>Scope ${r.scope}</td>
        <td>${esc(r.category)}</td>
        <td class="num">${fmtTCo2e(r.kgCo2e)}</td>
        <td>${esc(r.notes ?? "")}</td>
      </tr>`,
    )
    .join("");

  const targetsHtml = data.targets.length
    ? data.targets
        .map(
          (t) => `
          <tr>
            <td>${t.year}</td>
            <td>${t.reductionPct}% reduction vs ${data.baselineYear} baseline</td>
            <td>${esc(t.description ?? "")}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No targets defined</td></tr>`;

  const signatureSection = data.signatoryName
    ? `
      <div class="section sig-section">
        <h2>Attestation</h2>
        <p>I confirm the information in this Carbon Reduction Plan is accurate and a fair representation of the carbon emissions of ${esc(data.orgName)}.</p>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p class="sig-name">${esc(data.signatoryName)}</p>
          <p class="sig-title">${esc(data.signatoryTitle ?? "")}</p>
          <p class="sig-date">${esc(data.signatoryDate ?? "")}</p>
        </div>
      </div>`
    : "";

  const methodologySection = data.methodologyNotes
    ? `
      <div class="section">
        <h2>Methodology</h2>
        <p class="note-text">${esc(data.methodologyNotes)}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Carbon Reduction Plan — ${esc(data.orgName)}</title>
<style>
  ${brandStyles()}

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }

  .cover {
    background: linear-gradient(135deg, #083b10 0%, #1a6b1a 50%, #228B22 100%);
    color: #fff;
    padding: 56px 48px;
    min-height: 200px;
  }
  .cover .brand-name-fallback { color: #fff; }
  .cover-eyebrow { font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.7; margin-bottom: 12px; }
  .cover-title { font-size: 28pt; font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
  .cover-org { font-size: 15pt; opacity: 0.9; }
  .cover-period { font-size: 10pt; opacity: 0.7; margin-top: 4px; }

  .content { padding: 0 48px 48px; }

  .kpi-row { display: flex; gap: 16px; margin: 32px 0 24px; flex-wrap: wrap; }
  .kpi-card {
    flex: 1; min-width: 140px;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px 18px;
  }
  .kpi-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 6px; }
  .kpi-value { font-size: 18pt; font-weight: 700; color: #0f3e17; }
  .kpi-sub { font-size: 8pt; color: #888; margin-top: 3px; }
  .kpi-delta { font-size: 9pt; font-weight: 600; margin-top: 4px; color: #228B22; }

  .chart-section { display: flex; gap: 40px; align-items: flex-start; margin: 32px 0 0; flex-wrap: wrap; }
  .chart-col { flex: 1; min-width: 200px; }
  .chart-col h3 { font-size: 10pt; font-weight: 700; color: #083b10; margin-bottom: 8px; }

  .section { margin-top: 36px; }
  .section h2 {
    font-size: 13pt; font-weight: 700; color: #083b10;
    border-bottom: 2px solid #228B22;
    padding-bottom: 6px; margin-bottom: 16px;
  }
  .section p { font-size: 10pt; line-height: 1.6; color: #333; margin-bottom: 10px; }

  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 10px; }
  th { background: #f0faf0; color: #0f3e17; text-align: left; padding: 8px 12px; font-weight: 600; font-size: 9pt; }
  td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.empty { color: #888; font-style: italic; text-align: center; }

  .commitment-box {
    background: #f0faf0;
    border: 1.5px solid #228B22;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 20px 0;
  }
  .commitment-box strong { color: #083b10; }

  .sig-section { margin-top: 48px; }
  .sig-block { margin-top: 24px; max-width: 320px; }
  .sig-line { border-bottom: 1.5px solid #222; height: 40px; margin-bottom: 6px; }
  .sig-name { font-weight: 600; font-size: 10pt; }
  .sig-title { font-size: 9pt; color: #555; }
  .sig-date { font-size: 9pt; color: #888; margin-top: 3px; }

  .note-text { font-size: 9pt; color: #555; background: #f9fafb; border-left: 3px solid #228B22; padding: 10px 14px; border-radius: 0 4px 4px 0; }

  .footer {
    margin-top: 48px; padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 8pt; color: #aaa; text-align: center;
  }
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(data.logoDataUri, data.orgName)}
  <div class="cover-eyebrow">Procurement Policy Note 06/21 — PPN 006/21</div>
  <div class="cover-title">Carbon Reduction Plan</div>
  <div class="cover-org">${esc(data.orgName)}</div>
  <div class="cover-period">${esc(data.periodLabel)} &nbsp;|&nbsp; Reporting Year: ${data.reportingYear} &nbsp;|&nbsp; Baseline: ${data.baselineYear}</div>
</div>

<div class="content">

  <!-- KPI summary -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">Total GHG Emissions</div>
      <div class="kpi-value">${fmtTCo2e(totalKg)}</div>
      ${hasBaseline ? `<div class="kpi-delta">${reductionPct(totalKg, baselineKg)} vs ${data.baselineYear}</div>` : ""}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Scope 1 (Direct)</div>
      <div class="kpi-value">${fmtTCo2e(data.scope1Kg)}</div>
      ${hasBaseline && data.scope1BaselineKg ? `<div class="kpi-delta">${reductionPct(data.scope1Kg, data.scope1BaselineKg)} vs baseline</div>` : ""}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Scope 2 (Electricity)</div>
      <div class="kpi-value">${fmtTCo2e(data.scope2Kg)}</div>
      ${hasBaseline && data.scope2BaselineKg ? `<div class="kpi-delta">${reductionPct(data.scope2Kg, data.scope2BaselineKg)} vs baseline</div>` : ""}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Scope 3 (Value Chain)</div>
      <div class="kpi-value">${fmtTCo2e(data.scope3Kg)}</div>
      ${hasBaseline && data.scope3BaselineKg ? `<div class="kpi-delta">${reductionPct(data.scope3Kg, data.scope3BaselineKg)} vs baseline</div>` : ""}
    </div>
  </div>

  <!-- Analytics charts -->
  <div class="chart-section">
    <div class="chart-col">
      <h3>Scope distribution</h3>
      ${donutChart}
    </div>
    <div class="chart-col">
      <h3>Emissions by scope</h3>
      ${scopeBarChart}
      ${categoryBars.length > 0 ? `<h3 style="margin-top:16px;">By category</h3>${categoryBarChart}` : ""}
    </div>
  </div>

  ${hasBaseline && baselineBars.length > 0 ? `
  <div class="section">
    <h2>Year-on-year comparison</h2>
    <p>Reporting year vs ${data.baselineYear} baseline across all scopes.</p>
    ${svgHBars(baselineBars, { unit: "tCO2e", barHeight: 14 })}
  </div>` : ""}

  <!-- Commitment -->
  <div class="section">
    <h2>Commitment to Net Zero</h2>
    <div class="commitment-box">
      <strong>${esc(data.orgName)}</strong> is committed to achieving Net Zero emissions
      ${data.netZeroYear ? `by <strong>${data.netZeroYear}</strong>` : "in line with the UK Government's 2050 target"}.
      This Carbon Reduction Plan has been submitted in response to the procurement requirements of HM Government
      and demonstrates our commitment to measuring, reporting, and reducing our greenhouse gas emissions.
    </div>
    <p>
      This plan covers our UK operations and is prepared in accordance with the GHG Protocol Corporate Standard
      (GWP AR6), DEFRA 2025 emission factors, and Procurement Policy Note 06/21.
    </p>
  </div>

  <!-- Emission breakdown -->
  <div class="section">
    <h2>Greenhouse Gas Emissions</h2>
    <p>All figures are in tonnes CO2e (tCO2e) for the reporting year ${data.reportingYear}.</p>
    <table>
      <thead>
        <tr>
          <th>Scope</th>
          <th>Category</th>
          <th style="text-align:right">Emissions (tCO2e)</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${scopeRowsHtml}
        <tr style="background:#f0faf0; font-weight:600;">
          <td colspan="2">Total</td>
          <td class="num">${fmtTCo2e(totalKg)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Reduction targets -->
  <div class="section">
    <h2>Reduction Targets</h2>
    <table>
      <thead>
        <tr><th>Target Year</th><th>Target</th><th>Supporting Actions</th></tr>
      </thead>
      <tbody>${targetsHtml}</tbody>
    </table>
  </div>

  ${methodologySection}
  ${signatureSection}

  <div class="footer">
    ${esc(data.orgName)} — Carbon Reduction Plan — ${esc(data.periodLabel)} —
    Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} —
    Prepared using MetricOra (GHG Protocol v2026-01, GWP AR6)
  </div>

</div>
</body>
</html>`;
}
