// NHS Evergreen Level 1 — mandatory for all NHS suppliers from April 2026
// Aligned to NHS Net Zero Supplier Roadmap requirements.

import { esc, brandStyles, brandLogoHtml } from "./shared";

export type NhsEvergreenData = {
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
  scope2Tonnes: number;
  totalTonnes: number;
  netZeroTargetYear: number;
  accountableOfficerName?: string;
  accountableOfficerTitle?: string;
  initiatives: Array<{ name: string; status: string }>;
  recordCount: number;
};

export function renderNhsEvergreenHtml(d: NhsEvergreenData): string {
  const fmt = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fmtT = (n: number) => `${fmt(n, 2)} tCO₂e`;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pStart = d.periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pEnd = d.periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NHS Evergreen Sustainability Assessment — ${esc(d.orgName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .cover { background: #005eb8; color: #fff; padding: 48px 40px; }
  .cover .nhs-logo { font-size: 28pt; font-weight: 900; letter-spacing: -1px; margin-bottom: 16px; }
  .cover h1 { font-size: 18pt; font-weight: 700; }
  .cover .level { font-size: 12pt; margin-top: 8px; }
  .cover .org { font-size: 15pt; margin-top: 20px; font-weight: 600; }
  .cover .period { font-size: 10pt; opacity: 0.8; margin-top: 6px; }
  section { padding: 28px 40px; border-bottom: 1px solid #e5e7eb; }
  h2 { font-size: 13pt; font-weight: 700; color: #005eb8; border-bottom: 2px solid #005eb8; padding-bottom: 4px; margin-bottom: 14px; }
  p { margin: 8px 0; line-height: 1.55; }
  .check { color: #00703c; font-weight: 700; font-size: 13pt; }
  .cross { color: #d32f2f; font-weight: 700; font-size: 13pt; }
  .req-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .req-table th { background: #005eb8; color: #fff; padding: 8px 12px; text-align: left; font-size: 9pt; }
  .req-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .req-table tr:nth-child(even) td { background: #f0f7ff; }
  .emission-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .emission-card { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; }
  .emission-card .label { font-size: 9pt; color: #1e3a5f; text-transform: uppercase; margin-bottom: 6px; }
  .emission-card .value { font-size: 17pt; font-weight: 700; color: #005eb8; }
  .emission-card .sub { font-size: 9pt; color: #6b7280; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #005eb8; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 16px 40px; font-size: 9pt; color: #6b7280; border-top: 1px solid #e5e7eb; }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <div class="nhs-logo">NHS</div>
  <h1>Evergreen Sustainability Assessment</h1>
  <div class="level">Level 1 Supplier Declaration</div>
  <div class="org">${esc(d.orgName)}</div>
  <div class="period">Reporting period: ${pStart} – ${pEnd}</div>
</div>

<section>
  <h2>Level 1 Requirements Checklist</h2>
  <table class="req-table">
    <thead><tr><th>Requirement</th><th>Status</th><th>Evidence</th></tr></thead>
    <tbody>
      <tr>
        <td>Net zero commitment declared</td>
        <td><span class="check">✓ Met</span></td>
        <td>Net zero target year: <strong>${d.netZeroTargetYear}</strong></td>
      </tr>
      <tr>
        <td>Named accountable officer</td>
        <td><span class="${d.accountableOfficerName ? 'check' : 'cross'}">${d.accountableOfficerName ? '✓ Met' : '✗ Pending'}</span></td>
        <td>${d.accountableOfficerName ? `${esc(d.accountableOfficerName)}${d.accountableOfficerTitle ? `, ${esc(d.accountableOfficerTitle)}` : ""}` : "Please complete via platform settings"}</td>
      </tr>
      <tr>
        <td>Scope 1 &amp; 2 emissions reported</td>
        <td><span class="${(d.scope1Tonnes > 0 || d.scope2Tonnes > 0) ? 'check' : 'cross'}">${(d.scope1Tonnes > 0 || d.scope2Tonnes > 0) ? '✓ Met' : '✗ Incomplete'}</span></td>
        <td>${fmtT(d.scope1Tonnes + d.scope2Tonnes)} (Scope 1 + 2 combined)</td>
      </tr>
      <tr>
        <td>At least one green plan initiative</td>
        <td><span class="${d.initiatives.length > 0 ? 'check' : 'cross'}">${d.initiatives.length > 0 ? '✓ Met' : '✗ Pending'}</span></td>
        <td>${d.initiatives.length} initiative${d.initiatives.length !== 1 ? "s" : ""} recorded</td>
      </tr>
    </tbody>
  </table>
</section>

<section>
  <h2>Emissions Inventory</h2>
  <p>Reporting period: <strong>${esc(d.periodLabel)}</strong> | ${d.recordCount.toLocaleString("en-GB")} activity records</p>
  <div class="emission-grid">
    <div class="emission-card">
      <div class="label">Scope 1 (Direct)</div>
      <div class="value">${fmt(d.scope1Tonnes)}</div>
      <div class="sub">tCO₂e</div>
    </div>
    <div class="emission-card">
      <div class="label">Scope 2 (Electricity)</div>
      <div class="value">${fmt(d.scope2Tonnes)}</div>
      <div class="sub">tCO₂e</div>
    </div>
    <div class="emission-card">
      <div class="label">Scope 1 + 2 Total</div>
      <div class="value">${fmt(d.scope1Tonnes + d.scope2Tonnes)}</div>
      <div class="sub">tCO₂e</div>
    </div>
  </div>
  <p style="font-size:9pt;color:#6b7280;">Methodology: ${esc(d.methodology)} (GWP ${esc(d.gwpVersion)}). Conversion factors: ${esc(d.factorLibrary)}.</p>
</section>

<section>
  <h2>Green Plan Initiatives</h2>
  ${d.initiatives.length > 0 ? `
  <table>
    <thead><tr><th>Initiative</th><th>Status</th></tr></thead>
    <tbody>${d.initiatives.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.status.replace("_", " "))}</td></tr>`).join("")}</tbody>
  </table>` : `<p style="color:#6b7280;font-style:italic">Add green plan initiatives via the platform to populate this section.</p>`}
</section>

<section>
  <h2>Net Zero Commitment</h2>
  <p>${esc(d.orgName)} commits to achieving net zero greenhouse gas emissions by <strong>${d.netZeroTargetYear}</strong>, aligned with the NHS Net Zero Supplier Roadmap.</p>
  <p style="margin-top:12px;"><strong>Accountable Officer:</strong> ${d.accountableOfficerName ? `${esc(d.accountableOfficerName)}${d.accountableOfficerTitle ? `, ${esc(d.accountableOfficerTitle)}` : ""}` : "_________________________ (signature required)"}</p>
  <p style="margin-top:6px;"><strong>Date:</strong> ${now}</p>
</section>

<div class="footer">
  NHS Evergreen Level 1 · ${esc(d.orgName)} · Generated ${now} by Fluid · Snapshot v${d.snapshotVersion} · ${esc(d.factorLibrary)}
</div>
</body></html>`;
}
