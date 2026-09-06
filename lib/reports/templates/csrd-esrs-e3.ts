// CSRD ESRS E3 (Water and marine resources) report template.
// Covers: E3-1 policies, E3-4 water consumption/withdrawal/discharge and
// water intensity, with a water-stressed-area breakdown per facility.
// Aligns with EFRAG ESRS E3 standard.
//
// Unlike the GHG reports (csrd-esrs-e1, ghg-protocol, etc.), water has no
// CO2e figure and no immutable published-snapshot lock yet — this reflects
// the organisation's current WaterRecord data for the period, not a
// point-in-time snapshot. That's a deliberate Phase 1 simplification.

import { esc, brandStyles, brandLogoHtml } from "./shared";

export interface CsrdEsrsE3Data {
  orgName: string;
  logoDataUri?: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date;
  publishedBy: string;
  withdrawalM3: number;
  dischargeM3: number;
  consumptionM3: number;
  withdrawalStressedM3: number;
  recordCount: number;
  facilities: Array<{
    name: string;
    withdrawalM3: number;
    dischargeM3: number;
    consumptionM3: number;
    waterStressLevel: string | null;
  }>;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n: number, dp = 1) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const STRESS_LABEL: Record<string, string> = {
  low: "Low",
  medium_high: "Medium-high",
  high: "High",
  extremely_high: "Extremely high",
  unknown: "Unknown",
};

export function renderCsrdEsrsE3Html(d: CsrdEsrsE3Data): string {
  const stressedPct = d.withdrawalM3 > 0 ? (d.withdrawalStressedM3 / d.withdrawalM3) * 100 : 0;

  const facilityRows = d.facilities
    .sort((a, b) => b.withdrawalM3 - a.withdrawalM3)
    .map((f) => `<tr>
      <td>${esc(f.name)}</td>
      <td class="num">${fmtNum(f.withdrawalM3)}</td>
      <td class="num">${fmtNum(f.dischargeM3)}</td>
      <td class="num">${fmtNum(f.consumptionM3)}</td>
      <td>${f.waterStressLevel ? esc(STRESS_LABEL[f.waterStressLevel] ?? f.waterStressLevel) : "Not assessed"}</td>
    </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CSRD ESRS E3 Water Disclosure — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5 }
  .cover { background: #0c4a6e; color: #fff; padding: 40px }
  .cover h1 { font-size: 20pt; font-weight: 700; margin-bottom: 6px }
  .cover .sub { font-size: 11pt; margin-top: 4px; opacity: 0.85 }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 16px }
  section { margin: 28px 40px }
  h2 { font-size: 12pt; font-weight: 700; color: #0c4a6e; border-left: 4px solid #0c4a6e; padding-left: 10px; margin-bottom: 12px }
  .disc-ref { font-size: 8.5pt; color: #666; font-style: italic; margin-bottom: 10px }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px }
  th { background: #e0f2fe; color: #0c4a6e; text-align: left; padding: 6px 8px; border: 1px solid #bae6fd }
  td { padding: 5px 8px; border: 1px solid #dde; vertical-align: top }
  tr:nth-child(even) td { background: #f0f9ff }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px }
  .kpi { background: #e0f2fe; border-radius: 6px; padding: 16px; }
  .kpi .val { font-size: 17pt; font-weight: 700; color: #0c4a6e; display: block; margin: 4px 0 2px }
  .kpi .lbl { font-size: 8.5pt; color: #566; }
  .caution { background: #fff8e1; border-left: 3px solid #f9a825; padding: 10px 14px; font-size: 9pt; margin-top: 14px }
  footer { font-size: 8pt; color: #888; text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 32px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <h1>CSRD / ESRS E3 — Water and Marine Resources</h1>
  <p class="sub">${esc(d.orgName)}</p>
  <p class="sub">Reporting period: ${esc(d.periodLabel)}</p>
  <p class="meta">Generated ${fmtDate(d.publishedAt)} by ${esc(d.publishedBy)}</p>
</div>

<section>
  <h2>E3-0 General Disclosures — Measurement Basis</h2>
  <p class="disc-ref">Reference: ESRS E3 paragraph 1, ESRS 1 Appendix B</p>
  <table>
    <tr><th>Disclosure field</th><th>Value</th></tr>
    <tr><td>Standard applied</td><td>ESRS E3 — Water and Marine Resources (EFRAG)</td></tr>
    <tr><td>Reporting period</td><td>${fmtDate(d.periodStart)} - ${fmtDate(d.periodEnd)}</td></tr>
    <tr><td>Water records included</td><td>${d.recordCount.toLocaleString("en-GB")}</td></tr>
  </table>
</section>

<section>
  <h2>E3-4 Water Consumption, Withdrawal and Discharge</h2>
  <p class="disc-ref">Reference: ESRS E3 paragraphs 26-29</p>
  <div class="summary-grid">
    <div class="kpi"><span class="val">${fmtNum(d.withdrawalM3)} m³</span><span class="lbl">Total water withdrawal</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.dischargeM3)} m³</span><span class="lbl">Total water discharge</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.consumptionM3)} m³</span><span class="lbl">Total water consumption</span></div>
    <div class="kpi"><span class="val">${fmtNum(stressedPct)}%</span><span class="lbl">Withdrawal in water-stressed areas</span></div>
  </div>
</section>

<section>
  <h2>Facility Breakdown</h2>
  ${d.facilities.length > 0 ? `<table>
    <tr><th>Facility</th><th class="num">Withdrawal (m³)</th><th class="num">Discharge (m³)</th><th class="num">Consumption (m³)</th><th>Water stress</th></tr>
    ${facilityRows}
  </table>` : "<p>No water records for this period.</p>"}
  <div class="caution">Water-stress classification is manually assessed per facility (e.g. against WRI Aqueduct) and may not reflect the most current basin-level data. Facilities marked &quot;Not assessed&quot; should be reviewed before external assurance.</div>
</section>

<footer>
  ${esc(d.orgName)} · ESRS E3 Water Disclosure · ${esc(d.periodLabel)}<br>
  Generated ${fmtDate(d.publishedAt)}
</footer>
</body>
</html>`;
}
