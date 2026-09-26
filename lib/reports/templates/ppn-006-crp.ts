// PPN 006 Carbon Reduction Plan (CRP) report template.
// Required for UK government procurement contracts above £5m a year.
// Covers: baseline year, Scope 1/2/3 emissions, net zero commitment, targets.
// Reference: Procurement Policy Note 006 (2025), HM Government.

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
  /// Undefined when the organisation has no base year yet.
  baselineYear?: number;
  reportingYear: number;
  // The run's library and methodology, printed as the basis of the figures.
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
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
  /// Sections written in the guided plan (lib/crp/plan.ts). Absent for a plan
  /// generated straight from the report form.
  plan?: {
    companyNumber: string;
    publicationUrl: string;
    description: string;
    boundaryApproach: string;
    sitesIncluded: string;
    exclusions: { item: string; reason: string }[];
    baselineRationale: string;
    baselineDetails: string;
    scope3: { label: string; tonnes: number | null; status: string; explanation: string }[];
    sbtiValidated: boolean;
    trajectoryNote: string;
    completed: { name: string; year: string; description: string; savingTco2e: string }[];
    planned: { name: string; year: string; description: string; savingTco2e: string }[];
    futureNote: string;
    boardApproved: boolean;
  };
}

const SCOPE3_STATUS_LABEL: Record<string, string> = {
  reported: "Reported",
  not_relevant: "Not relevant",
  not_yet_measured: "Not yet measured",
};

