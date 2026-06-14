// PPN 06/21 Carbon Reduction Plan — mandatory for UK government contracts >£5m (from Feb 2025)
// Template aligns with Crown Commercial Service CRP requirements.

import { esc } from "./shared";

export type Ppn0621Data = {
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
  // Emissions by scope
  scope1Tonnes: number;
  scope2Tonnes: number;
  scope3Tonnes: number;
  totalTonnes: number;
  baselineYear?: string;
  baselineTonnes?: number;
  // Net zero commitment
  netZeroTargetYear: number;
  interimTargetYear?: number;
  interimReductionPct?: number;
  // Initiatives / actions
  initiatives: Array<{ name: string; expectedImpactTonnes?: number; status: string }>;
  // Scopes reported
  scopesReported: string[];
  recordCount: number;
};

export function renderPpn0621Html(d: Ppn0621Data): string {
  const fmt = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fmtT = (n: number) => `${fmt(n, 2)} tCO₂e`;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pStart = d.periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pEnd = d.periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const reductionPct = d.baselineTonnes && d.baselineTonnes > 0
    ? ((1 - d.totalTonnes / d.baselineTonnes) * 100).toFixed(1)
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Carbon Reduction Plan — ${esc(d.orgName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .cover { background: #00703c; color: #fff; padding: 48px 40px; }
  .cover .label { font-size: 11pt; opacity: 0.8; margin-bottom: 8px; }
  .cover h1 { font-size: 22pt; font-weight: 700; }
  .cover .org { font-size: 15pt; margin-top: 20px; font-weight: 600; }
  .cover .period { font-size: 10pt; opacity: 0.8; margin-top: 6px; }
  .ppn-badge { background: #fff; color: #00703c; font-size: 9pt; font-weight: 700; padding: 3px 10px; border-radius: 4px; display: inline-block; margin-top: 16px; }
  section { padding: 28px 40px; border-bottom: 1px solid #e5e7eb; }
  h2 { font-size: 13pt; font-weight: 700; color: #00703c; border-bottom: 2px solid #00703c; padding-bottom: 4px; margin-bottom: 14px; }
  h3 { font-size: 11pt; font-weight: 700; color: #374151; margin: 14px 0 6px; }
  p { margin: 8px 0; line-height: 1.55; }
  .commitment-box { border: 2px solid #00703c; border-radius: 8px; padding: 20px; margin: 16px 0; background: #f0fdf4; }
  .commitment-box .headline { font-size: 14pt; font-weight: 700; color: #065f46; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 16px 0; }
  .stat { border: 1px solid #d1fae5; border-radius: 6px; padding: 14px; background: #f0fdf4; }
  .stat .label { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .stat .value { font-size: 15pt; font-weight: 700; color: #065f46; }
  .stat .sub { font-size: 9pt; color: #6b7280; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #00703c; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .progress-bar { height: 12px; background: #d1fae5; border-radius: 6px; overflow: hidden; margin: 6px 0; }
  .progress-fill { height: 100%; background: #00703c; border-radius: 6px; }
  .declaration { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 16px 0; }
  ul { margin: 8px 0 8px 20px; }
  li { margin: 4px 0; line-height: 1.5; }
  .footer { background: #f9fafb; padding: 16px 40px; font-size: 9pt; color: #6b7280; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>

<div class="cover">
  <div class="label">Procurement Policy Note 06/21</div>
  <h1>Carbon Reduction Plan</h1>
  <div class="org">${esc(d.orgName)}</div>
  <div class="period">Commitment period: ${pStart} – ${pEnd}</div>
  <div class="ppn-badge">PPN 06/21 Compliant</div>
</div>

<section>
  <h2>1. Commitment to Achieving Net Zero</h2>
  <div class="commitment-box">
    <div class="headline">${esc(d.orgName)} is committed to achieving net zero greenhouse gas emissions by ${d.netZeroTargetYear}.</div>
    ${d.interimTargetYear ? `<p style="margin-top:10px;color:#065f46;">Interim target: <strong>${d.interimReductionPct ?? "—"}% reduction</strong> in absolute Scope 1 &amp; 2 emissions by <strong>${d.interimTargetYear}</strong> against the ${d.baselineYear ?? "baseline"} year.</p>` : ""}
  </div>
  <p>This Carbon Reduction Plan has been completed in accordance with the requirements of PPN 06/21 and associated guidance.</p>
</section>

<section>
  <h2>2. Baseline Emissions Footprint</h2>
  ${d.baselineYear ? `<p>Baseline year: <strong>${esc(d.baselineYear)}</strong> | Baseline total: <strong>${d.baselineTonnes ? fmtT(d.baselineTonnes) : "—"}</strong></p>` : ""}
  <div class="stat-grid">
    <div class="stat">
      <div class="label">Scope 1</div>
      <div class="value">${fmt(d.scope1Tonnes)}</div>
      <div class="sub">tCO₂e (direct)</div>
    </div>
    <div class="stat">
      <div class="label">Scope 2</div>
      <div class="value">${fmt(d.scope2Tonnes)}</div>
      <div class="sub">tCO₂e (electricity)</div>
    </div>
    <div class="stat">
      <div class="label">Scope 3</div>
      <div class="value">${fmt(d.scope3Tonnes)}</div>
      <div class="sub">tCO₂e (value chain)</div>
    </div>
    <div class="stat">
      <div class="label">Total</div>
      <div class="value">${fmt(d.totalTonnes)}</div>
      <div class="sub">tCO₂e</div>
    </div>
  </div>
  ${reductionPct !== null ? `
  <h3>Progress Against Baseline</h3>
  <p>Reduction achieved: <strong>${reductionPct}%</strong> (${d.baselineYear ? `from ${esc(d.baselineYear)} baseline` : ""})</p>
  <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(Math.max(parseFloat(reductionPct), 0), 100)}%"></div></div>
  ` : ""}
  <p style="font-size:9pt;color:#6b7280;margin-top:12px;">Scopes reported: ${d.scopesReported.join(", ")}. ${d.recordCount.toLocaleString("en-GB")} activity records. Methodology: ${esc(d.methodology)} (GWP ${esc(d.gwpVersion)}). Factors: ${esc(d.factorLibrary)}.</p>
</section>

<section>
  <h2>3. Current Emissions Reporting Period</h2>
  <p>Reporting period: <strong>${esc(d.periodLabel)}</strong> (${pStart} – ${pEnd})</p>
  <table>
    <thead><tr><th>Scope</th><th>Description</th><th>Emissions (tCO₂e)</th></tr></thead>
    <tbody>
      <tr><td>Scope 1</td><td>Direct emissions (combustion, fugitive, process)</td><td>${fmtT(d.scope1Tonnes)}</td></tr>
      <tr><td>Scope 2</td><td>Indirect emissions from purchased electricity</td><td>${fmtT(d.scope2Tonnes)}</td></tr>
      <tr><td>Scope 3</td><td>Value chain emissions (reported categories)</td><td>${fmtT(d.scope3Tonnes)}</td></tr>
      <tr><td colspan="2"><strong>Total</strong></td><td><strong>${fmtT(d.totalTonnes)}</strong></td></tr>
    </tbody>
  </table>
</section>

<section>
  <h2>4. Proposals for Meeting Net Zero Target</h2>
  ${d.initiatives.length > 0 ? `
  <table>
    <thead><tr><th>Initiative</th><th>Status</th><th>Expected Impact</th></tr></thead>
    <tbody>
      ${d.initiatives.map((i) => `
      <tr>
        <td>${esc(i.name)}</td>
        <td>${esc(i.status.replace("_", " "))}</td>
        <td>${i.expectedImpactTonnes !== undefined ? fmtT(i.expectedImpactTonnes) : "—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : `<p style="color:#6b7280;font-style:italic">Add reduction initiatives via the platform to populate this section.</p>`}
</section>

<section>
  <h2>5. Declaration</h2>
  <div class="declaration">
    <p>This Carbon Reduction Plan has been reviewed and approved by a member of the board of directors (or equivalent management body) with overall responsibility for the organisation's environmental policy.</p>
    <p style="margin-top:16px;"><strong>Authorised signatory:</strong> ___________________________ &nbsp;&nbsp; <strong>Date:</strong> ___________________</p>
    <p style="margin-top:8px;"><strong>Position:</strong> ___________________________</p>
    <p style="margin-top:16px;font-size:9pt;color:#6b7280;">
      This plan shall be published on the organisation's website and kept current. A new plan must be published within 12 months of the previous plan's publication date.
    </p>
  </div>
</section>

<div class="footer">
  PPN 06/21 Carbon Reduction Plan · ${esc(d.orgName)} · Generated ${now} by Fluid · Snapshot v${d.snapshotVersion} · ${esc(d.factorLibrary)} · ${esc(d.methodology)}
</div>
</body></html>`;
}