function planSections(data: Ppn006CrpData): { supplier: string; baseline: string; scope3: string; projects: string } {
  const p = data.plan;
  if (!p) return { supplier: "", baseline: "", scope3: "", projects: "" };
  const para = (t: string) => (t ? `<p>${esc(t).replace(/\n/g, "<br />")}</p>` : "");
  const measureRows = (rows: typeof p.completed) =>
    rows
      .map(
        (m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.year)}</td><td>${esc(m.description)}</td><td class="num">${m.savingTco2e !== "" && Number(m.savingTco2e) > 0 ? `${Number(m.savingTco2e).toLocaleString("en-GB", { maximumFractionDigits: 1 })} tCO2e` : "Not estimated"}</td></tr>`,
      )
      .join("");
  const supplier = `
  <div class="section">
    <h2>Supplier and scope of this plan</h2>
    <table>
      <tr><td style="width:34%">Supplier name</td><td>${esc(data.orgName)}</td></tr>
      ${p.companyNumber ? `<tr><td>Company number</td><td>${esc(p.companyNumber)}</td></tr>` : ""}
      <tr><td>Reporting period</td><td>${esc(data.periodLabel)}</td></tr>
      <tr><td>Organisational boundary</td><td>${esc(p.boundaryApproach)}</td></tr>
      <tr><td>Published at</td><td>${esc(p.publicationUrl)}</td></tr>
    </table>
    ${para(p.description)}
    <h3 class="sub">Sites and activities covered</h3>
    ${para(p.sitesIncluded)}
    ${
      p.exclusions.length
        ? `<h3 class="sub">Exclusions</h3><table><thead><tr><th>Excluded</th><th>Reason</th></tr></thead><tbody>${p.exclusions.map((e) => `<tr><td>${esc(e.item)}</td><td>${esc(e.reason)}</td></tr>`).join("")}</tbody></table>`
        : ""
    }
  </div>`;
  const baseline = `
  <div class="section">
    <h2>Baseline emissions footprint</h2>
    <p>Baseline year: <strong>${data.baselineYear ?? "not set"}</strong>. Baseline emissions are a record of the greenhouse gases produced in the past, before any carbon reduction strategies, and are the reference point against which emissions reduction is measured.</p>
    <h3 class="sub">Why this baseline year was chosen</h3>
    ${para(p.baselineRationale)}
    ${p.baselineDetails ? `<h3 class="sub">Additional details</h3>${para(p.baselineDetails)}` : ""}
  </div>`;
  const scope3 = `
  <div class="section">
    <h2>Scope 3 categories required by PPN 006</h2>
    <table>
      <thead><tr><th>Category</th><th>Status</th><th style="text-align:right">Emissions</th><th>Notes</th></tr></thead>
      <tbody>${p.scope3
        .map(
          (c) => `<tr><td>${esc(c.label)}</td><td>${esc(SCOPE3_STATUS_LABEL[c.status] ?? c.status)}</td><td class="num">${c.tonnes != null ? fmtTCo2e(c.tonnes * 1000) : "None recorded"}</td><td>${esc(c.explanation)}</td></tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>`;
  const projects = `
  <div class="section">
    <h2>Carbon reduction projects</h2>
    <h3 class="sub">Completed carbon reduction initiatives</h3>
    <p>The following measures have been completed since the ${data.baselineYear ?? ""} baseline. Savings are estimated by ${esc(data.orgName)}.</p>
    ${p.completed.length ? `<table><thead><tr><th>Measure</th><th>Year</th><th>Description</th><th style="text-align:right">Est. saving a year</th></tr></thead><tbody>${measureRows(p.completed)}</tbody></table>` : `<p class="note-text">No completed measures recorded.</p>`}
    <h3 class="sub">Planned carbon reduction initiatives</h3>
    <p>In the future we will implement further measures such as:</p>
    ${p.planned.length ? `<table><thead><tr><th>Measure</th><th>Year</th><th>Description</th><th style="text-align:right">Est. saving a year</th></tr></thead><tbody>${measureRows(p.planned)}</tbody></table>` : `<p class="note-text">No planned measures recorded.</p>`}
    ${para(p.futureNote)}
    ${p.sbtiValidated ? `<p>Our targets have been validated by the Science Based Targets initiative.</p>` : ""}
    ${para(p.trajectoryNote)}
  </div>`;
  return { supplier, baseline, scope3, projects };
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
  const hasBaseline = baselineKg > 0 && data.baselineYear !== undefined;
  const baselineLabel = data.baselineYear !== undefined ? `${data.baselineYear} baseline` : "baseline";

  // ── Charts ──────────────────────────────────────────────────────────────────

  const donutSlices = [
    { label: "Scope 1 direct", value: data.scope1Kg, scope: 1 as const },
    { label: "Scope 2 energy", value: data.scope2Kg, scope: 2 as const },
    { label: "Scope 3 value chain", value: data.scope3Kg, scope: 3 as const },
  ].filter((s) => s.value > 0);

  const donutChart = svgDonut(donutSlices, {
    size: 148,
    title: "Scope split",
    unit: "tCO2e",
  });

  // Horizontal bars: top categories by scope row (aggregate same-scope rows)
  const barItems = [
    { label: "Scope 1 direct", value: data.scope1Kg, scope: 1 as const },
    { label: "Scope 2 energy", value: data.scope2Kg, scope: 2 as const },
    { label: "Scope 3 value chain", value: data.scope3Kg, scope: 3 as const },
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
          label: `Scope 1, ${data.reportingYear}`,
          value: data.scope1Kg,
          color: SCOPE_COLORS[1],
        },
        ...(data.scope1BaselineKg
          ? [{ label: `Scope 1, ${baselineLabel}`, value: data.scope1BaselineKg, color: "#d1fae5" }]
          : []),
        {
          label: `Scope 2, ${data.reportingYear}`,
          value: data.scope2Kg,
          color: SCOPE_COLORS[2],
        },
        ...(data.scope2BaselineKg
          ? [{ label: `Scope 2, ${baselineLabel}`, value: data.scope2BaselineKg, color: "#bae6fd" }]
          : []),
        {
          label: `Scope 3, ${data.reportingYear}`,
          value: data.scope3Kg,
          color: SCOPE_COLORS[3],
        },
        ...(data.scope3BaselineKg
          ? [{ label: `Scope 3, ${baselineLabel}`, value: data.scope3BaselineKg, color: "#d9f99d" }]
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
            <td>${t.reductionPct}% reduction vs ${baselineLabel}</td>
            <td>${esc(t.description ?? "")}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No reduction target has been set. Add one under Targets before submitting this plan.</td></tr>`;

  const extra = planSections(data);
  const signatureSection = data.signatoryName
    ? `
      <div class="section sig-section">
        <h2>Declaration and sign off</h2>
        <p>This Carbon Reduction Plan has been completed in accordance with PPN 006 and associated guidance and reporting standard for Carbon Reduction Plans.</p>
        <p>Emissions have been reported and recorded in accordance with the published reporting standard for Carbon Reduction Plans and the GHG Reporting Protocol corporate standard, and use the appropriate Government emission conversion factors for greenhouse gas company reporting (${esc(data.factorLibrary)}).</p>
        <p>Scope 1 and Scope 2 emissions have been reported in accordance with SECR requirements, and the required subset of Scope 3 emissions have been reported in accordance with the published reporting standard for Carbon Reduction Plans and the Corporate Value Chain (Scope 3) Standard.</p>
        ${data.plan?.boardApproved ? `<p>This Carbon Reduction Plan has been reviewed and signed off by the board of directors (or equivalent management body).</p>` : ""}
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
<title>Carbon Reduction Plan, ${esc(data.orgName)}</title>
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

  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 32px 0 24px; }
  .kpi-card {
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px 18px;
  }
  .kpi-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 6px; }
  .kpi-value { font-size: 14pt; white-space: nowrap; font-weight: 700; color: #0f3e17; }
  .kpi-sub { font-size: 8pt; color: #888; margin-top: 3px; }
  .kpi-delta { font-size: 9pt; font-weight: 600; margin-top: 4px; color: #228B22; }

  .chart-section { display: grid; gap: 24px; margin: 32px 0 0; }
  .chart-col { min-width: 0; }
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
  h3.sub { font-size: 10.5pt; font-weight: 700; color: #083b10; margin: 14px 0 6px; }

  .sig-section { margin-top: 48px; page-break-inside: avoid; }
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
  ${brandLogoHtml(data.logoDataUri)}
  <div class="cover-eyebrow">PPN 006 Carbon Reduction Plan</div>
  <div class="cover-title">Carbon Reduction Plan</div>
  <div class="cover-org">${esc(data.orgName)}</div>
  <div class="cover-period">${esc(data.periodLabel)} &nbsp;|&nbsp; Reporting year: ${data.reportingYear} &nbsp;|&nbsp; Baseline: ${data.baselineYear ?? "not set"}</div>
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
      <div class="kpi-label">Scope 2 (Energy)</div>
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
      This plan is prepared in accordance with the GHG Protocol Corporate Standard and Procurement Policy Note 006,
      using ${esc(data.factorLibrary)} emission factors and ${esc(data.gwpVersion)} global warming potentials.
      Scope 2 is reported location-based.
    </p>
  </div>

  ${extra.supplier}
  ${extra.baseline}

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

  ${extra.scope3}

  <!-- Reduction targets -->
  <div class="section">
    <h2>Reduction Targets</h2>
    <table>
      <thead>
        <tr><th>Target Year</th><th>Target</th><th>Covers</th></tr>
      </thead>
      <tbody>${targetsHtml}</tbody>
    </table>
  </div>

  ${extra.projects}
  ${methodologySection}
  ${signatureSection}

  <div class="footer">
    ${esc(data.orgName)} · Carbon Reduction Plan · ${esc(data.periodLabel)} ·
    Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} ·
    Prepared with MetricOra (${esc(data.methodology)}, ${esc(data.factorLibrary)}, ${esc(data.gwpVersion)})
  </div>

</div>
</body>
</html>`;
}
